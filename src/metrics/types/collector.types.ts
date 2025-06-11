import type { IMetricsCollector } from "../../interfaces";

export interface IEnhancedMetricsCollector extends IMetricsCollector {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  reset?: () => void;
  flush?: () => Promise<void>;
  getMetrics?: () => Record<string, unknown>;
}

export interface ICollectorConfig {
  type: CollectorType;
  prefix: string;
  labels?: Record<string, string>;
  buckets?: number[];
  percentiles?: number[];
  flushInterval?: number;
  maxBufferSize?: number;
  [key: string]: unknown;
}

export interface IPrometheusCollector extends IEnhancedMetricsCollector {
  register: unknown;
}

export interface IStatsDCollector extends IEnhancedMetricsCollector {
  client: unknown;
}

export interface IDatadogCollector extends IEnhancedMetricsCollector {
  dogstatsd: unknown;
}

export interface ICloudWatchCollector extends IEnhancedMetricsCollector {
  cloudwatch: unknown;
}

export interface ICustomMetricsCollector extends IEnhancedMetricsCollector {
  customImplementation: unknown;
}

export interface IBaseMetricsCollector extends IEnhancedMetricsCollector {
  // Base implementation that other collectors extend
}

export interface ICollectorFactory {
  createPrometheusCollector: (config: ICollectorConfig) => IPrometheusCollector | null;
  createStatsDCollector: (config: ICollectorConfig) => IStatsDCollector | null;
  createDatadogCollector: (config: ICollectorConfig) => IDatadogCollector | null;
  createCloudWatchCollector: (config: ICollectorConfig) => ICloudWatchCollector | null;
  createCustomCollector: (config: ICollectorConfig) => ICustomMetricsCollector | null;
}

// Type-safe constructor interfaces
export interface PrometheusCollectorConstructor {
  new (config: ICollectorConfig): IPrometheusCollector;
}

export interface StatsDCollectorConstructor {
  new (config: ICollectorConfig): IStatsDCollector;
}

export interface DatadogCollectorConstructor {
  new (config: ICollectorConfig): IDatadogCollector;
}

export interface CloudWatchCollectorConstructor {
  new (config: ICollectorConfig): ICloudWatchCollector;
}

export interface CustomCollectorConstructor {
  new (config: ICollectorConfig): ICustomMetricsCollector;
}

export type CollectorType =
  | "prometheus"
  | "statsd"
  | "datadog"
  | "cloudwatch"
  | "custom"
  | "json"
  | "openmetrics";

export interface IMetricStorage {
  type: string;
  value?: number;
  labels: Record<string, number | number[]>;
}

export interface IPrometheusMetricStorage extends IMetricStorage {
  type: "counter" | "gauge" | "histogram" | "summary";
  buckets?: number[];
}

export interface IStatsDMetricStorage {
  metric: string;
  value: number;
  type: "c" | "g" | "h" | "ms";
  labels?: Record<string, string>;
}
