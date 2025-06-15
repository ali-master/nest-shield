import { Injectable, Inject } from "@nestjs/common";
import type {
  IStorageAdapter,
  IRateLimitConfig,
  IProtectionResult,
  IProtectionContext,
} from "../interfaces/shield-config.interface";
import { HEADER_NAMES } from "../core/constants";
import { DI_TOKENS } from "../core/di-tokens";
import { RateLimitException } from "../core/exceptions";
import type { IMetricsCollector } from "../interfaces";

@Injectable()
export class RateLimitService {
  private readonly globalConfig: IRateLimitConfig;
  private readonly keyCache = new Map<
    string,
    { key: string; windowStart: number; resetTime: number }
  >();
  private readonly CACHE_SIZE_LIMIT = 10000;

  constructor(
    @Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: any,
    @Inject(DI_TOKENS.SHIELD_STORAGE) private readonly storage: IStorageAdapter,
    @Inject(DI_TOKENS.METRICS_SERVICE) private readonly metricsService: IMetricsCollector,
  ) {
    this.globalConfig = this.options.rateLimit || {};
  }

  async consume(
    context: IProtectionContext,
    config?: Partial<IRateLimitConfig>,
  ): Promise<IProtectionResult> {
    const mergedConfig = { ...this.globalConfig, ...config };

    if (!mergedConfig.enabled) {
      return { allowed: true };
    }

    const cacheKey = `${context.ip}:${context.path}:${context.method}`;
    const now = Date.now();
    const windowInfo = this.getOrCreateWindowInfo(cacheKey, now, mergedConfig);
    const windowKey = windowInfo.key;

    try {
      // Use atomic increment for better performance
      const currentPoints = await this.storage.increment(windowKey, 0); // Get current value

      // Set TTL only if this is a new key
      if (currentPoints === 0) {
        await this.storage.expire(windowKey, mergedConfig.duration);
      }

      if (currentPoints >= mergedConfig.points) {
        const retryAfter = Math.ceil((windowInfo.resetTime - now) / 1000);

        // Async metrics to avoid blocking
        setImmediate(() => {
          this.metricsService.increment("rate_limit_exceeded", 1, {
            path: context.path,
            method: context.method,
          });
        });

        const message =
          typeof mergedConfig.customResponseMessage === "function"
            ? mergedConfig.customResponseMessage(context)
            : mergedConfig.customResponseMessage || "Rate limit exceeded";

        throw new RateLimitException(message, retryAfter, {
          limit: mergedConfig.points,
          remaining: 0,
          reset: windowInfo.resetTime,
        });
      }

      // Atomic increment
      const newPoints = await this.storage.increment(windowKey, 1);
      const remaining = mergedConfig.points - newPoints;

      // Async metrics to avoid blocking
      setImmediate(() => {
        this.metricsService.increment("rate_limit_consumed", 1, {
          path: context.path,
          method: context.method,
        });
      });

      return {
        allowed: true,
        metadata: {
          limit: mergedConfig.points,
          remaining,
          reset: windowInfo.resetTime,
          headers: this.generateHeaders(mergedConfig, remaining, windowInfo.resetTime),
        },
      };
    } catch (error) {
      if (error instanceof RateLimitException) {
        throw error;
      }

      // Async metrics to avoid blocking
      setImmediate(() => {
        this.metricsService.increment("rate_limit_error", 1, {
          path: context.path,
          method: context.method,
        });
      });

      return { allowed: true };
    }
  }

  async reset(context: IProtectionContext, config?: Partial<IRateLimitConfig>): Promise<void> {
    const mergedConfig = { ...this.globalConfig, ...config };
    const key = this.generateKey(context, mergedConfig);
    const now = Date.now();
    const windowStart =
      Math.floor(now / 1000 / mergedConfig.duration) * mergedConfig.duration * 1000;
    const windowKey = `${key}:${windowStart}`;

    await this.storage.delete(windowKey);
  }

  async getRemaining(
    context: IProtectionContext,
    config?: Partial<IRateLimitConfig>,
  ): Promise<number> {
    const mergedConfig = { ...this.globalConfig, ...config };

    if (!mergedConfig.enabled) {
      return mergedConfig.points;
    }

    const cacheKey = `${context.ip}:${context.path}:${context.method}`;
    const now = Date.now();
    const windowInfo = this.getOrCreateWindowInfo(cacheKey, now, mergedConfig);

    const currentPoints = (await this.storage.get(windowInfo.key)) || 0;
    return Math.max(0, mergedConfig.points - Number(currentPoints));
  }

  async block(context: IProtectionContext, duration: number, reason?: string): Promise<void> {
    const key = `block:${context.ip}`;
    await this.storage.set(key, { reason, timestamp: Date.now() }, duration);
  }

  async isBlocked(context: IProtectionContext): Promise<boolean> {
    const key = `block:${context.ip}`;
    const blockInfo = await this.storage.get(key);
    return !!blockInfo;
  }

  private generateKey(context: IProtectionContext, config: IRateLimitConfig): string {
    if (config.keyGenerator) {
      return `rate_limit:${config.keyGenerator(context)}`;
    }
    return `rate_limit:${context.ip}:${context.path}:${context.method}`;
  }

  /**
   * Get or create window info with caching for better performance
   */
  private getOrCreateWindowInfo(
    cacheKey: string,
    now: number,
    config: IRateLimitConfig,
  ): { key: string; windowStart: number; resetTime: number } {
    const cached = this.keyCache.get(cacheKey);
    const windowStart = Math.floor(now / 1000 / config.duration) * config.duration * 1000;
    const resetTime = windowStart + config.duration * 1000;

    // Return cached if same window
    if (cached && cached.windowStart === windowStart) {
      return cached;
    }

    // Create new window info
    const windowKey = `rate_limit:${cacheKey}:${windowStart}`;
    const windowInfo = { key: windowKey, windowStart, resetTime };

    // Cache with size limit
    if (this.keyCache.size >= this.CACHE_SIZE_LIMIT) {
      // Remove oldest 10% of entries
      const keysToRemove = Array.from(this.keyCache.keys()).slice(
        0,
        Math.floor(this.CACHE_SIZE_LIMIT * 0.1),
      );
      keysToRemove.forEach((k) => this.keyCache.delete(k));
    }

    this.keyCache.set(cacheKey, windowInfo);
    return windowInfo;
  }

  private generateHeaders(
    config: IRateLimitConfig,
    remaining: number,
    resetTime: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      [HEADER_NAMES.RATE_LIMIT_LIMIT]: String(config.points),
      [HEADER_NAMES.RATE_LIMIT_REMAINING]: String(Math.max(0, remaining)),
      [HEADER_NAMES.RATE_LIMIT_RESET]: String(Math.floor(resetTime / 1000)),
    };

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  async cleanup(): Promise<void> {
    // Clean up expired cache entries
    const now = Date.now();
    for (const [key, value] of this.keyCache.entries()) {
      if (now > value.resetTime) {
        this.keyCache.delete(key);
      }
    }

    // Clean up expired storage keys (if supported)
    if (this.storage.scan) {
      const keys = await this.storage.scan("rate_limit:*");
      for (const key of keys) {
        const ttl = await this.storage.ttl(key);
        if (ttl === -2) {
          await this.storage.delete(key);
        }
      }
    }
  }
}
