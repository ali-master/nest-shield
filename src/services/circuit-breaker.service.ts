import { Injectable, Inject } from "@nestjs/common";
import * as CircuitBreaker from "opossum";
import type {
  IProtectionContext,
  ICircuitBreakerConfig,
} from "../interfaces/shield-config.interface";
import { DI_TOKENS } from "../core/di-tokens";
import { CircuitBreakerException } from "../core/exceptions";

interface CircuitBreakerInstance {
  breaker: CircuitBreaker;
  config: ICircuitBreakerConfig;
}

@Injectable()
export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreakerInstance> = new Map();
  private globalConfig: ICircuitBreakerConfig;

  constructor(@Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: any) {
    this.globalConfig = this.options.circuitBreaker || {};
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
      return existing.breaker;
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

    this.setupEventHandlers(breaker, key);

    if (mergedConfig.fallback) {
      breaker.fallback(mergedConfig.fallback);
    }

    const instance: CircuitBreakerInstance = {
      breaker,
      config: mergedConfig,
    };

    this.breakers.set(key, instance);
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

  private setupEventHandlers(breaker: CircuitBreaker, _key: string): void {
    breaker.on("fire", () => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.increment("circuit_breaker_fires", 1, { key });
    });

    breaker.on("success", (_result: any) => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.increment("circuit_breaker_successes", 1, { key });
    });

    breaker.on("failure", (_error: Error) => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.increment("circuit_breaker_failures", 1, { key });
    });

    breaker.on("timeout", () => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.increment("circuit_breaker_timeouts", 1, { key });
    });

    breaker.on("reject", () => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.increment("circuit_breaker_rejects", 1, { key });
    });

    breaker.on("open", () => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.gauge("circuit_breaker_state", 1, { key, state: "open" });
    });

    breaker.on("halfOpen", () => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.gauge("circuit_breaker_state", 0.5, { key, state: "half_open" });
    });

    breaker.on("close", () => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.gauge("circuit_breaker_state", 0, { key, state: "closed" });
    });

    breaker.on("fallback", (_data: any) => {
      // TODO: Re-enable metrics after DI issue is resolved
      // this.metricsService.increment("circuit_breaker_fallbacks", 1, { key });
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
}
