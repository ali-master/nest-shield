export interface IShieldConfig {
  global?: IGlobalProtectionConfig;
  storage?: IStorageConfig;
  circuitBreaker?: ICircuitBreakerConfig;
  rateLimit?: IRateLimitConfig;
  throttle?: IThrottleConfig;
  overload?: IOverloadConfig;
  metrics?: IMetricsConfig;
  adapters?: IAdapterConfig;
  advanced?: IAdvancedConfig;
}

export interface IGlobalProtectionConfig {
  enabled: boolean;
  excludePaths?: string[] | RegExp[];
  includePaths?: string[] | RegExp[];
  bypassTokens?: string[];
  errorHandler?: (error: any, context: any) => void;
  logging?: ILoggingConfig;
}

export interface ILoggingConfig {
  enabled: boolean;
  level: "debug" | "info" | "warn" | "error";
  customLogger?: any;
}

export interface IStorageConfig {
  type: "memory" | "redis" | "memcached" | "custom";
  options?: any;
  customAdapter?: IStorageAdapter;
}

export interface IStorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, value?: number): Promise<number>;
  decrement(key: string, value?: number): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;
  clear?(): Promise<void>;
  mget?(keys: string[]): Promise<any[]>;
  mset?(entries: Array<[string, any]>, ttl?: number): Promise<void>;
  scan?(pattern: string, count?: number): Promise<string[]>;
}

export interface ICircuitBreakerConfig {
  enabled: boolean;
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  fallback?: (error: any, args: any[], context: any) => any;
  healthCheck?: () => Promise<boolean>;
  volumeThreshold?: number;
  allowWarmUp?: boolean;
  warmUpCallVolume?: number;
}

export interface IRateLimitConfig {
  enabled: boolean;
  points: number;
  duration: number;
  blockDuration?: number;
  keyGenerator?: (context: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  customResponseMessage?: string | ((context: any) => string);
  customHeaders?: Record<string, string>;
}

export interface IThrottleConfig {
  enabled: boolean;
  ttl: number;
  limit: number;
  keyGenerator?: (context: any) => string;
  ignoreUserAgents?: RegExp[];
  customResponseMessage?: string | ((context: any) => string);
  customHeaders?: Record<string, string>;
}

export interface IOverloadConfig {
  enabled: boolean;
  maxConcurrentRequests?: number;
  maxQueueSize?: number;
  queueTimeout?: number;
  shedStrategy?: "fifo" | "lifo" | "priority" | "random" | "custom";
  priorityFunction?: (context: any) => number;
  customShedFunction?: (queue: any[]) => any[];
  healthIndicator?: () => Promise<number>;
  adaptiveThreshold?: IAdaptiveThresholdConfig;
}

export interface IAdaptiveThresholdConfig {
  enabled: boolean;
  minThreshold: number;
  maxThreshold: number;
  adjustmentInterval: number;
  targetLatency?: number;
  targetCpuUsage?: number;
  targetMemoryUsage?: number;
}

export interface IMetricsConfig {
  enabled: boolean;
  type: "prometheus" | "statsd" | "custom" | "datadog" | "cloudwatch" | "json" | "openmetrics";
  prefix?: string;
  labels?: Record<string, string>;
  customCollector?: IMetricsCollector;
  exportInterval?: number;
  buckets?: number[];
  percentiles?: number[];
  flushInterval?: number;
  maxBufferSize?: number;
  windowSize?: number;
  maxWindows?: number;
  rollingWindowSize?: number;
  includeTimestamp?: boolean;
  includeHelp?: boolean;
  groupByName?: boolean;
  collectorOptions?: any;
}

export interface IMetricsCollector {
  increment(metric: string, value?: number, labels?: Record<string, string>): void;
  decrement(metric: string, value?: number, labels?: Record<string, string>): void;
  gauge(metric: string, value: number, labels?: Record<string, string>): void;
  histogram(metric: string, value: number, labels?: Record<string, string>): void;
  summary(metric: string, value: number, labels?: Record<string, string>): void;
}

export interface IAdapterConfig {
  type: "auto" | "express" | "fastify" | "custom";
  customAdapter?: IHttpAdapter;
}

export interface IHttpAdapter {
  getRequest(context: any): any;
  getResponse(context: any): any;
  getIp(request: any): string;
  getUserAgent(request: any): string;
  getPath(request: any): string;
  getMethod(request: any): string;
  getHeaders(request: any): Record<string, string>;
  setHeaders(response: any, headers: Record<string, string>): void;
  send(response: any, data: any, statusCode?: number): void;
}

export interface IAdvancedConfig {
  gracefulShutdown?: IGracefulShutdownConfig;
  requestPriority?: IRequestPriorityConfig;
  adaptiveProtection?: IAdaptiveProtectionConfig;
  distributedSync?: IDistributedSyncConfig;
}

export interface IGracefulShutdownConfig {
  enabled: boolean;
  timeout: number;
  beforeShutdown?: () => Promise<void>;
  onShutdown?: () => Promise<void>;
}

export interface IRequestPriorityConfig {
  enabled: boolean;
  defaultPriority: number;
  priorityHeader?: string;
  priorityExtractor?: (context: any) => number;
  priorityLevels?: IPriorityLevel[];
}

export interface IPriorityLevel {
  name: string;
  value: number;
  maxConcurrent?: number;
  maxQueueSize?: number;
  timeout?: number;
}

export interface IAdaptiveProtectionConfig {
  enabled: boolean;
  learningPeriod: number;
  adjustmentInterval: number;
  sensitivityFactor: number;
  anomalyDetection?: IAnomalyDetectionConfig;
}

export interface IAnomalyDetectionConfig {
  enabled: boolean;
  detectorType?:
    | "Z-Score Detector"
    | "Isolation Forest Detector"
    | "Seasonal Anomaly Detector"
    | "Threshold Anomaly Detector"
    | "Statistical Anomaly Detector"
    | "Machine Learning Detector"
    | "Composite Anomaly Detector";
  sensitivity?: number;
  threshold?: number;
  windowSize?: number;
  minDataPoints?: number;
  learningPeriod?: number;
  adaptiveThresholds?: boolean;
  businessRules?: IBusinessRule[];
  alerting?: IAnomalyAlertConfig;
  autoTraining?: IAutoTrainingConfig;
  detectorSpecificConfig?: {
    zscore?: IZScoreConfig;
    isolationForest?: IIsolationForestConfig;
    seasonal?: ISeasonalConfig;
    threshold?: IThresholdDetectorConfig;
    statistical?: IStatisticalConfig;
    machineLearning?: IMLConfig;
    composite?: ICompositeConfig;
  };
}

export interface IBusinessRule {
  id: string;
  name: string;
  condition: string;
  action: "suppress" | "escalate" | "auto_resolve";
  description: string;
  enabled: boolean;
}

export interface IAnomalyAlertConfig {
  enabled: boolean;
  channels: ("log" | "webhook" | "email" | "slack")[];
  thresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  webhookUrl?: string;
  emailConfig?: {
    to: string[];
    subject?: string;
  };
  slackConfig?: {
    webhook: string;
    channel?: string;
  };
}

export interface IAutoTrainingConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  minDataPoints: number;
  retrainOnDrift: boolean;
  driftThreshold: number;
}

export interface IZScoreConfig {
  threshold: number;
  windowSize: number;
  enableModifiedZScore: boolean;
  seasonalAdjustment: boolean;
  volatilityBasedThresholds: boolean;
}

export interface IIsolationForestConfig {
  numTrees: number;
  subsampleSize: number;
  maxDepth: number;
  threshold: number;
  enableFeatureImportance: boolean;
}

export interface ISeasonalConfig {
  enableHourlyPattern: boolean;
  enableDailyPattern: boolean;
  enableWeeklyPattern: boolean;
  enableMonthlyPattern: boolean;
  trendDetection: boolean;
  volatilityModeling: boolean;
}

export interface IThresholdDetectorConfig {
  staticThresholds?: {
    upper: number;
    lower: number;
    upperWarning: number;
    lowerWarning: number;
  };
  enableAdaptiveThresholds: boolean;
  enableRateThresholds: boolean;
  contextualAdjustment: boolean;
}

export interface IStatisticalConfig {
  methods: ("zscore" | "modified-zscore" | "iqr" | "grubbs" | "tukey" | "esd")[];
  ensembleWeights?: Record<string, number>;
  enableDataQualityAnalysis: boolean;
}

export interface IMLConfig {
  algorithms: ("autoencoder" | "lstm" | "one-svm" | "isolation-forest-ml" | "gaussian-mixture")[];
  enableOnlineLearning: boolean;
  featureEngineering: {
    enableTimeFeatures: boolean;
    enableStatisticalFeatures: boolean;
    enableTrendFeatures: boolean;
  };
}

export interface ICompositeConfig {
  strategy:
    | "majority_vote"
    | "weighted_average"
    | "adaptive_weighted"
    | "stacking"
    | "hierarchical";
  detectorWeights?: Record<string, number>;
  enableContextualSelection: boolean;
  enablePerformanceTracking: boolean;
}

export interface IDistributedSyncConfig {
  enabled: boolean;
  nodeId?: string;
  syncInterval: number;
  channel?: string;
  onNodeJoin?: (nodeId: string) => void;
  onNodeLeave?: (nodeId: string) => void;
  onSyncData?: (data: any) => void;
}

export interface IProtectionContext {
  request: any;
  response: any;
  handler: any;
  class: any;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface IProtectionResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  metadata?: Record<string, any>;
}

export interface IShieldMetadata {
  circuitBreaker?: Partial<ICircuitBreakerConfig>;
  rateLimit?: Partial<IRateLimitConfig>;
  throttle?: Partial<IThrottleConfig>;
  overload?: Partial<IOverloadConfig>;
  priority?: number;
  bypass?: boolean;
  custom?: Record<string, any>;
}
