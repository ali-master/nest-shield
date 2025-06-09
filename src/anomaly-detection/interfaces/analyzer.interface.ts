import type { IAnomalyData, IAnomaly } from "./anomaly.interface";

export interface IAnomalyAnalyzer {
  analyze: (anomalies: IAnomaly[]) => Promise<IAnalysisResult>;
  generateInsights: (anomalies: IAnomaly[], historicalData: IAnomalyData[]) => Promise<IInsight[]>;
  predictImpact: (anomaly: IAnomaly) => Promise<IImpactPrediction>;
  recommendActions: (anomaly: IAnomaly) => Promise<IActionRecommendation[]>;
}

export interface IAnalysisResult {
  summary: IAnalysisSummary;
  patterns: IDetectedPattern[];
  correlations: ICorrelationResult[];
  timeSeriesAnalysis: ITimeSeriesAnalysis;
  seasonalAnalysis?: ISeasonalAnalysis;
  rootCauseAnalysis?: IRootCauseAnalysis;
  recommendations: IActionRecommendation[];
  confidence: number;
  analysisTimestamp: number;
}

export interface IAnalysisSummary {
  totalAnomalies: number;
  criticalAnomalies: number;
  highSeverityAnomalies: number;
  mediumSeverityAnomalies: number;
  lowSeverityAnomalies: number;
  affectedServices: string[];
  timeRange: {
    start: number;
    end: number;
  };
  dominantPattern?: string;
  overallSeverity: string;
}

export interface IDetectedPattern {
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  affectedMetrics: string[];
  timePattern?: ITimePattern;
  characteristics: Record<string, any>;
}

export interface ITimePattern {
  type: "periodic" | "burst" | "gradual" | "sudden";
  period?: number; // for periodic patterns
  duration: number;
  intensity: number;
}

export interface ICorrelationResult {
  metric1: string;
  metric2: string;
  correlationCoefficient: number;
  significance: number;
  timeDelay?: number; // lag in correlation
  causality?: CausalityDirection;
}

export enum CausalityDirection {
  NONE = "none",
  FORWARD = "forward", // metric1 causes metric2
  REVERSE = "reverse", // metric2 causes metric1
  BIDIRECTIONAL = "bidirectional",
}

export interface ITimeSeriesAnalysis {
  trend: ITrendAnalysis;
  seasonality: ISeasonalityAnalysis;
  stationarity: IStationarityTest;
  changePoints: IChangePoint[];
  forecast?: IForecast;
}

export interface ITrendAnalysis {
  direction: "increasing" | "decreasing" | "stable";
  strength: number; // 0-1
  significance: number;
  changeRate: number;
  trendLine: IDataPoint[];
}

export interface ISeasonalityAnalysis {
  hasSeasonality: boolean;
  dominantPeriod?: number;
  seasonalStrength?: number;
  seasonalPattern?: number[];
  deseasonalizedData?: IDataPoint[];
}

export interface IStationarityTest {
  isStationary: boolean;
  testStatistic: number;
  pValue: number;
  criticalValue: number;
  testMethod: string;
}

export interface IChangePoint {
  timestamp: number;
  significance: number;
  beforeMean: number;
  afterMean: number;
  changeType: ChangePointType;
  confidence: number;
}

export enum ChangePointType {
  MEAN_SHIFT = "mean_shift",
  VARIANCE_CHANGE = "variance_change",
  TREND_CHANGE = "trend_change",
  SEASONAL_CHANGE = "seasonal_change",
}

export interface IForecast {
  predictions: IDataPoint[];
  confidenceIntervals: IConfidenceInterval[];
  horizon: number;
  model: string;
  accuracy: IForecastAccuracy;
}

export interface IConfidenceInterval {
  timestamp: number;
  lower: number;
  upper: number;
  confidence: number;
}

export interface IForecastAccuracy {
  mae: number; // Mean Absolute Error
  mse: number; // Mean Squared Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
}

export interface IDataPoint {
  timestamp: number;
  value: number;
}

export interface ISeasonalAnalysis {
  patterns: ISeasonalPattern[];
  deviations: ISeasonalDeviation[];
  forecast: ISeasonalForecast;
}

export interface ISeasonalPattern {
  period: string; // 'daily', 'weekly', 'monthly'
  confidence: number;
  pattern: number[];
  strength: number;
}

export interface ISeasonalDeviation {
  timestamp: number;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  significance: number;
}

export interface ISeasonalForecast {
  nextPeriod: IDataPoint[];
  confidence: number;
  seasonalFactors: number[];
}

export interface IRootCauseAnalysis {
  primaryCauses: ICause[];
  contributingFactors: IContributingFactor[];
  affectedComponents: string[];
  propagationPath: string[];
  confidence: number;
  analysisMethod: string;
}

export interface ICause {
  component: string;
  metric: string;
  description: string;
  confidence: number;
  evidenceScore: number;
  timestamp: number;
  category: CauseCategory;
}

export enum CauseCategory {
  INFRASTRUCTURE = "infrastructure",
  APPLICATION = "application",
  EXTERNAL = "external",
  DATA = "data",
  CONFIGURATION = "configuration",
  DEPENDENCY = "dependency",
}

export interface IContributingFactor {
  name: string;
  description: string;
  weight: number;
  evidence: string[];
}

export interface IInsight {
  type: InsightType;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  actionable: boolean;
  recommendation?: string;
  metadata: Record<string, any>;
}

export enum InsightType {
  PATTERN_DISCOVERY = "pattern_discovery",
  CORRELATION_FINDING = "correlation_finding",
  TREND_ANALYSIS = "trend_analysis",
  SEASONAL_INSIGHT = "seasonal_insight",
  PERFORMANCE_DEGRADATION = "performance_degradation",
  CAPACITY_INSIGHT = "capacity_insight",
  SECURITY_ANOMALY = "security_anomaly",
  BUSINESS_IMPACT = "business_impact",
}

export interface IImpactPrediction {
  businessImpact: IBusinessImpact;
  technicalImpact: ITechnicalImpact;
  userImpact: IUserImpact;
  financialImpact?: IFinancialImpact;
  timeToResolution?: ITimeEstimate;
  confidence: number;
}

export interface IBusinessImpact {
  severity: string;
  affectedServices: string[];
  slaBreachProbability: number;
  customersAffected?: number;
  revenueAtRisk?: number;
}

export interface ITechnicalImpact {
  systemStability: number; // 0-1
  performanceDegradation: number; // 0-1
  resourceUtilization: IResourceImpact;
  cascadeRisk: number; // 0-1
}

export interface IResourceImpact {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface IUserImpact {
  userExperienceDegradation: number; // 0-1
  expectedComplaints: number;
  featureAvailability: IFeatureImpact[];
}

export interface IFeatureImpact {
  feature: string;
  availability: number; // 0-1
  performance: number; // 0-1
}

export interface IFinancialImpact {
  estimatedCost: number;
  currency: string;
  timeframe: string;
  costBreakdown: ICostBreakdown[];
}

export interface ICostBreakdown {
  category: string;
  amount: number;
  description: string;
}

export interface ITimeEstimate {
  minimum: number;
  maximum: number;
  most_likely: number;
  confidence: number;
}

export interface IActionRecommendation {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  category: ActionCategory;
  effort: EffortLevel;
  impact: ImpactLevel;
  timeToImplement: number;
  resources: string[];
  steps: IActionStep[];
  automation?: IAutomationOption;
  risks: IRisk[];
  dependencies?: string[];
  successCriteria: string[];
}

export enum ActionPriority {
  IMMEDIATE = "immediate",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum ActionCategory {
  IMMEDIATE_RESPONSE = "immediate_response",
  INVESTIGATION = "investigation",
  MITIGATION = "mitigation",
  PREVENTION = "prevention",
  OPTIMIZATION = "optimization",
  MONITORING = "monitoring",
}

export enum EffortLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum ImpactLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface IActionStep {
  order: number;
  description: string;
  estimatedTime: number;
  required: boolean;
  automation?: boolean;
}

export interface IAutomationOption {
  available: boolean;
  method: string;
  confidence: number;
  prerequisites: string[];
}

export interface IRisk {
  description: string;
  probability: number; // 0-1
  impact: string;
  mitigation: string;
}
