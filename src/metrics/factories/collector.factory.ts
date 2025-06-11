import { OnModuleInit, Injectable } from "@nestjs/common";
import type { IMetricsCollector } from "../../interfaces";
import type {
  StatsDCollectorConstructor,
  PrometheusCollectorConstructor,
  IStatsDMetricStorage,
  IStatsDCollector,
  IPrometheusMetricStorage,
  IPrometheusCollector,
  IDatadogCollector,
  ICustomMetricsCollector,
  ICollectorFactory,
  ICollectorConfig,
  ICloudWatchCollector,
  DatadogCollectorConstructor,
  CustomCollectorConstructor,
  CloudWatchCollectorConstructor,
} from "../types";

export class NoOpMetricsCollector implements IMetricsCollector {
  increment(): void {}
  decrement(): void {}
  gauge(): void {}
  histogram(): void {}
  summary(): void {}
}

@Injectable()
export class CollectorFactoryService implements ICollectorFactory, OnModuleInit {
  private prometheusCollectorClass: PrometheusCollectorConstructor | null = null;
  private statsDCollectorClass: StatsDCollectorConstructor | null = null;
  private datadogCollectorClass: DatadogCollectorConstructor | null = null;
  private cloudWatchCollectorClass: CloudWatchCollectorConstructor | null = null;
  private customCollectorClass: CustomCollectorConstructor | null = null;
  private initialized = false;

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const collectors = await import("../collectors");
      // Use unknown first to safely cast
      this.prometheusCollectorClass =
        collectors.PrometheusCollector as unknown as PrometheusCollectorConstructor;
      this.statsDCollectorClass =
        collectors.StatsDCollector as unknown as StatsDCollectorConstructor;
      this.datadogCollectorClass =
        collectors.DatadogCollector as unknown as DatadogCollectorConstructor;
      this.cloudWatchCollectorClass =
        collectors.CloudWatchCollector as unknown as CloudWatchCollectorConstructor;
      this.customCollectorClass =
        collectors.CustomMetricsCollector as unknown as CustomCollectorConstructor;
      this.initialized = true;
    } catch {
      // Enhanced collectors not available
      this.initialized = true; // Mark as initialized even if components aren't available
    }
  }

  createPrometheusCollector(config: ICollectorConfig): IPrometheusCollector | null {
    if (this.prometheusCollectorClass) {
      try {
        // eslint-disable-next-line new-cap
        return new this.prometheusCollectorClass(config);
      } catch {
        return null;
      }
    }
    // Fallback to basic Prometheus collector
    return this.createBasicPrometheusCollector(config);
  }

  createStatsDCollector(config: ICollectorConfig): IStatsDCollector | null {
    if (this.statsDCollectorClass) {
      try {
        // eslint-disable-next-line new-cap
        return new this.statsDCollectorClass(config);
      } catch {
        return null;
      }
    }
    // Fallback to basic StatsD collector
    return this.createBasicStatsDCollector(config);
  }

  createDatadogCollector(config: ICollectorConfig): IDatadogCollector | null {
    if (!this.datadogCollectorClass) {
      return null;
    }
    try {
      // eslint-disable-next-line new-cap
      return new this.datadogCollectorClass(config);
    } catch {
      return null;
    }
  }

  createCloudWatchCollector(config: ICollectorConfig): ICloudWatchCollector | null {
    if (!this.cloudWatchCollectorClass) {
      return null;
    }
    try {
      // eslint-disable-next-line new-cap
      return new this.cloudWatchCollectorClass(config);
    } catch {
      return null;
    }
  }

  createCustomCollector(config: ICollectorConfig): ICustomMetricsCollector | null {
    if (!this.customCollectorClass) {
      return null;
    }
    try {
      // eslint-disable-next-line new-cap
      return new this.customCollectorClass(config);
    } catch {
      return null;
    }
  }

  private createBasicPrometheusCollector(config: ICollectorConfig): IPrometheusCollector | null {
    const metrics: Record<string, IPrometheusMetricStorage> = {};

    return {
      register: null, // Basic implementation doesn't have a register
      increment: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "counter", value: 0, labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        if (typeof metrics[metric].labels[labelKey] !== "number") {
          metrics[metric].labels[labelKey] = 0;
        }
        (metrics[metric].labels[labelKey] as number) += value;
      },

      decrement: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        const collector = this.createBasicPrometheusCollector(config);
        if (collector) {
          collector.increment(metric, -value, labels);
        }
      },

      gauge: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "gauge", labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        metrics[metric].labels[labelKey] = value;
      },

      histogram: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = {
            type: "histogram",
            buckets: config.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            labels: {},
          };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!Array.isArray(metrics[metric].labels[labelKey])) {
          metrics[metric].labels[labelKey] = [];
        }
        (metrics[metric].labels[labelKey] as number[]).push(value);
      },

      summary: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "summary", labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!Array.isArray(metrics[metric].labels[labelKey])) {
          metrics[metric].labels[labelKey] = [];
        }
        (metrics[metric].labels[labelKey] as number[]).push(value);
      },

      getMetrics: () => metrics,
    } as IPrometheusCollector;
  }

  private createBasicStatsDCollector(_config: ICollectorConfig): IStatsDCollector | null {
    const buffer: IStatsDMetricStorage[] = [];

    return {
      client: null, // Basic implementation doesn't have a client
      increment: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "c", labels });
      },

      decrement: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        buffer.push({ metric, value: -value, type: "c", labels });
      },

      gauge: (metric: string, value: number, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "g", labels });
      },

      histogram: (metric: string, value: number, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "h", labels });
      },

      summary: (metric: string, value: number, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "ms", labels });
      },

      getMetrics: () => ({ buffer }),
    } as IStatsDCollector;
  }

  isAvailable(): boolean {
    return !!(
      this.prometheusCollectorClass ||
      this.statsDCollectorClass ||
      this.datadogCollectorClass ||
      this.cloudWatchCollectorClass ||
      this.customCollectorClass
    );
  }
}
