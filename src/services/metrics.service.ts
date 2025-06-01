import { Injectable, Inject } from "@nestjs/common";
import { IMetricsConfig, IMetricsCollector } from "../interfaces/shield-config.interface";
import { SHIELD_MODULE_OPTIONS } from "../core/constants";

class NoOpMetricsCollector implements IMetricsCollector {
  increment(metric: string, value?: number, labels?: Record<string, string>): void {}
  decrement(metric: string, value?: number, labels?: Record<string, string>): void {}
  gauge(metric: string, value: number, labels?: Record<string, string>): void {}
  histogram(metric: string, value: number, labels?: Record<string, string>): void {}
  summary(metric: string, value: number, labels?: Record<string, string>): void {}
}

@Injectable()
export class MetricsService implements IMetricsCollector {
  private collector: IMetricsCollector;
  private config: IMetricsConfig;
  private prefix: string;

  constructor(@Inject(SHIELD_MODULE_OPTIONS) private readonly options: any) {
    this.config = this.options.metrics || { enabled: false };
    this.prefix = this.config.prefix || "nest_shield";

    if (!this.config.enabled) {
      this.collector = new NoOpMetricsCollector();
    } else if (this.config.customCollector) {
      this.collector = this.config.customCollector;
    } else {
      this.collector = this.createCollector();
    }
  }

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);
    this.collector.increment(metricName, value, mergedLabels);
  }

  decrement(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);
    this.collector.decrement(metricName, value, mergedLabels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);
    this.collector.gauge(metricName, value, mergedLabels);
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);
    this.collector.histogram(metricName, value, mergedLabels);
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);
    this.collector.summary(metricName, value, mergedLabels);
  }

  startTimer(metric: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.histogram(metric, duration / 1000, labels);
    };
  }

  private formatMetricName(metric: string): string {
    return `${this.prefix}_${metric}`;
  }

  private mergeLabels(labels?: Record<string, string>): Record<string, string> {
    return {
      ...this.config.labels,
      ...labels,
    };
  }

  private createCollector(): IMetricsCollector {
    switch (this.config.type) {
      case "prometheus":
        return this.createPrometheusCollector();
      case "statsd":
        return this.createStatsdCollector();
      default:
        return new NoOpMetricsCollector();
    }
  }

  private createPrometheusCollector(): IMetricsCollector {
    const metrics: Record<string, any> = {};

    return {
      increment: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "counter", value: 0, labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!metrics[metric].labels[labelKey]) {
          metrics[metric].labels[labelKey] = 0;
        }
        metrics[metric].labels[labelKey] += value;
      },

      decrement: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        this.increment(metric, -value, labels);
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
            buckets: this.config.buckets || [
              0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
            ],
            labels: {},
          };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!metrics[metric].labels[labelKey]) {
          metrics[metric].labels[labelKey] = [];
        }
        metrics[metric].labels[labelKey].push(value);
      },

      summary: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "summary", labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!metrics[metric].labels[labelKey]) {
          metrics[metric].labels[labelKey] = [];
        }
        metrics[metric].labels[labelKey].push(value);
      },
    };
  }

  private createStatsdCollector(): IMetricsCollector {
    const buffer: Array<{
      metric: string;
      value: number;
      type: string;
      labels?: Record<string, string>;
    }> = [];

    return {
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
    };
  }

  getCollector(): IMetricsCollector {
    return this.collector;
  }
}
