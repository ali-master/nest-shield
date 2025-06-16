import { Injectable, Inject } from "@nestjs/common";
import type {
  IThrottleConfig,
  IStorageAdapter,
  IProtectionResult,
  IProtectionContext,
} from "../interfaces/shield-config.interface";
import { DI_TOKENS } from "../core/di-tokens";
import { ThrottleException } from "../core/exceptions";
import type { IMetricsCollector } from "../interfaces";
import { TIME_CONSTANTS, KeyGeneratorUtil, HeaderGeneratorUtil } from "../common/utils";

interface ThrottleRecord {
  count: number;
  firstRequestTime: number;
}

interface CachedThrottleRecord {
  record: ThrottleRecord;
  lastUpdate: number;
  isDirty: boolean;
}

@Injectable()
export class ThrottleService {
  private readonly globalConfig: IThrottleConfig;
  private readonly cache = new Map<string, CachedThrottleRecord>();
  private readonly batchUpdateQueue = new Map<string, ThrottleRecord>();
  private batchUpdateTimer: NodeJS.Timeout | null = null;
  private readonly CACHE_TTL = TIME_CONSTANTS.THIRTY_SECONDS;
  private readonly BATCH_UPDATE_INTERVAL = 100; // 100ms batch interval

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
      // Try to get from cache first for better performance
      let record = await this.getCachedThrottleRecord(key);

      if (!record) {
        record = { count: 0, firstRequestTime: now };
      }

      const windowEnd = record.firstRequestTime + mergedConfig.ttl * 1000;

      // Check if current window has expired
      if (now > windowEnd) {
        record = { count: 1, firstRequestTime: now };
        this.updateThrottleRecordAsync(key, record, mergedConfig.ttl);

        return {
          allowed: true,
          metadata: {
            limit: mergedConfig.limit,
            remaining: mergedConfig.limit - 1,
            reset: now + mergedConfig.ttl * 1000,
            headers: this.generateHeaders(
              mergedConfig,
              mergedConfig.limit - 1,
              now + mergedConfig.ttl * 1000,
            ),
          },
        };
      }

      // Check if limit exceeded
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
          headers: this.generateHeaders(mergedConfig, 0, windowEnd),
        });
      }

      // Increment count and update
      record.count++;
      const ttlSeconds = Math.ceil((windowEnd - now) / 1000);
      this.updateThrottleRecordAsync(key, record, ttlSeconds);

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

      // Fail open on errors for better resilience
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
    const baseKey = KeyGeneratorUtil.generateKey(context, config, "throttle");
    return typeof baseKey === "string" ? baseKey : `throttle:${context.ip}`;
  }

  /**
   * Get throttle record with caching for better performance
   */
  private async getCachedThrottleRecord(key: string): Promise<ThrottleRecord | null> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Return cached record if it's fresh
    if (cached && now - cached.lastUpdate < this.CACHE_TTL) {
      return cached.record;
    }

    // Load from storage
    const data = await this.storage.get(key);
    const record = data as ThrottleRecord | null;

    if (record) {
      // Cache the record
      this.cache.set(key, {
        record,
        lastUpdate: now,
        isDirty: false,
      });
    }

    return record;
  }

  /**
   * Update throttle record asynchronously for better performance
   */
  private updateThrottleRecordAsync(key: string, record: ThrottleRecord, _ttl: number): void {
    // Update cache immediately
    const now = Date.now();
    this.cache.set(key, {
      record: { ...record },
      lastUpdate: now,
      isDirty: true,
    });

    // Queue for batch update
    this.batchUpdateQueue.set(key, record);

    // Setup batch update timer if not already running
    if (!this.batchUpdateTimer) {
      this.batchUpdateTimer = setTimeout(() => {
        this.processBatchUpdates().catch(() => {
          // Ignore batch update errors
        });
      }, this.BATCH_UPDATE_INTERVAL);
    }
  }

  /**
   * Process queued updates in batch for better performance
   */
  private async processBatchUpdates(): Promise<void> {
    if (this.batchUpdateQueue.size === 0) {
      this.batchUpdateTimer = null;
      return;
    }

    const updates = Array.from(this.batchUpdateQueue.entries());
    this.batchUpdateQueue.clear();
    this.batchUpdateTimer = null;

    // Process updates in parallel
    const updatePromises = updates.map(async ([key, record]) => {
      try {
        const cached = this.cache.get(key);
        if (cached && cached.isDirty) {
          // Calculate TTL based on window end time
          const windowEnd = record.firstRequestTime + this.globalConfig.ttl * 1000;
          const ttlSeconds = Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000));

          await this.storage.set(key, record, ttlSeconds);

          // Mark as clean
          cached.isDirty = false;
        }
      } catch (error) {
        // Log error but don't throw to prevent affecting other updates
        console.error(`Failed to update throttle record for key ${key}:`, error);
      }
    });

    await Promise.allSettled(updatePromises);
  }

  private async getThrottleRecord(key: string): Promise<ThrottleRecord | null> {
    const data = await this.storage.get(key);
    return data as ThrottleRecord | null;
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
    const headers = HeaderGeneratorUtil.generateThrottleHeaders({
      limit: config.limit,
      ttl: config.ttl,
      remaining,
      reset: new Date(resetTime),
    });

    if (remaining === 0) {
      headers["Retry-After"] = String(Math.ceil((resetTime - Date.now()) / 1000));
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
