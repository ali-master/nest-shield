import { OnModuleDestroy, Injectable } from "@nestjs/common";
import * as CircuitBreaker from "opossum";
import type {
  IProtectionContext,
  ICircuitBreakerConfig,
} from "../interfaces/shield-config.interface";
import {
  InjectShieldLogger,
  InjectShieldConfig,
  InjectMetrics,
} from "../core/injection.decorators";
import { CircuitBreakerException } from "../core/exceptions";
import type { ShieldLoggerService, MetricsService } from "./";

interface CircuitBreakerInstance {
  breaker: CircuitBreaker;
  config: ICircuitBreakerConfig;
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly breakers: Map<string, CircuitBreakerInstance> = new Map();
  private readonly breakerAccessTimes = new Map<string, number>();
  private readonly globalConfig: ICircuitBreakerConfig;
  private readonly MAX_BREAKERS = 1000; // Prevent memory leaks
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectShieldConfig() private readonly options: any,
    @InjectMetrics() private readonly metricsService: MetricsService,
    @InjectShieldLogger() private readonly logger: ShieldLoggerService,
  ) {
    this.globalConfig = this.options.circuitBreaker || {};

    // Start periodic cleanup to prevent memory leaks
    this.startCleanupTimer();
  }

  createBreaker(
    key: string,
    handler: Function,
    config?: Partial<ICircuitBreakerConfig>,
  ): CircuitBreaker {
    const mergedConfig = { ...this.globalConfig, ...config };

    if (!mergedConfig.enabled) {
      return this.createPassthroughBreaker(handler);
    }

    const existing = this.breakers.get(key);
    if (existing) {
      // Update access time for LRU cleanup
      this.breakerAccessTimes.set(key, Date.now());
      return existing.breaker;
    }

    // Check if we need to clean up before creating new breaker
    if (this.breakers.size >= this.MAX_BREAKERS) {
      this.cleanupOldBreakers();
    }

    const breakerOptions: CircuitBreaker.Options = {
      timeout: mergedConfig.timeout || 3000,
      errorThresholdPercentage: mergedConfig.errorThresholdPercentage || 50,
      resetTimeout: mergedConfig.resetTimeout || 30000,
      rollingCountTimeout: mergedConfig.rollingCountTimeout || 10000,
      rollingCountBuckets: mergedConfig.rollingCountBuckets || 10,
      volumeThreshold: mergedConfig.volumeThreshold || 20,
      allowWarmUp: mergedConfig.allowWarmUp || false,
      enabled: true,
    };

    const breaker = new CircuitBreaker(handler, breakerOptions);

    // Use async event handler setup to avoid blocking
    setImmediate(() => this.setupEventHandlers(breaker, key));

    if (mergedConfig.fallback) {
      breaker.fallback(mergedConfig.fallback);
    }

    const instance: CircuitBreakerInstance = {
      breaker,
      config: mergedConfig,
    };

    this.breakers.set(key, instance);
    this.breakerAccessTimes.set(key, Date.now());
    return breaker;
  }

  async execute<T>(
    key: string,
    handler: () => Promise<T>,
    context: IProtectionContext,
    config?: Partial<ICircuitBreakerConfig>,
  ): Promise<T> {
    const breaker = this.createBreaker(key, handler, config);

    try {
      const result = await breaker.fire(context);
      return result as T;
    } catch (error) {
      if (error instanceof Error && error.message === "Breaker is open") {
        throw new CircuitBreakerException("Circuit breaker is OPEN", {
          key,
          state: "open",
          stats: this.getStats(key),
        });
      }
      throw error;
    }
  }

  getBreaker(key: string): CircuitBreaker | undefined {
    return this.breakers.get(key)?.breaker;
  }

  getStats(key: string): CircuitBreaker.Stats | undefined {
    const breaker = this.breakers.get(key)?.breaker;
    return breaker?.stats;
  }

  getAllStats(): Record<string, CircuitBreaker.Stats> {
    const stats: Record<string, CircuitBreaker.Stats> = {};

    for (const [key, instance] of this.breakers) {
      const breakerStats = instance.breaker.stats;
      if (breakerStats) {
        stats[key] = breakerStats;
      }
    }

    return stats;
  }

  async healthCheck(key: string): Promise<boolean> {
    const instance = this.breakers.get(key);
    if (!instance) return true;

    const { breaker, config } = instance;

    if (config.healthCheck) {
      try {
        return await config.healthCheck();
      } catch {
        return false;
      }
    }

    return !breaker.opened;
  }

  reset(key: string): void {
    const breaker = this.breakers.get(key)?.breaker;
    if (breaker && breaker.opened) {
      breaker.close();
    }
  }

  resetAll(): void {
    for (const [key] of this.breakers) {
      this.reset(key);
    }
  }

  disable(key: string): void {
    const breaker = this.breakers.get(key)?.breaker;
    if (breaker) {
      breaker.disable();
    }
  }

  enable(key: string): void {
    const breaker = this.breakers.get(key)?.breaker;
    if (breaker) {
      breaker.enable();
    }
  }

  private createPassthroughBreaker(handler: Function): any {
    return {
      fire: (...args: any[]) => handler(...args),
      opened: false,
      stats: {
        fires: 0,
        failures: 0,
        successes: 0,
        timeouts: 0,
        cacheHits: 0,
        cacheMisses: 0,
        rejects: 0,
        fallbacks: 0,
        latencyMean: 0,
      },
      fallback: () => {},
      on: () => {},
      disable: () => {},
      enable: () => {},
      close: () => {},
    };
  }

  private setupEventHandlers(breaker: CircuitBreaker, key: string): void {
    // Use async metrics and logging to avoid blocking circuit breaker operations
    breaker.on("fire", () => {
      setImmediate(() => {
        this.metricsService.increment("circuit_breaker_fires", 1, { key });
        this.logger.circuitBreakerDebug(`Circuit breaker fired`, {
          operation: "fire",
          metadata: { key },
        });
      });
    });

    breaker.on("success", (_result: any) => {
      setImmediate(() => {
        this.metricsService.increment("circuit_breaker_successes", 1, { key });
        this.logger.circuitBreakerDebug(`Circuit breaker success`, {
          operation: "success",
          metadata: { key },
        });
      });
    });

    breaker.on("failure", (error: Error) => {
      setImmediate(() => {
        this.metricsService.increment("circuit_breaker_failures", 1, { key });
        this.logger.circuitBreakerWarn(`Circuit breaker failure`, {
          operation: "failure",
          metadata: { key, error: error.message },
        });
      });
    });

    breaker.on("timeout", () => {
      setImmediate(() => {
        this.metricsService.increment("circuit_breaker_timeouts", 1, { key });
        this.logger.circuitBreakerWarn(`Circuit breaker timeout`, {
          operation: "timeout",
          metadata: { key },
        });
      });
    });

    breaker.on("reject", () => {
      setImmediate(() => {
        this.metricsService.increment("circuit_breaker_rejects", 1, { key });
        this.logger.circuitBreakerWarn(`Circuit breaker rejected request`, {
          operation: "reject",
          metadata: { key },
        });
      });
    });

    breaker.on("open", () => {
      setImmediate(() => {
        this.metricsService.gauge("circuit_breaker_state", 1, { key, state: "open" });
        this.logger.circuitBreaker(`Circuit breaker opened`, {
          operation: "state_change",
          metadata: { key, state: "open" },
        });
      });
    });

    breaker.on("halfOpen", () => {
      setImmediate(() => {
        this.metricsService.gauge("circuit_breaker_state", 0.5, { key, state: "half_open" });
        this.logger.circuitBreaker(`Circuit breaker half-opened`, {
          operation: "state_change",
          metadata: { key, state: "half_open" },
        });
      });
    });

    breaker.on("close", () => {
      setImmediate(() => {
        this.metricsService.gauge("circuit_breaker_state", 0, { key, state: "closed" });
        this.logger.circuitBreaker(`Circuit breaker closed`, {
          operation: "state_change",
          metadata: { key, state: "closed" },
        });
      });
    });

    breaker.on("fallback", (_data: any) => {
      setImmediate(() => {
        this.metricsService.increment("circuit_breaker_fallbacks", 1, { key });
        this.logger.circuitBreaker(`Circuit breaker fallback executed`, {
          operation: "fallback",
          metadata: { key },
        });
      });
    });
  }

  getState(key: string): "open" | "closed" | "half-open" | "disabled" | undefined {
    const breaker = this.breakers.get(key)?.breaker;
    if (!breaker) return undefined;

    if (!breaker.enabled) return "disabled";
    if (breaker.opened) return breaker.halfOpen ? "half-open" : "open";
    return "closed";
  }

  async warmUp(key: string, requests: number = 10): Promise<void> {
    const instance = this.breakers.get(key);
    if (!instance || !instance.config.allowWarmUp) return;

    const { breaker } = instance;
    const dummyHandler = async () => true;

    for (let i = 0; i < requests; i++) {
      try {
        await breaker.fire(dummyHandler);
      } catch {
        // Ignore warm-up errors
      }
    }
  }

  /**
   * Start cleanup timer to prevent memory leaks
   */
  private startCleanupTimer(): void {
    // Clean up every 5 minutes
    this.cleanupTimer = setInterval(
      () => {
        this.cleanupOldBreakers();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Clean up old, unused circuit breakers to prevent memory leaks
   */
  private cleanupOldBreakers(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    const keysToRemove: string[] = [];

    // Find old breakers (LRU based on access time)
    for (const [key, accessTime] of this.breakerAccessTimes.entries()) {
      if (now - accessTime > maxAge) {
        keysToRemove.push(key);
      }
    }

    // If still too many, remove oldest ones
    if (this.breakers.size > this.MAX_BREAKERS) {
      const sortedByAge = Array.from(this.breakerAccessTimes.entries())
        .sort(([, a], [, b]) => a - b) // Oldest first
        .slice(0, Math.floor(this.MAX_BREAKERS * 0.2)) // Remove 20%
        .map(([key]) => key);

      keysToRemove.push(...sortedByAge);
    }

    // Remove breakers and clean up event listeners
    keysToRemove.forEach((key) => {
      const instance = this.breakers.get(key);
      if (instance) {
        try {
          // Remove all event listeners to prevent memory leaks
          instance.breaker.removeAllListeners();
          instance.breaker.disable();
        } catch {
          // Ignore errors during cleanup
        }
      }
      this.breakers.delete(key);
      this.breakerAccessTimes.delete(key);
    });

    if (keysToRemove.length > 0) {
      this.logger.circuitBreakerDebug(`Cleaned up ${keysToRemove.length} old circuit breakers`, {
        operation: "cleanup",
        metadata: { removedCount: keysToRemove.length, totalRemaining: this.breakers.size },
      });
    }
  }

  /**
   * Clean up resources on service destruction
   */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clean up all breakers
    for (const [, instance] of this.breakers) {
      try {
        instance.breaker.removeAllListeners();
        instance.breaker.disable();
      } catch {
        // Ignore errors during cleanup
      }
    }

    this.breakers.clear();
    this.breakerAccessTimes.clear();
  }
}
