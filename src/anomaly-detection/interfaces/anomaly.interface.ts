export interface IAnomalyData {
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
  labels?: Record<string, string>;
  source?: string;
}

export interface IAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number; // 0-1, how anomalous it is
  confidence: number; // 0-1, confidence in the detection
  timestamp: number;
  data: IAnomalyData;
  description: string;
  expectedValue?: number;
  actualValue: number;
  deviation: number; // how far from expected
  context: IAnomalyContext;
  resolved?: boolean;
  resolvedAt?: number;
  falsePositive?: boolean;
}

export enum AnomalyType {
  SPIKE = "spike",
  DROP = "drop",
  TREND_CHANGE = "trend_change",
  SEASONAL_DEVIATION = "seasonal_deviation",
  OUTLIER = "outlier",
  PATTERN_BREAK = "pattern_break",
  THRESHOLD_BREACH = "threshold_breach",
  FREQUENCY_ANOMALY = "frequency_anomaly",
  CORRELATION_BREAK = "correlation_break",
}

export enum AnomalySeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface IAnomalyContext {
  metric: string;
  labels?: Record<string, string>;
  windowSize: number;
  algorithm: string;
  threshold: number;
  historicalMean?: number;
  historicalStdDev?: number;
  seasonalPattern?: number[];
  trendDirection?: "increasing" | "decreasing" | "stable";
  correlatedMetrics?: string[];
  businessContext?: IBusinessContext;
}

export interface IBusinessContext {
  service: string;
  component: string;
  impact: BusinessImpact;
  criticality: BusinessCriticality;
  sla?: {
    target: number;
    unit: string;
    breachThreshold: number;
  };
  dependencies?: string[];
  escalationPolicy?: IEscalationPolicy;
}

export enum BusinessImpact {
  NONE = "none",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum BusinessCriticality {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface IEscalationPolicy {
  immediate: string[];
  after5min: string[];
  after15min: string[];
  after30min: string[];
  after1hour: string[];
}

export interface IAnomalyPattern {
  name: string;
  description: string;
  detector: string;
  conditions: IPatternCondition[];
  severity: AnomalySeverity;
  autoResolve?: boolean;
  suppressionRules?: ISuppressionRule[];
}

export interface IPatternCondition {
  metric: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "between" | "outside";
  value: number | [number, number];
  timeWindow: number;
  aggregation: "avg" | "sum" | "count" | "min" | "max" | "p95" | "p99";
}

export interface ISuppressionRule {
  name: string;
  condition: string; // Expression like "maintenance_mode === true"
  duration: number; // How long to suppress in ms
  reason: string;
}
