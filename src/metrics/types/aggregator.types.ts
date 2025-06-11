export interface ITimeWindowAggregator {
  addMetric: (metric: IMetricData) => void;
  getTimeSeriesData: (
    metricName: string,
    labels: Record<string, string>,
    windowCount: number,
  ) => Array<{ timestamp: number; value: number; count: number }>;
  clear: () => void;
}

export interface IRollingWindowAggregator {
  addValue: (key: string, value: number) => void;
  getStatistics: (key: string) => IRollingStatistics | null;
  getAllKeys: () => string[];
  clearKey: (key: string) => void;
  clear: () => void;
}

export interface IPercentileAggregator {
  addValue: (key: string, value: number) => void;
  getPercentiles: (key: string, percentiles: number[]) => Record<string, number | null>;
  reset: (key: string) => void;
  resetAll: () => void;
}

export interface IMetricData {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export interface IRollingStatistics {
  count: number;
  sum: number;
  average: number;
  min: number | null;
  max: number | null;
  stdDev: number;
  rate: number;
  trend: "increasing" | "decreasing" | "stable";
  percentiles: {
    p50: number | null;
    p90: number | null;
    p95: number | null;
    p99: number | null;
  };
}

export interface IAggregatorFactory {
  createTimeWindowAggregator: (
    windowSize: number,
    maxWindows: number,
  ) => ITimeWindowAggregator | null;
  createRollingWindowAggregator: (windowSize: number) => IRollingWindowAggregator | null;
  createPercentileAggregator: () => IPercentileAggregator | null;
}

// Type-safe constructor interfaces
export interface TimeWindowAggregatorConstructor {
  new (windowSize: number, maxWindows: number): ITimeWindowAggregator;
}

export interface RollingWindowAggregatorConstructor {
  new (windowSize: number): IRollingWindowAggregator;
}

export interface PercentileAggregatorConstructor {
  new (): IPercentileAggregator;
}
