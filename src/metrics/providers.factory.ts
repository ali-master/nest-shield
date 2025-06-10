/**
 * Metrics Provider Factory
 *
 * Centralized factory for creating metrics-related providers with proper
 * dependency injection patterns following senior NestJS standards.
 */

import type { Provider } from "@nestjs/common";
import { DI_TOKENS } from "../core/di-tokens";
import type { IMetricsConfig } from "../interfaces/shield-config.interface";
import type { IMetricsCollector, ICollectorConfig } from "./interfaces/collector.interface";

// Aggregators
import { TimeWindowAggregator, RollingWindowAggregator, PercentileAggregator } from "./aggregators";

// Collectors
import type { BaseMetricsCollector } from "./collectors";
import {
  StatsDCollector,
  PrometheusCollector,
  DatadogCollector,
  CustomMetricsCollector,
  CloudWatchCollector,
} from "./collectors";

// Exporters
import { PrometheusExporter, OpenMetricsExporter, JsonExporter } from "./exporters";

// Service
import { MetricsService } from "../services/metrics.service";

/**
 * Factory interface for metrics providers
 */
export interface IMetricsProviderFactory {
  createAggregatorProviders: () => Provider[];
  createCollectorProvider: (config: IMetricsConfig) => Provider | null;
  createExporterProvider: (config: IMetricsConfig) => Provider | null;
  createServiceProviders: () => Provider[];
  createAllProviders: (config: IMetricsConfig) => Provider[];
}

/**
 * Metrics provider factory implementation
 */
export class MetricsProviderFactory implements IMetricsProviderFactory {
  /**
   * Creates aggregator providers with Symbol-based tokens
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

      // Legacy class-based providers for backward compatibility
      TimeWindowAggregator,
      RollingWindowAggregator,
      PercentileAggregator,
    ];
  }

  /**
   * Creates collector provider based on configuration
   */
  createCollectorProvider(config: IMetricsConfig): Provider | null {
    if (!config.enabled) {
      return null;
    }

    const collectorConfig = {
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
              ...collectorConfig,
              buckets: config.buckets,
              percentiles: config.percentiles,
            }),
        };

      case "statsd":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () => new StatsDCollector(collectorConfig),
        };

      case "datadog":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () => new DatadogCollector(collectorConfig),
        };

      case "cloudwatch":
        return {
          provide: DI_TOKENS.METRICS_COLLECTOR,
          useFactory: () => new CloudWatchCollector(collectorConfig),
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
   * Creates exporter provider based on configuration
   */
  createExporterProvider(config: IMetricsConfig): Provider | null {
    if (!config.enabled) {
      return null;
    }

    switch (config.type) {
      case "prometheus":
        return {
          provide: DI_TOKENS.METRICS_EXPORTER,
          useFactory: (collector: PrometheusCollector) => new PrometheusExporter(collector),
          inject: [DI_TOKENS.METRICS_COLLECTOR],
        };

      default:
        // JSON exporter for all other types
        return {
          provide: DI_TOKENS.METRICS_EXPORTER,
          useFactory: (collector: BaseMetricsCollector) => new JsonExporter(collector),
          inject: [DI_TOKENS.METRICS_COLLECTOR],
        };
    }
  }

  /**
   * Creates OpenMetrics exporter provider
   */
  createOpenMetricsExporterProvider(): Provider {
    return {
      provide: DI_TOKENS.OPENMETRICS_EXPORTER,
      useFactory: (collector: PrometheusCollector) => new OpenMetricsExporter(collector),
      inject: [DI_TOKENS.METRICS_COLLECTOR],
    };
  }

  /**
   * Creates service providers with proper dependency injection
   */
  createServiceProviders(): Provider[] {
    return [
      {
        provide: DI_TOKENS.METRICS_SERVICE,
        useClass: MetricsService,
      },

      // Legacy class-based provider for backward compatibility
      MetricsService,
    ];
  }

  /**
   * Creates collector factory provider for dynamic collector creation
   */
  createCollectorFactoryProvider(): Provider {
    return {
      provide: DI_TOKENS.METRICS_COLLECTOR_FACTORY,
      useFactory: () => ({
        createPrometheus: (config: ICollectorConfig) => new PrometheusCollector(config),
        createStatsd: (config: ICollectorConfig) => new StatsDCollector(config),
        createDatadog: (config: ICollectorConfig) => new DatadogCollector(config),
        createCloudWatch: (config: ICollectorConfig) => new CloudWatchCollector(config),
        createCustom: (delegate: IMetricsCollector) => new CustomMetricsCollector(delegate),
      }),
    };
  }

  /**
   * Creates exporter factory provider for dynamic exporter creation
   */
  createExporterFactoryProvider(): Provider {
    return {
      provide: DI_TOKENS.METRICS_EXPORTER_FACTORY,
      useFactory: () => ({
        createPrometheus: (collector: PrometheusCollector) => new PrometheusExporter(collector),
        createJson: (collector: BaseMetricsCollector) => new JsonExporter(collector),
        createOpenMetrics: (collector: PrometheusCollector) => new OpenMetricsExporter(collector),
      }),
    };
  }

  /**
   * Creates all providers for the metrics module
   */
  createAllProviders(config: IMetricsConfig): Provider[] {
    const providers: Provider[] = [
      // Configuration provider
      {
        provide: DI_TOKENS.METRICS_CONFIG,
        useValue: config,
      },

      // Core providers
      ...this.createAggregatorProviders(),
      ...this.createServiceProviders(),

      // Factory providers
      this.createCollectorFactoryProvider(),
      this.createExporterFactoryProvider(),
    ];

    // Add collector if enabled
    const collectorProvider = this.createCollectorProvider(config);
    if (collectorProvider) {
      providers.push(collectorProvider);
    }

    // Add exporter if enabled
    const exporterProvider = this.createExporterProvider(config);
    if (exporterProvider) {
      providers.push(exporterProvider);
    }

    // Add OpenMetrics exporter if collector exists
    if (collectorProvider) {
      providers.push(this.createOpenMetricsExporterProvider());
    }

    return providers;
  }
}

/**
 * Singleton instance for the metrics provider factory
 */
export const metricsProviderFactory = new MetricsProviderFactory();

/**
 * Utility functions for creating specialized metrics providers
 */
export const createMetricsConfigProvider = (config: IMetricsConfig): Provider => ({
  provide: DI_TOKENS.METRICS_CONFIG,
  useValue: config,
});

export const createCollectorProvider = <T>(
  token: symbol,
  collectorClass: new (...args: unknown[]) => T,
): Provider => ({
  provide: token,
  useClass: collectorClass,
});

export const createExporterProvider = <T>(
  token: symbol,
  exporterClass: new (...args: unknown[]) => T,
): Provider => ({
  provide: token,
  useClass: exporterClass,
});

/**
 * Provider groups for easy exports
 */
export const METRICS_EXPORTS = [
  // Core service tokens
  DI_TOKENS.METRICS_SERVICE,
  DI_TOKENS.METRICS_CONFIG,

  // Aggregator tokens
  DI_TOKENS.TIME_WINDOW_AGGREGATOR,
  DI_TOKENS.ROLLING_WINDOW_AGGREGATOR,
  DI_TOKENS.PERCENTILE_AGGREGATOR,

  // Collector and exporter tokens
  DI_TOKENS.METRICS_COLLECTOR,
  DI_TOKENS.METRICS_EXPORTER,
  DI_TOKENS.OPENMETRICS_EXPORTER,

  // Factory tokens
  DI_TOKENS.METRICS_COLLECTOR_FACTORY,
  DI_TOKENS.METRICS_EXPORTER_FACTORY,

  // Legacy exports for backward compatibility
  "MetricsService",
  "TimeWindowAggregator",
  "RollingWindowAggregator",
  "PercentileAggregator",
  "METRICS_COLLECTOR",
  "METRICS_EXPORTER",
];
