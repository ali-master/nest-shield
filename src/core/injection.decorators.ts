/**
 * Injection Decorators for Services
 *
 * This file provides convenient decorator-based injection patterns for all
 * services using Symbol-based DI tokens. These decorators improve
 * developer experience and maintainability.
 */

import { Inject } from "@nestjs/common";
import { DI_TOKENS } from "./di-tokens";

// =============================================================================
// CORE CONFIGURATION DECORATORS
// =============================================================================

/**
 * Inject the Shield module configuration
 */
export const InjectShieldConfig = () => Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS);

/**
 * Inject the Shield storage adapter
 */
export const InjectShieldStorage = () => Inject(DI_TOKENS.SHIELD_STORAGE);

// =============================================================================
// HTTP ADAPTER DECORATORS
// =============================================================================

/**
 * Inject the HTTP adapter
 */
export const InjectHttpAdapter = () => Inject(DI_TOKENS.HTTP_ADAPTER);

/**
 * Inject the HTTP adapter factory
 */
export const InjectHttpAdapterFactory = () => Inject(DI_TOKENS.HTTP_ADAPTER_FACTORY);

// =============================================================================
// CORE PROTECTION SERVICE DECORATORS
// =============================================================================

/**
 * Inject the Circuit Breaker service
 */
export const InjectCircuitBreaker = () => Inject(DI_TOKENS.CIRCUIT_BREAKER_SERVICE);

/**
 * Inject the Rate Limit service
 */
export const InjectRateLimit = () => Inject(DI_TOKENS.RATE_LIMIT_SERVICE);

/**
 * Inject the Throttle service
 */
export const InjectThrottle = () => Inject(DI_TOKENS.THROTTLE_SERVICE);

/**
 * Inject the Overload protection service
 */
export const InjectOverload = () => Inject(DI_TOKENS.OVERLOAD_SERVICE);

/**
 * Inject the Metrics service
 */
export const InjectMetrics = () => Inject(DI_TOKENS.METRICS_SERVICE);

/**
 * Inject the Priority Manager service
 */
export const InjectPriorityManager = () => Inject(DI_TOKENS.PRIORITY_MANAGER_SERVICE);

/**
 * Inject the Graceful Shutdown service
 */
export const InjectGracefulShutdown = () => Inject(DI_TOKENS.GRACEFUL_SHUTDOWN_SERVICE);

/**
 * Inject the Distributed Sync service
 */
export const InjectDistributedSync = () => Inject(DI_TOKENS.DISTRIBUTED_SYNC_SERVICE);

// =============================================================================
// ANOMALY DETECTION SERVICE DECORATORS
// =============================================================================

/**
 * Inject the main Anomaly Detection service
 */
export const InjectAnomalyDetection = () => Inject(DI_TOKENS.ANOMALY_DETECTION_SERVICE);

/**
 * Inject the Performance Monitor service
 */
export const InjectPerformanceMonitor = () => Inject(DI_TOKENS.PERFORMANCE_MONITOR_SERVICE);

/**
 * Inject the Data Collector service
 */
export const InjectDataCollector = () => Inject(DI_TOKENS.DATA_COLLECTOR_SERVICE);

/**
 * Inject the Alerting service
 */
export const InjectAlerting = () => Inject(DI_TOKENS.ALERTING_SERVICE);

/**
 * Inject the Detector Management service
 */
export const InjectDetectorManagement = () => Inject(DI_TOKENS.DETECTOR_MANAGEMENT_SERVICE);

// =============================================================================
// ANOMALY DETECTOR DECORATORS
// =============================================================================

/**
 * Inject the Z-Score detector
 */
export const InjectZScoreDetector = () => Inject(DI_TOKENS.ZSCORE_DETECTOR);

/**
 * Inject the Threshold detector
 */
export const InjectThresholdDetector = () => Inject(DI_TOKENS.THRESHOLD_DETECTOR);

/**
 * Inject the Statistical detector
 */
export const InjectStatisticalDetector = () => Inject(DI_TOKENS.STATISTICAL_DETECTOR);

/**
 * Inject the Seasonal detector
 */
export const InjectSeasonalDetector = () => Inject(DI_TOKENS.SEASONAL_DETECTOR);

/**
 * Inject the Machine Learning detector
 */
export const InjectMachineLearningDetector = () => Inject(DI_TOKENS.MACHINE_LEARNING_DETECTOR);

/**
 * Inject the Isolation Forest detector
 */
export const InjectIsolationForestDetector = () => Inject(DI_TOKENS.ISOLATION_FOREST_DETECTOR);

/**
 * Inject the Composite detector
 */
export const InjectCompositeDetector = () => Inject(DI_TOKENS.COMPOSITE_DETECTOR);

/**
 * Inject the Detector Registry
 */
export const InjectDetectorRegistry = () => Inject(DI_TOKENS.DETECTOR_REGISTRY);

/**
 * Inject the Detector Factory
 */
export const InjectDetectorFactory = () => Inject(DI_TOKENS.DETECTOR_FACTORY);

// =============================================================================
// METRICS SYSTEM DECORATORS
// =============================================================================

/**
 * Inject the Metrics configuration
 */
export const InjectMetricsConfig = () => Inject(DI_TOKENS.METRICS_CONFIG);

/**
 * Inject the Metrics collector
 */
export const InjectMetricsCollector = () => Inject(DI_TOKENS.METRICS_COLLECTOR);

/**
 * Inject the Metrics exporter
 */
export const InjectMetricsExporter = () => Inject(DI_TOKENS.METRICS_EXPORTER);

/**
 * Inject the Metrics collector factory
 */
export const InjectMetricsCollectorFactory = () => Inject(DI_TOKENS.METRICS_COLLECTOR_FACTORY);

/**
 * Inject the Metrics exporter factory
 */
export const InjectMetricsExporterFactory = () => Inject(DI_TOKENS.METRICS_EXPORTER_FACTORY);

// =============================================================================
// METRICS AGGREGATOR DECORATORS
// =============================================================================

/**
 * Inject the Time Window aggregator
 */
export const InjectTimeWindowAggregator = () => Inject(DI_TOKENS.TIME_WINDOW_AGGREGATOR);

/**
 * Inject the Rolling Window aggregator
 */
export const InjectRollingWindowAggregator = () => Inject(DI_TOKENS.ROLLING_WINDOW_AGGREGATOR);

/**
 * Inject the Percentile aggregator
 */
export const InjectPercentileAggregator = () => Inject(DI_TOKENS.PERCENTILE_AGGREGATOR);

// =============================================================================
// METRICS COLLECTOR DECORATORS
// =============================================================================

/**
 * Inject the Prometheus collector
 */
export const InjectPrometheusCollector = () => Inject(DI_TOKENS.PROMETHEUS_COLLECTOR);

/**
 * Inject the StatsD collector
 */
export const InjectStatsDCollector = () => Inject(DI_TOKENS.STATSD_COLLECTOR);

/**
 * Inject the DataDog collector
 */
export const InjectDatadogCollector = () => Inject(DI_TOKENS.DATADOG_COLLECTOR);

/**
 * Inject the CloudWatch collector
 */
export const InjectCloudWatchCollector = () => Inject(DI_TOKENS.CLOUDWATCH_COLLECTOR);

/**
 * Inject the Custom Metrics collector
 */
export const InjectCustomMetricsCollector = () => Inject(DI_TOKENS.CUSTOM_METRICS_COLLECTOR);

// =============================================================================
// METRICS EXPORTER DECORATORS
// =============================================================================

/**
 * Inject the Prometheus exporter
 */
export const InjectPrometheusExporter = () => Inject(DI_TOKENS.PROMETHEUS_EXPORTER);

/**
 * Inject the JSON exporter
 */
export const InjectJsonExporter = () => Inject(DI_TOKENS.JSON_EXPORTER);

/**
 * Inject the OpenMetrics exporter
 */
export const InjectOpenMetricsExporter = () => Inject(DI_TOKENS.OPENMETRICS_EXPORTER);

// =============================================================================
// GUARD AND INTERCEPTOR DECORATORS
// =============================================================================

/**
 * Inject the Shield guard
 */
export const InjectShieldGuard = () => Inject(DI_TOKENS.SHIELD_GUARD);

/**
 * Inject the Circuit Breaker interceptor
 */
export const InjectCircuitBreakerInterceptor = () => Inject(DI_TOKENS.CIRCUIT_BREAKER_INTERCEPTOR);

/**
 * Inject the Overload Release interceptor
 */
export const InjectOverloadReleaseInterceptor = () =>
  Inject(DI_TOKENS.OVERLOAD_RELEASE_INTERCEPTOR);

// =============================================================================
// UTILITY DECORATORS
// =============================================================================

/**
 * Inject the Event Emitter
 */
export const InjectEventEmitter = () => Inject(DI_TOKENS.EVENT_EMITTER);

/**
 * Inject the Event Bus
 */
export const InjectEventBus = () => Inject(DI_TOKENS.EVENT_BUS);

/**
 * Inject the Task Scheduler
 */
export const InjectTaskScheduler = () => Inject(DI_TOKENS.TASK_SCHEDULER);

/**
 * Inject the Logger
 */
export const InjectLogger = () => Inject(DI_TOKENS.LOGGER);

/**
 * Inject the Health Check service
 */
export const InjectHealthCheck = () => Inject(DI_TOKENS.HEALTH_CHECK);

/**
 * Inject the Diagnostics service
 */
export const InjectDiagnostics = () => Inject(DI_TOKENS.DIAGNOSTICS_SERVICE);

// =============================================================================
// COMPOSITE INJECTION DECORATORS
// =============================================================================

/**
 * Decorator factory for injecting multiple related services
 *
 * @example
 * ```typescript
 * class MyController {
 *   constructor(
 *     @InjectProtectionServices()
 *     private readonly protectionServices: {
 *       circuitBreaker: CircuitBreakerService;
 *       rateLimit: RateLimitService;
 *       throttle: ThrottleService;
 *       overload: OverloadService;
 *     }
 *   ) {}
 * }
 * ```
 */
export const InjectProtectionServices = () => {
  return (_target: any, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {
    // This would require custom logic to inject multiple services
    // For now, we'll document this as a pattern to be implemented
    throw new Error(
      "InjectProtectionServices is not yet implemented. Use individual service decorators instead.",
    );
  };
};

/**
 * Decorator factory for injecting all anomaly detection services
 */
export const InjectAnomalyDetectionServices = () => {
  return (_target: any, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {
    // This would require custom logic to inject multiple services
    throw new Error(
      "InjectAnomalyDetectionServices is not yet implemented. Use individual service decorators instead.",
    );
  };
};

/**
 * Decorator factory for injecting all metrics services
 */
export const InjectMetricsServices = () => {
  return (_target: any, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {
    // This would require custom logic to inject multiple services
    throw new Error(
      "InjectMetricsServices is not yet implemented. Use individual service decorators instead.",
    );
  };
};

// =============================================================================
// TYPE DEFINITIONS FOR BETTER INTELLISENSE
// =============================================================================

/**
 * Type definitions for injection decorator return types
 * These help with IntelliSense and type checking
 */
export interface InjectionDecorators {
  // Core Configuration
  InjectShieldConfig: () => ParameterDecorator;
  InjectShieldStorage: () => ParameterDecorator;

  // Core Services
  InjectCircuitBreaker: () => ParameterDecorator;
  InjectRateLimit: () => ParameterDecorator;
  InjectThrottle: () => ParameterDecorator;
  InjectOverload: () => ParameterDecorator;
  InjectMetrics: () => ParameterDecorator;
  InjectPriorityManager: () => ParameterDecorator;
  InjectGracefulShutdown: () => ParameterDecorator;
  InjectDistributedSync: () => ParameterDecorator;

  // Anomaly Detection
  InjectAnomalyDetection: () => ParameterDecorator;
  InjectPerformanceMonitor: () => ParameterDecorator;
  InjectDataCollector: () => ParameterDecorator;
  InjectAlerting: () => ParameterDecorator;
  InjectDetectorManagement: () => ParameterDecorator;

  // Detectors
  InjectZScoreDetector: () => ParameterDecorator;
  InjectThresholdDetector: () => ParameterDecorator;
  InjectStatisticalDetector: () => ParameterDecorator;
  InjectSeasonalDetector: () => ParameterDecorator;
  InjectMachineLearningDetector: () => ParameterDecorator;
  InjectIsolationForestDetector: () => ParameterDecorator;
  InjectCompositeDetector: () => ParameterDecorator;

  // Metrics System
  InjectMetricsConfig: () => ParameterDecorator;
  InjectMetricsCollector: () => ParameterDecorator;
  InjectMetricsExporter: () => ParameterDecorator;
  InjectTimeWindowAggregator: () => ParameterDecorator;
  InjectRollingWindowAggregator: () => ParameterDecorator;
  InjectPercentileAggregator: () => ParameterDecorator;
}

/**
 * Export all injection decorators as a namespace for easier imports
 */
export const Inject$ = {
  // Configuration
  ShieldConfig: InjectShieldConfig,
  ShieldStorage: InjectShieldStorage,

  // Core Services
  CircuitBreaker: InjectCircuitBreaker,
  RateLimit: InjectRateLimit,
  Throttle: InjectThrottle,
  Overload: InjectOverload,
  Metrics: InjectMetrics,
  PriorityManager: InjectPriorityManager,
  GracefulShutdown: InjectGracefulShutdown,
  DistributedSync: InjectDistributedSync,

  // Anomaly Detection
  AnomalyDetection: InjectAnomalyDetection,
  PerformanceMonitor: InjectPerformanceMonitor,
  DataCollector: InjectDataCollector,
  Alerting: InjectAlerting,
  DetectorManagement: InjectDetectorManagement,

  // Detectors
  ZScoreDetector: InjectZScoreDetector,
  ThresholdDetector: InjectThresholdDetector,
  StatisticalDetector: InjectStatisticalDetector,
  SeasonalDetector: InjectSeasonalDetector,
  MachineLearningDetector: InjectMachineLearningDetector,
  IsolationForestDetector: InjectIsolationForestDetector,
  CompositeDetector: InjectCompositeDetector,
  DetectorRegistry: InjectDetectorRegistry,
  DetectorFactory: InjectDetectorFactory,

  // Metrics
  MetricsConfig: InjectMetricsConfig,
  MetricsCollector: InjectMetricsCollector,
  MetricsExporter: InjectMetricsExporter,
  MetricsCollectorFactory: InjectMetricsCollectorFactory,
  MetricsExporterFactory: InjectMetricsExporterFactory,
  TimeWindowAggregator: InjectTimeWindowAggregator,
  RollingWindowAggregator: InjectRollingWindowAggregator,
  PercentileAggregator: InjectPercentileAggregator,

  // Collectors
  PrometheusCollector: InjectPrometheusCollector,
  StatsDCollector: InjectStatsDCollector,
  DatadogCollector: InjectDatadogCollector,
  CloudWatchCollector: InjectCloudWatchCollector,
  CustomMetricsCollector: InjectCustomMetricsCollector,

  // Exporters
  PrometheusExporter: InjectPrometheusExporter,
  JsonExporter: InjectJsonExporter,
  OpenMetricsExporter: InjectOpenMetricsExporter,

  // Guards & Interceptors
  ShieldGuard: InjectShieldGuard,
  CircuitBreakerInterceptor: InjectCircuitBreakerInterceptor,
  OverloadReleaseInterceptor: InjectOverloadReleaseInterceptor,

  // Utilities
  EventEmitter: InjectEventEmitter,
  EventBus: InjectEventBus,
  TaskScheduler: InjectTaskScheduler,
  Logger: InjectLogger,
  HealthCheck: InjectHealthCheck,
  Diagnostics: InjectDiagnostics,
} as const;
