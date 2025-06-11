import type { IMetricsConfig } from "../../interfaces";

export interface IEnhancedMetricsConfig extends IMetricsConfig {
  windowSize?: number;
  maxWindows?: number;
  rollingWindowSize?: number;
  includeTimestamp?: boolean;
  includeHelp?: boolean;
  groupByName?: boolean;
  collectorOptions?: Record<string, unknown>;
}

export interface IAnomalyDetectionConfig {
  enabled: boolean;
  thresholds?: {
    zScoreThreshold?: number;
    minimumDataPoints?: number;
  };
  [key: string]: unknown;
}

export interface IMetricsHealth {
  status: "healthy" | "unhealthy";
  details: {
    collectorType?: string;
    enabled: boolean;
    enhancedMode: boolean;
    lastUpdate: number;
    anomalyDetectionEnabled: boolean;
    metricsCount?: number;
    error?: string;
  };
}

export interface IAnomalyData {
  metricName: string;
  value: number;
  labels: Record<string, string>;
  type: string;
}

export interface IAnomaly {
  data: IAnomalyData;
  severity: "low" | "medium" | "high";
  score: number;
  type: "statistical" | "pattern" | "threshold";
  detector: string;
  description: string;
  timestamp: number;
}

export interface IMetricTimer {
  start: () => number;
  end: () => number;
}

export interface IMetricsServiceOptions {
  metrics?: IEnhancedMetricsConfig;
  advanced?: {
    adaptiveProtection?: {
      anomalyDetection?: IAnomalyDetectionConfig;
    };
  };
}

export type MetricType = "counter" | "gauge" | "histogram" | "summary";
export type MetricLabels = Record<string, string>;
export type MetricValue = number;

export interface IMetricEntry {
  name: string;
  type: MetricType;
  value: MetricValue;
  labels: MetricLabels;
  timestamp: number;
}
