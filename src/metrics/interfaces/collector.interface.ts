import type { IMetric } from "./metrics.interface";

export interface IMetricsCollector {
  increment: (metric: string, value?: number, labels?: Record<string, string>) => void;
  decrement: (metric: string, value?: number, labels?: Record<string, string>) => void;
  gauge: (metric: string, value: number, labels?: Record<string, string>) => void;
  histogram: (metric: string, value: number, labels?: Record<string, string>) => void;
  summary: (metric: string, value: number, labels?: Record<string, string>) => void;
}

export interface ICollectorConfig {
  type: "prometheus" | "statsd" | "custom" | "cloudwatch" | "datadog";
  prefix?: string;
  labels?: Record<string, string>;
  buckets?: number[];
  percentiles?: number[];
  flushInterval?: number;
  maxBufferSize?: number;
}

export interface IMetricBuffer {
  add: (metric: IMetric) => void;
  flush: () => IMetric[];
  size: () => number;
  clear: () => void;
}
