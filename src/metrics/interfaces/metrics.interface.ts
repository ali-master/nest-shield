export interface IMetric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  description?: string;
  unit?: string;
}

export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram",
  SUMMARY = "summary",
}

export interface ICounterMetric extends IMetric {
  type: MetricType.COUNTER;
  increment?: number;
}

export interface IGaugeMetric extends IMetric {
  type: MetricType.GAUGE;
}

export interface IHistogramMetric extends IMetric {
  type: MetricType.HISTOGRAM;
  buckets?: number[];
  sum?: number;
  count?: number;
}

export interface ISummaryMetric extends IMetric {
  type: MetricType.SUMMARY;
  quantiles?: Record<number, number>;
  sum?: number;
  count?: number;
}

export interface IMetricOptions {
  name: string;
  help?: string;
  labelNames?: string[];
  buckets?: number[];
  percentiles?: number[];
  maxAge?: number;
  ageBuckets?: number;
}

export interface IMetricRegistry {
  register: (metric: IMetric) => void;
  unregister: (name: string) => void;
  get: (name: string) => IMetric | undefined;
  getAll: () => IMetric[];
  clear: () => void;
  collect: () => Promise<IMetric[]>;
}
