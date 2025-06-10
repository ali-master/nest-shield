/**
 * Provider Factory
 *
 * Centralizes the creation of all providers with proper dependency injection patterns.
 * Follows senior NestJS standards for maintainable and scalable code.
 */

import type { Type, Provider } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
import type { IShieldConfig, IMetricsConfig } from "../interfaces";
import { DI_TOKENS } from "./di-tokens";
import { StorageFactory } from "../storage";

// Services
import {
  ThrottleService,
  RateLimitService,
  PriorityManagerService,
  OverloadService,
  MetricsService,
  GracefulShutdownService,
  DistributedSyncService,
  CircuitBreakerService,
  AnomalyDetectionService,
} from "../services";

// Guards and Interceptors
import { ShieldGuard } from "../guards/shield.guard";
import { OverloadReleaseInterceptor, CircuitBreakerInterceptor } from "../interceptors";

// Metrics system
import {
  TimeWindowAggregator,
  RollingWindowAggregator,
  PercentileAggregator,
} from "../metrics/aggregators";
import {
  StatsDCollector,
  PrometheusCollector,
  DatadogCollector,
  CustomMetricsCollector,
  CloudWatchCollector,
} from "../metrics/collectors";
import { PrometheusExporter, JsonExporter } from "../metrics/exporters";
import type { BaseMetricsCollector } from "../metrics/collectors";

// Factory interface for type safety
export interface IProviderFactory {
  createCoreProviders: () => Provider[];
  createStorageProvider: () => Provider;
  createServiceProviders: () => Provider[];
  createMetricsProviders: (config: IMetricsConfig) => Provider[];
  createGuardProviders: () => Provider[];
  createInterceptorProviders: () => Provider[];
  createAggregatorProviders: () => Provider[];
}

/**
 * Main provider factory implementing enterprise-grade DI patterns
 */
export class ProviderFactory implements IProviderFactory {
  /**
   * Creates all core providers required by the Shield module
   */
  createCoreProviders(): Provider[] {
    return [
      this.createStorageProvider(),
      ...this.createServiceProviders(),
      ...this.createGuardProviders(),
      ...this.createInterceptorProviders(),
      ...this.createAggregatorProviders(),
    ];
  }

  /**
   * Creates the storage provider with proper async initialization
   */
  createStorageProvider(): Provider {
    return {
      provide: DI_TOKENS.SHIELD_STORAGE,
      useFactory: async (config: IShieldConfig) => {
        return await StorageFactory.createAsync(config.storage || { type: "memory" });
      },
      inject: [DI_TOKENS.SHIELD_MODULE_OPTIONS],
    };
  }

  /**
   * Creates all service providers with proper dependency injection
   */
  createServiceProviders(): Provider[] {
    return [
      // Core protection services
      {
        provide: DI_TOKENS.METRICS_SERVICE,
        useClass: MetricsService,
      },
      {
        provide: DI_TOKENS.CIRCUIT_BREAKER_SERVICE,
        useClass: CircuitBreakerService,
      },
      {
        provide: DI_TOKENS.RATE_LIMIT_SERVICE,
        useClass: RateLimitService,
      },
      {
        provide: DI_TOKENS.THROTTLE_SERVICE,
        useClass: ThrottleService,
      },
      {
        provide: DI_TOKENS.OVERLOAD_SERVICE,
        useClass: OverloadService,
      },

      // Support services
      {
        provide: DI_TOKENS.PRIORITY_MANAGER_SERVICE,
        useClass: PriorityManagerService,
      },
      {
        provide: DI_TOKENS.DISTRIBUTED_SYNC_SERVICE,
        useClass: DistributedSyncService,
      },
      {
        provide: DI_TOKENS.ANOMALY_DETECTION_SERVICE,
        useClass: AnomalyDetectionService,
      },
      {
        provide: DI_TOKENS.GRACEFUL_SHUTDOWN_SERVICE,
        useClass: GracefulShutdownService,
      },

      // Legacy class-based providers for backward compatibility
      MetricsService,
      CircuitBreakerService,
      RateLimitService,
      ThrottleService,
      OverloadService,
      PriorityManagerService,
      DistributedSyncService,
      AnomalyDetectionService,
      GracefulShutdownService,
    ];
  }

  /**
   * Creates metrics system providers based on configuration
   */
  createMetricsProviders(config: IMetricsConfig): Provider[] {
    const providers: Provider[] = [
      {
        provide: DI_TOKENS.METRICS_CONFIG,
        useValue: config,
      },
      ...this.createAggregatorProviders(),
    ];

    if (!config.enabled) {
      return providers;
    }

    // Add collector based on type
    const collectorProvider = this.createMetricsCollectorProvider(config);
    if (collectorProvider) {
      providers.push(collectorProvider);
    }

    // Add exporter
    const exporterProvider = this.createMetricsExporterProvider(config);
    if (exporterProvider) {
      providers.push(exporterProvider);
    }

    return providers;
  }

  /**
   * Creates guard providers with proper global registration
   */
  createGuardProviders(): Provider[] {
    return [
      {
        provide: DI_TOKENS.SHIELD_GUARD,
        useClass: ShieldGuard,
      },
      {
        provide: APP_GUARD,
        useClass: ShieldGuard,
      },
      // Legacy class-based provider
      ShieldGuard,
    ];
  }

  /**
   * Creates interceptor providers with proper global registration
   */
  createInterceptorProviders(): Provider[] {
    return [
      {
        provide: DI_TOKENS.CIRCUIT_BREAKER_INTERCEPTOR,
        useClass: CircuitBreakerInterceptor,
      },
      {
        provide: DI_TOKENS.OVERLOAD_RELEASE_INTERCEPTOR,
        useClass: OverloadReleaseInterceptor,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: CircuitBreakerInterceptor,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: OverloadReleaseInterceptor,
      },
      // Legacy class-based providers
      CircuitBreakerInterceptor,
      OverloadReleaseInterceptor,
    ];
  }

  /**
   * Creates aggregator providers for metrics processing
   */
  createAggregatorProviders(): Provider[] {
    return [
      {
        provide: DI_TOKENS.TIME_WINDOW_AGGREGATOR,
        useClass: TimeWindowAggregator,
      },
      {
        provide: DI_TOKENS.ROLLING_WINDOW_AGGREGATOR,
        useClass: RollingWindowAggregator,
      },
      {
        provide: DI_TOKENS.PERCENTILE_AGGREGATOR,
        useClass: PercentileAggregator,
      },
      // Legacy class-based providers
      TimeWindowAggregator,
      RollingWindowAggregator,
      PercentileAggregator,
    ];
  }

  /**
   * Creates metrics collector provider based on configuration
   */
  private createMetricsCollectorProvider(config: IMetricsConfig): Provider | null {
    const collectorConfigs = {
      type: config.type,
      prefix: config.prefix,
      labels: config.labels,
      flushInterval: config.flushInterval,
      maxBufferSize: config.maxBufferSize,
      ...config.collectorOptions,
    };

    switch (config.type) {
      case "prometheus":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () =>
            new PrometheusCollector({
              ...collectorConfigs,
              buckets: config.buckets,
              percentiles: config.percentiles,
            }),
        };

      case "statsd":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () => new StatsDCollector(collectorConfigs),
        };

      case "datadog":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () => new DatadogCollector(collectorConfigs),
        };

      case "cloudwatch":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () => new CloudWatchCollector(collectorConfigs),
        };

      case "custom":
        if (config.customCollector) {
          return {
            provide: DI_TOKENS.METRICS_COLLECTOR,
            useFactory: () => new CustomMetricsCollector(config.customCollector!),
          };
        }
        break;
    }

    return null;
  }

  /**
   * Creates metrics exporter provider based on configuration
   */
  private createMetricsExporterProvider(config: IMetricsConfig): Provider | null {
    if (config.type === "prometheus") {
      return {
        provide: DI_TOKENS.METRICS_EXPORTER,
        useFactory: (collector: PrometheusCollector) => new PrometheusExporter(collector),
        inject: [DI_TOKENS.METRICS_COLLECTOR],
      };
    }

    // JSON exporter for other types
    return {
      provide: DI_TOKENS.METRICS_EXPORTER,
      useFactory: (collector: BaseMetricsCollector) => new JsonExporter(collector),
      inject: [DI_TOKENS.METRICS_COLLECTOR],
    };
  }
}

/**
 * Singleton instance for provider factory
 */
export const providerFactory = new ProviderFactory();

/**
 * Utility functions for creating specialized providers
 */
export const createConfigProvider = <T>(token: symbol, config: T): Provider => ({
  provide: token,
  useValue: config,
});

export const createFactoryProvider = <T>(
  token: symbol,
  factory: (...args: unknown[]) => T,
  inject: (string | symbol | Type)[] = [],
): Provider => ({
  provide: token,
  useFactory: factory,
  inject,
});

export const createClassProvider = <T>(token: symbol, useClass: Type<T>): Provider => ({
  provide: token,
  useClass,
});

export const createValueProvider = <T>(token: symbol, value: T): Provider => ({
  provide: token,
  useValue: value,
});

/**
 * Provider registry for tracking all created providers
 */
export class ProviderRegistry {
  private static readonly providers = new Map<symbol, Provider>();

  static register(token: symbol, provider: Provider): void {
    this.providers.set(token, provider);
  }

  static get(token: symbol): Provider | undefined {
    return this.providers.get(token);
  }

  static getAll(): Provider[] {
    return Array.from(this.providers.values());
  }

  static has(token: symbol): boolean {
    return this.providers.has(token);
  }

  static clear(): void {
    this.providers.clear();
  }
}
