import type { IAnomalyData, IAnomaly } from "./anomaly.interface";

export interface IAnomalyDetector {
  name: string;
  version: string;
  description: string;

  configure: (config: IDetectorConfig) => void;
  detect: (data: IAnomalyData[], context?: IDetectorContext) => Promise<IAnomaly[]>;
  train?: (historicalData: IAnomalyData[]) => Promise<void>;
  getModelInfo?: () => IModelInfo;
  isReady: () => boolean;
  reset: () => void;
}

export interface IDetectorConfig {
  enabled: boolean;
  sensitivity: number; // 0-1, higher = more sensitive
  threshold: number;
  windowSize: number;
  minDataPoints: number;
  learningPeriod?: number;
  seasonality?: ISeasonalityConfig;
  outlierMethod?: OutlierMethod;
  trendAnalysis?: ITrendConfig;
  correlationAnalysis?: ICorrelationConfig;
  businessRules?: IBusinessRule[];
  customParameters?: Record<string, any>;
}

export interface ISeasonalityConfig {
  enabled: boolean;
  periods: SeasonalPeriod[];
  adaptiveLearning: boolean;
  historicalWindowDays: number;
}

export enum SeasonalPeriod {
  HOURLY = "hourly",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export interface ITrendConfig {
  enabled: boolean;
  method: TrendMethod;
  lookbackPeriod: number;
  changeThreshold: number;
}

export enum TrendMethod {
  LINEAR_REGRESSION = "linear_regression",
  EXPONENTIAL_SMOOTHING = "exponential_smoothing",
  MOVING_AVERAGE = "moving_average",
}

export interface ICorrelationConfig {
  enabled: boolean;
  metrics: string[];
  threshold: number; // correlation coefficient threshold
  windowSize: number;
}

export interface IBusinessRule {
  name: string;
  condition: string; // Expression
  action: BusinessRuleAction;
  severity: string;
  message: string;
}

export enum BusinessRuleAction {
  ALERT = "alert",
  SUPPRESS = "suppress",
  ESCALATE = "escalate",
  AUTO_RESOLVE = "auto_resolve",
}

export enum OutlierMethod {
  Z_SCORE = "z_score",
  MODIFIED_Z_SCORE = "modified_z_score",
  IQR = "iqr",
  ISOLATION_FOREST = "isolation_forest",
  LOCAL_OUTLIER_FACTOR = "local_outlier_factor",
  ONE_CLASS_SVM = "one_class_svm",
}

export interface IDetectorContext {
  currentTime: number;
  metadata?: Record<string, any>;
  externalFactors?: IExternalFactor[];
  maintenanceWindows?: IMaintenanceWindow[];
  deployments?: IDeploymentEvent[];
  performanceRequirements?: {
    lowLatency: boolean;
    highThroughput: boolean;
    highAccuracy: boolean;
  };
}

export interface IExternalFactor {
  name: string;
  value: any;
  timestamp: number;
  source: string;
}

export interface IMaintenanceWindow {
  id: string;
  start: number;
  end: number;
  services: string[];
  description: string;
}

export interface IDeploymentEvent {
  id: string;
  timestamp: number;
  service: string;
  version: string;
  environment: string;
  status: "started" | "completed" | "failed" | "rolled_back";
}

export interface IModelInfo {
  algorithm: string;
  trainedAt?: number;
  trainingDataSize?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  lastUpdated: number;
  version: string;
  parameters: Record<string, any>;
}

export interface IDetectorMetrics {
  totalDetections: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageDetectionTime: number;
  lastEvaluated: number;
}

export interface IAdaptiveLearningConfig {
  enabled: boolean;
  learningRate: number;
  adaptationInterval: number;
  feedbackWeight: number;
  forgettingFactor: number;
  minConfidenceThreshold: number;
}
