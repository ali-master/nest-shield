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

interface RateLimitInfo {
  points: number;
  resetTime: number;
}

@Injectable()
export class RateLimitService {
  private globalConfig: IRateLimitConfig;

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

    const key = this.generateKey(context, mergedConfig);
    const now = Date.now();
    const windowStart =
      Math.floor(now / 1000 / mergedConfig.duration) * mergedConfig.duration * 1000;
    const windowKey = `${key}:${windowStart}`;

    try {
      const info = await this.getRateLimitInfo(windowKey, windowStart, mergedConfig);

      if (info.points >= mergedConfig.points) {
        const retryAfter = Math.ceil((info.resetTime - now) / 1000);

        this.metricsService.increment("rate_limit_exceeded", 1, {
          path: context.path,
          method: context.method,
        });

        const message =
          typeof mergedConfig.customResponseMessage === "function"
            ? mergedConfig.customResponseMessage(context)
            : mergedConfig.customResponseMessage || "Rate limit exceeded";

        throw new RateLimitException(message, retryAfter, {
          limit: mergedConfig.points,
          remaining: 0,
          reset: info.resetTime,
        });
      }

      await this.storage.increment(windowKey);

      const remaining = mergedConfig.points - info.points - 1;

      this.metricsService.increment("rate_limit_consumed", 1, {
        path: context.path,
        method: context.method,
      });

      return {
        allowed: true,
        metadata: {
          limit: mergedConfig.points,
          remaining,
          reset: info.resetTime,
          headers: this.generateHeaders(mergedConfig, remaining, info.resetTime),
        },
      };
    } catch (error) {
      if (error instanceof RateLimitException) {
        throw error;
      }

      this.metricsService.increment("rate_limit_error", 1, {
        path: context.path,
        method: context.method,
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

    const key = this.generateKey(context, mergedConfig);
    const now = Date.now();
    const windowStart =
      Math.floor(now / 1000 / mergedConfig.duration) * mergedConfig.duration * 1000;
    const windowKey = `${key}:${windowStart}`;

    const info = await this.getRateLimitInfo(windowKey, windowStart, mergedConfig);
    return Math.max(0, mergedConfig.points - info.points);
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

  private async getRateLimitInfo(
    key: string,
    windowStart: number,
    config: IRateLimitConfig,
  ): Promise<RateLimitInfo> {
    const points = (await this.storage.get(key)) || 0;
    const resetTime = windowStart + config.duration * 1000;

    if (!(await this.storage.exists(key))) {
      await this.storage.set(key, 0, config.duration);
    }

    return { points: Number(points), resetTime };
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
    const _now = Date.now();
    const keys = (await this.storage.scan?.("rate_limit:*")) || [];

    for (const key of keys) {
      const ttl = await this.storage.ttl(key);
      if (ttl === -2) {
        await this.storage.delete(key);
      }
    }
  }
}
