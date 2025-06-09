import { Injectable } from "@nestjs/common";
import type { IMetricsCollector, ICollectorConfig } from "../interfaces/collector.interface";
import type { IMetric } from "../interfaces/metrics.interface";
import { MetricType } from "../interfaces/metrics.interface";

@Injectable()
export abstract class BaseMetricsCollector implements IMetricsCollector {
  protected metrics: Map<string, IMetric> = new Map();
  protected config: ICollectorConfig;

  constructor(config: ICollectorConfig) {
    this.config = config;
  }

  protected createMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((key) => `${key}="${labels[key]}"`)
      .join(",");
    return `${name}{${sortedLabels}}`;
  }

  protected getOrCreateMetric(
    name: string,
    type: MetricType,
    labels?: Record<string, string>,
  ): IMetric {
    const key = this.createMetricKey(name, labels);
    let metric = this.metrics.get(key);

    if (!metric) {
      metric = {
        name,
        type,
        value: 0,
        timestamp: Date.now(),
        labels,
      };
      this.metrics.set(key, metric);
    }

    return metric;
  }

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const m = this.getOrCreateMetric(metric, MetricType.COUNTER, labels);
    m.value += value;
    m.timestamp = Date.now();
  }

  decrement(metric: string, value: number = 1, labels?: Record<string, string>): void {
    this.increment(metric, -value, labels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    const m = this.getOrCreateMetric(metric, MetricType.GAUGE, labels);
    m.value = value;
    m.timestamp = Date.now();
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    const m = this.getOrCreateMetric(metric, MetricType.HISTOGRAM, labels) as any;

    if (!m.values) {
      m.values = [];
      m.sum = 0;
      m.count = 0;
    }

    m.values.push(value);
    m.sum += value;
    m.count++;
    m.timestamp = Date.now();
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    const m = this.getOrCreateMetric(metric, MetricType.SUMMARY, labels) as any;

    if (!m.values) {
      m.values = [];
      m.sum = 0;
      m.count = 0;
    }

    m.values.push(value);
    m.sum += value;
    m.count++;
    m.timestamp = Date.now();
  }

  getMetrics(): Map<string, IMetric> {
    return this.metrics;
  }

  reset(): void {
    this.metrics.clear();
  }

  abstract flush(): Promise<void>;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
}
