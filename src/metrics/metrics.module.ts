import type { Provider, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { BaseMetricsCollector } from "./collectors";
import {
  StatsDCollector,
  PrometheusCollector,
  DatadogCollector,
  CustomMetricsCollector,
  CloudWatchCollector,
} from "./collectors";
import { TimeWindowAggregator, RollingWindowAggregator, PercentileAggregator } from "./aggregators";
import { PrometheusExporter, JsonExporter } from "./exporters";
import { MetricsService } from "../services/metrics.service";
import type { IMetricsConfig } from "../interfaces/shield-config.interface";

@Module({})
export class MetricsModule {
  static forRoot(config: IMetricsConfig): DynamicModule {
    const providers: Provider[] = [
      {
        provide: "METRICS_CONFIG",
        useValue: config,
      },
      TimeWindowAggregator,
      RollingWindowAggregator,
      PercentileAggregator,
      MetricsService,
    ];

    // Add collector based on config
    if (config.enabled) {
      switch (config.type) {
        case "prometheus":
          providers.push({
            provide: "METRICS_COLLECTOR",
            useFactory: () =>
              new PrometheusCollector({
                type: "prometheus",
                prefix: config.prefix,
                labels: config.labels,
                buckets: config.buckets,
                percentiles: config.percentiles,
              }),
          });
          providers.push({
            provide: "METRICS_EXPORTER",
            useFactory: (collector: PrometheusCollector) => new PrometheusExporter(collector),
            inject: ["METRICS_COLLECTOR"],
          });
          break;

        case "statsd":
          providers.push({
            provide: "METRICS_COLLECTOR",
            useFactory: () =>
              new StatsDCollector({
                type: "statsd",
                prefix: config.prefix,
                labels: config.labels,
                flushInterval: config.flushInterval,
                maxBufferSize: config.maxBufferSize,
                ...config.collectorOptions,
              }),
          });
          break;

        case "datadog":
          providers.push({
            provide: "METRICS_COLLECTOR",
            useFactory: () =>
              new DatadogCollector({
                type: "datadog",
                prefix: config.prefix,
                labels: config.labels,
                flushInterval: config.flushInterval,
                maxBufferSize: config.maxBufferSize,
                ...config.collectorOptions,
              }),
          });
          break;

        case "cloudwatch":
          providers.push({
            provide: "METRICS_COLLECTOR",
            useFactory: () =>
              new CloudWatchCollector({
                type: "cloudwatch",
                prefix: config.prefix,
                labels: config.labels,
                flushInterval: config.flushInterval,
                ...config.collectorOptions,
              }),
          });
          break;

        case "custom":
          if (config.customCollector) {
            providers.push({
              provide: "METRICS_COLLECTOR",
              useFactory: () => new CustomMetricsCollector(config.customCollector!),
            });
          }
          break;
      }

      // Add JSON exporter for non-Prometheus collectors
      if (config.type !== "prometheus") {
        providers.push({
          provide: "METRICS_EXPORTER",
          useFactory: (collector: BaseMetricsCollector) => new JsonExporter(collector),
          inject: ["METRICS_COLLECTOR"],
        });
      }
    }

    return {
      module: MetricsModule,
      providers,
      exports: [
        MetricsService,
        TimeWindowAggregator,
        RollingWindowAggregator,
        PercentileAggregator,
        "METRICS_COLLECTOR",
        "METRICS_EXPORTER",
      ],
      global: true,
    };
  }
}
