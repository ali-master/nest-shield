import { Injectable, Inject } from "@nestjs/common";
import type {
  IThrottleConfig,
  IStorageAdapter,
  IProtectionResult,
  IProtectionContext,
} from "../interfaces/shield-config.interface";
import { HEADER_NAMES } from "../core/constants";
import { DI_TOKENS } from "../core/di-tokens";
import { ThrottleException } from "../core/exceptions";
import type { IMetricsCollector } from "../interfaces";

interface ThrottleRecord {
  count: number;
  firstRequestTime: number;
}

@Injectable()
export class ThrottleService {
  private globalConfig: IThrottleConfig;

  constructor(
    @Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: any,
    @Inject(DI_TOKENS.SHIELD_STORAGE) private readonly storage: IStorageAdapter,
    @Inject(DI_TOKENS.METRICS_SERVICE) private readonly metricsService: IMetricsCollector,
  ) {
    this.globalConfig = this.options.throttle || {};
  }

  async consume(
    context: IProtectionContext,
    config?: Partial<IThrottleConfig>,
  ): Promise<IProtectionResult> {
    const mergedConfig = { ...this.globalConfig, ...config };

    if (!mergedConfig.enabled) {
      return { allowed: true };
    }

    if (this.shouldIgnoreUserAgent(context.userAgent, mergedConfig)) {
      return { allowed: true };
    }

    const key = this.generateKey(context, mergedConfig);
    const now = Date.now();

    try {
      let record = await this.getThrottleRecord(key);

      if (!record) {
        record = { count: 0, firstRequestTime: now };
      }

      const windowEnd = record.firstRequestTime + mergedConfig.ttl * 1000;

      if (now > windowEnd) {
        record = { count: 1, firstRequestTime: now };
        await this.setThrottleRecord(key, record, mergedConfig.ttl);

        return {
          allowed: true,
          metadata: {
            limit: mergedConfig.limit,
            remaining: mergedConfig.limit - 1,
            reset: now + mergedConfig.ttl * 1000,
          },
        };
      }

      if (record.count >= mergedConfig.limit) {
        const retryAfter = Math.ceil((windowEnd - now) / 1000);

        this.metricsService.increment("throttle_exceeded", 1, {
          path: context.path,
          method: context.method,
        });

        const message =
          typeof mergedConfig.customResponseMessage === "function"
            ? mergedConfig.customResponseMessage(context)
            : mergedConfig.customResponseMessage || "Too many requests";

        throw new ThrottleException(message, retryAfter, {
          limit: mergedConfig.limit,
          ttl: mergedConfig.ttl,
          reset: windowEnd,
        });
      }

      record.count++;
      const ttlSeconds = Math.ceil((windowEnd - now) / 1000);
      await this.setThrottleRecord(key, record, ttlSeconds);

      this.metricsService.increment("throttle_consumed", 1, {
        path: context.path,
        method: context.method,
      });

      return {
        allowed: true,
        metadata: {
          limit: mergedConfig.limit,
          remaining: mergedConfig.limit - record.count,
          reset: windowEnd,
          headers: this.generateHeaders(mergedConfig, mergedConfig.limit - record.count, windowEnd),
        },
      };
    } catch (error) {
      if (error instanceof ThrottleException) {
        throw error;
      }

      this.metricsService.increment("throttle_error", 1, {
        path: context.path,
        method: context.method,
      });

      return { allowed: true };
    }
  }

  async reset(context: IProtectionContext, config?: Partial<IThrottleConfig>): Promise<void> {
    const mergedConfig = { ...this.globalConfig, ...config };
    const key = this.generateKey(context, mergedConfig);
    await this.storage.delete(key);
  }

  async getStatus(
    context: IProtectionContext,
    config?: Partial<IThrottleConfig>,
  ): Promise<{ count: number; remaining: number; reset: number }> {
    const mergedConfig = { ...this.globalConfig, ...config };

    if (!mergedConfig.enabled) {
      return {
        count: 0,
        remaining: mergedConfig.limit,
        reset: 0,
      };
    }

    const key = this.generateKey(context, mergedConfig);
    const record = await this.getThrottleRecord(key);

    if (!record) {
      return {
        count: 0,
        remaining: mergedConfig.limit,
        reset: 0,
      };
    }

    const now = Date.now();
    const windowEnd = record.firstRequestTime + mergedConfig.ttl * 1000;

    if (now > windowEnd) {
      return {
        count: 0,
        remaining: mergedConfig.limit,
        reset: 0,
      };
    }

    return {
      count: record.count,
      remaining: Math.max(0, mergedConfig.limit - record.count),
      reset: windowEnd,
    };
  }

  private generateKey(context: IProtectionContext, config: IThrottleConfig): string {
    if (config.keyGenerator) {
      return `throttle:${config.keyGenerator(context)}`;
    }
    return `throttle:${context.ip}`;
  }

  private async getThrottleRecord(key: string): Promise<ThrottleRecord | null> {
    const data = await this.storage.get(key);
    return data as ThrottleRecord | null;
  }

  private async setThrottleRecord(key: string, record: ThrottleRecord, ttl: number): Promise<void> {
    await this.storage.set(key, record, ttl);
  }

  private shouldIgnoreUserAgent(userAgent: string, config: IThrottleConfig): boolean {
    if (!config.ignoreUserAgents || config.ignoreUserAgents.length === 0) {
      return false;
    }

    return config.ignoreUserAgents.some((regex) => regex.test(userAgent));
  }

  private generateHeaders(
    config: IThrottleConfig,
    remaining: number,
    resetTime: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      [HEADER_NAMES.RATE_LIMIT_LIMIT]: String(config.limit),
      [HEADER_NAMES.RATE_LIMIT_REMAINING]: String(Math.max(0, remaining)),
      [HEADER_NAMES.RATE_LIMIT_RESET]: String(Math.floor(resetTime / 1000)),
    };

    if (remaining === 0) {
      headers[HEADER_NAMES.RETRY_AFTER] = String(Math.ceil((resetTime - Date.now()) / 1000));
    }

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const keys = (await this.storage.scan?.("throttle:*")) || [];

    for (const key of keys) {
      const record = await this.getThrottleRecord(key);
      if (record) {
        const windowEnd = record.firstRequestTime + this.globalConfig.ttl * 1000;
        if (now > windowEnd) {
          await this.storage.delete(key);
        }
      }
    }
  }
}
