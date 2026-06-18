import { Injectable, Inject } from "@nestjs/common";
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import type { RateLimiterAbstract } from "rate-limiter-flexible";
import type {
  IStorageAdapter,
  IRateLimitConfig,
  IProtectionResult,
  IProtectionContext,
} from "../interfaces/shield-config.interface";
import { DI_TOKENS } from "../core/di-tokens";
import { RateLimitException } from "../core/exceptions";
import type { IMetricsCollector } from "../interfaces";
import { KeyGeneratorUtil, HeaderGeneratorUtil } from "../common/utils";

/**
 * Rate limiting backed by the `rate-limiter-flexible` package.
 *
 * The service keeps the existing NestShield contract (`consume`, route-isolated
 * keys, custom key generators, headers and `RateLimitException`) but delegates
 * the actual counting/window/block bookkeeping to `rate-limiter-flexible`.
 *
 * Backend selection mirrors the configured storage:
 * - `redis`  -> `RateLimiterRedis` sharing the storage adapter's ioredis client
 *               (distributed counters across instances)
 * - anything else (`memory`, `memcached`, `custom`) -> `RateLimiterMemory`
 *   (`rate-limiter-flexible`'s memcached backend requires the `memcached`
 *   package, which is incompatible with the `memjs` client used here).
 */
@Injectable()
export class RateLimitService {
  private readonly globalConfig: IRateLimitConfig;

  /** One limiter instance per unique `points:duration:blockDuration` config. */
  private readonly limiters = new Map<string, RateLimiterAbstract>();

  /** Dedicated limiter used by the manual block/isBlocked helpers. */
  private blockLimiter?: RateLimiterAbstract;

  /** ioredis client shared with the limiters when redis storage is configured. */
  private readonly redisClient?: unknown;

  constructor(
    @Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: any,
    @Inject(DI_TOKENS.SHIELD_STORAGE) private readonly storage: IStorageAdapter,
    @Inject(DI_TOKENS.METRICS_SERVICE) private readonly metricsService: IMetricsCollector,
  ) {
    this.globalConfig = this.options.rateLimit || {};

    // Reuse the storage adapter's connection for distributed rate limiting.
    if (this.options.storage?.type === "redis" && typeof this.storage.getClient === "function") {
      this.redisClient = this.storage.getClient();
    }
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
    const limiter = this.getLimiter(mergedConfig);

    try {
      const res = await limiter.consume(key, 1);
      const remaining = Math.max(0, res.remainingPoints);
      const reset = Date.now() + res.msBeforeNext;

      this.metricsService.increment("rate_limit_consumed", 1, {
        path: context.path,
        method: context.method,
      });

      return {
        allowed: true,
        metadata: {
          limit: mergedConfig.points,
          remaining,
          reset,
          headers: this.generateHeaders(mergedConfig, remaining, reset),
        },
      };
    } catch (error) {
      // `rate-limiter-flexible` rejects with a RateLimiterRes when the limit is
      // exhausted (or the key is blocked); any other rejection is a backend error.
      if (error instanceof RateLimiterRes) {
        const reset = Date.now() + error.msBeforeNext;
        const retryAfter = Math.ceil(error.msBeforeNext / 1000);

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
          reset,
        });
      }

      // Backend failure: fail open so a store outage doesn't reject traffic.
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
    await this.getLimiter(mergedConfig).delete(key);
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
    const res = await this.getLimiter(mergedConfig).get(key);
    return res ? Math.max(0, res.remainingPoints) : mergedConfig.points;
  }

  async block(context: IProtectionContext, duration: number, _reason?: string): Promise<void> {
    await this.getBlockLimiter().block(context.ip, duration);
  }

  async isBlocked(context: IProtectionContext): Promise<boolean> {
    const res = await this.getBlockLimiter().get(context.ip);
    return !!res && res.msBeforeNext > 0;
  }

  /**
   * Returns (creating if needed) a limiter for the given config. Limiters are
   * cached per `points:duration:blockDuration` signature and isolate keys via a
   * distinct keyPrefix so different limits never share counters.
   */
  private getLimiter(config: IRateLimitConfig): RateLimiterAbstract {
    const blockDuration = config.blockDuration ?? 0;
    const signature = `${config.points}:${config.duration}:${blockDuration}`;

    let limiter = this.limiters.get(signature);
    if (!limiter) {
      limiter = this.createLimiter({
        points: config.points,
        duration: config.duration,
        blockDuration,
        keyPrefix: `nest-shield:rl:${signature}`,
      });
      this.limiters.set(signature, limiter);
    }
    return limiter;
  }

  private getBlockLimiter(): RateLimiterAbstract {
    if (!this.blockLimiter) {
      this.blockLimiter = this.createLimiter({
        points: 1,
        duration: 1,
        keyPrefix: "nest-shield:block",
      });
    }
    return this.blockLimiter;
  }

  private createLimiter(opts: {
    points: number;
    duration: number;
    keyPrefix: string;
    blockDuration?: number;
  }): RateLimiterAbstract {
    if (this.redisClient) {
      return new RateLimiterRedis({ ...opts, storeClient: this.redisClient });
    }
    return new RateLimiterMemory(opts);
  }

  private generateKey(context: IProtectionContext, config: IRateLimitConfig): string {
    // A custom key generator takes full control of isolation.
    if (config.keyGenerator) {
      const baseKey = KeyGeneratorUtil.generateKey(context, config, "");
      if (typeof baseKey === "string") {
        return baseKey;
      }
    }

    // Default: isolate the limit per route so each endpoint's configured
    // `points` apply independently instead of sharing one per-identity counter.
    const identity = context.userId || context.ip || "global";
    return `${context.method}:${context.path}:${identity}`;
  }

  private generateHeaders(
    config: IRateLimitConfig,
    remaining: number,
    resetTime: number,
  ): Record<string, string> {
    const headers = HeaderGeneratorUtil.generateRateLimitHeaders({
      limit: config.points,
      remaining,
      reset: new Date(resetTime),
      prefix: "X-RateLimit",
    });

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  /**
   * No-op retained for API compatibility. `rate-limiter-flexible` manages key
   * expiry internally (TTLs for redis, timers for memory), so there is nothing
   * to sweep here.
   */
  async cleanup(): Promise<void> {}
}
