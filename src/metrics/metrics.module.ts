import type { Type, Provider, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { IMetricsConfig } from "../interfaces";
import { DI_TOKENS } from "../core/di-tokens";

// Import aggregators directly
import { TimeWindowAggregator, RollingWindowAggregator, PercentileAggregator } from "./aggregators";

// Import factories for collectors and exporters
import {
  StatsDCollector,
  PrometheusCollector,
  DatadogCollector,
  CustomMetricsCollector,
  CloudWatchCollector,
} from "./collectors";

import { PrometheusExporter, OpenMetricsExporter, JsonExporter } from "./exporters";

/**
 * Metrics Module with simplified, working DI patterns
 *
 * This module provides comprehensive metrics collection, aggregation, and export
 * capabilities with direct provider registration to avoid export validation issues.
 */
@Module({})
export class MetricsModule {
  /**
   * Configure the metrics module with the provided configuration
   *
   * @param config - Metrics configuration object
   * @returns Dynamic module with all necessary providers
   */
  static forRoot(config: IMetricsConfig): DynamicModule {
    const providers: Provider[] = [
      // Configuration provider
      {
        provide: DI_TOKENS.METRICS_CONFIG,
        useValue: config,
      },

      // Aggregator providers - directly provided for clean exports
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

      // Note: Legacy class-based providers removed to avoid export validation issues
      // Classes are accessible via Symbol-based DI tokens

      // Factory providers for dynamic creation
      {
        provide: DI_TOKENS.METRICS_COLLECTOR_FACTORY,
        useValue: {
          createPrometheus: (collectorConfig: any) => new PrometheusCollector(collectorConfig),
          createStatsd: (collectorConfig: any) => new StatsDCollector(collectorConfig),
          createDatadog: (collectorConfig: any) => new DatadogCollector(collectorConfig),
          createCloudWatch: (collectorConfig: any) => new CloudWatchCollector(collectorConfig),
          createCustom: (delegate: any) => new CustomMetricsCollector(delegate),
        },
      },

      {
        provide: DI_TOKENS.METRICS_EXPORTER_FACTORY,
        useValue: {
          createPrometheus: (collector: any) => new PrometheusExporter(collector),
          createJson: (collector: any) => new JsonExporter(collector),
          createOpenMetrics: (collector: any) => new OpenMetricsExporter(collector),
        },
      },
    ];

    // Add specific collector if metrics are enabled
    if (config.enabled) {
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
          providers.push({
            provide: DI_TOKENS.METRICS_COLLECTOR,
            useFactory: () =>
              new PrometheusCollector({
                ...collectorConfig,
                buckets: config.buckets,
                percentiles: config.percentiles,
              }),
          });
          break;

        case "statsd":
          providers.push({
            provide: DI_TOKENS.METRICS_COLLECTOR,
            useFactory: () => new StatsDCollector(collectorConfig),
          });
          break;

        case "datadog":
          providers.push({
            provide: DI_TOKENS.METRICS_COLLECTOR,
            useFactory: () => new DatadogCollector(collectorConfig),
          });
          break;

        case "cloudwatch":
          providers.push({
            provide: DI_TOKENS.METRICS_COLLECTOR,
            useFactory: () => new CloudWatchCollector(collectorConfig),
          });
          break;

        case "custom":
          if (config.customCollector) {
            providers.push({
              provide: DI_TOKENS.METRICS_COLLECTOR,
              useFactory: () => new CustomMetricsCollector(config.customCollector!),
            });
          }
          break;
      }

      // Add exporter based on type
      switch (config.type) {
        case "prometheus":
          providers.push({
            provide: DI_TOKENS.METRICS_EXPORTER,
            useFactory: (collector: PrometheusCollector) => new PrometheusExporter(collector),
            inject: [DI_TOKENS.METRICS_COLLECTOR],
          });
          break;

        default:
          providers.push({
            provide: DI_TOKENS.METRICS_EXPORTER,
            useFactory: (collector: any) => new JsonExporter(collector),
            inject: [DI_TOKENS.METRICS_COLLECTOR],
          });
          break;
      }

      // Add OpenMetrics exporter if collector exists
      providers.push({
        provide: DI_TOKENS.OPENMETRICS_EXPORTER,
        useFactory: (collector: any) => new OpenMetricsExporter(collector),
        inject: [DI_TOKENS.METRICS_COLLECTOR],
      });
    }

    const exports = [
      // Always export these tokens
      DI_TOKENS.METRICS_CONFIG,
      DI_TOKENS.METRICS_COLLECTOR_FACTORY,
      DI_TOKENS.METRICS_EXPORTER_FACTORY,

      // Export aggregator tokens since they're always provided
      DI_TOKENS.TIME_WINDOW_AGGREGATOR,
      DI_TOKENS.ROLLING_WINDOW_AGGREGATOR,
      DI_TOKENS.PERCENTILE_AGGREGATOR,
    ];

    // Conditionally export collector/exporter tokens only if they're provided
    if (config.enabled) {
      exports.push(
        DI_TOKENS.METRICS_COLLECTOR,
        DI_TOKENS.METRICS_EXPORTER,
        DI_TOKENS.OPENMETRICS_EXPORTER,
      );
    }

    return {
      global: true,
      module: MetricsModule,
      imports: [],
      providers,
      exports,
    };
  }

  /**
   * Configure the metrics module asynchronously
   *
   * @param options - Async configuration options
   * @param options.imports - Modules to import
   * @param options.useFactory - Factory function to create configuration
   * @param options.inject - Dependencies to inject into the factory
   * @returns Dynamic module with all necessary providers
   */
  static forRootAsync(options: {
    imports?: (Type | DynamicModule)[];
    useFactory?: (...args: unknown[]) => Promise<IMetricsConfig> | IMetricsConfig;
    inject?: (string | symbol | Type)[];
  }): DynamicModule {
    const asyncConfigProvider: Provider = {
      provide: "ASYNC_METRICS_CONFIG",
      useFactory: options.useFactory!,
      inject: options.inject || [],
    };

    return {
      global: true,
      module: MetricsModule,
      imports: options.imports || [],
      providers: [
        asyncConfigProvider,
        // Create config provider from async config
        {
          provide: DI_TOKENS.METRICS_CONFIG,
          useFactory: (config: IMetricsConfig) => config,
          inject: ["ASYNC_METRICS_CONFIG"],
        },

        // Always provide aggregators
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

        // Factory providers
        {
          provide: DI_TOKENS.METRICS_COLLECTOR_FACTORY,
          useValue: {
            createPrometheus: (collectorConfig: any) => new PrometheusCollector(collectorConfig),
            createStatsd: (collectorConfig: any) => new StatsDCollector(collectorConfig),
            createDatadog: (collectorConfig: any) => new DatadogCollector(collectorConfig),
            createCloudWatch: (collectorConfig: any) => new CloudWatchCollector(collectorConfig),
            createCustom: (delegate: any) => new CustomMetricsCollector(delegate),
          },
        },
        {
          provide: DI_TOKENS.METRICS_EXPORTER_FACTORY,
          useValue: {
            createPrometheus: (collector: any) => new PrometheusExporter(collector),
            createJson: (collector: any) => new JsonExporter(collector),
            createOpenMetrics: (collector: any) => new OpenMetricsExporter(collector),
          },
        },
      ],
      exports: [
        DI_TOKENS.METRICS_CONFIG,
        DI_TOKENS.METRICS_COLLECTOR_FACTORY,
        DI_TOKENS.METRICS_EXPORTER_FACTORY,
        DI_TOKENS.TIME_WINDOW_AGGREGATOR,
        DI_TOKENS.ROLLING_WINDOW_AGGREGATOR,
        DI_TOKENS.PERCENTILE_AGGREGATOR,
      ],
    };
  }
}
