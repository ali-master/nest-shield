import { Injectable } from "@nestjs/common";
import type { IMetricsCollector } from "../../interfaces";
import type { ShieldLoggerService } from "../../services/shield-logger.service";
import type {
  MetricValue,
  MetricLabels,
  ITimeWindowAggregator,
  IRollingWindowAggregator,
  IPercentileAggregator,
  IMetricsHealth,
  IMetricsExporter,
  IEnhancedMetricsConfig,
  IAnomaly,
} from "../types";
import {
  NoOpMetricsCollector,
  ExporterFactoryService,
  CollectorFactoryService,
  AggregatorFactoryService,
} from "../factories";
import { MetricsAnomalyDetectionService } from "./anomaly-detection.service";

@Injectable()
export class MetricsManagerService {
  private readonly prefix: string;
  private collector: IMetricsCollector;
  private timeWindowAggregator: ITimeWindowAggregator | null = null;
  private rollingWindowAggregator: IRollingWindowAggregator | null = null;
  private percentileAggregator: IPercentileAggregator | null = null;
  private exporter: IMetricsExporter | null = null;
  private enhancedMode = false;
  private initialized = false;

  private readonly aggregatorFactory: AggregatorFactoryService;
  private readonly collectorFactory: CollectorFactoryService;
  private readonly exporterFactory: ExporterFactoryService;
  private readonly anomalyDetectionService: MetricsAnomalyDetectionService;

  constructor(
    private readonly config: IEnhancedMetricsConfig,
    private readonly logger: ShieldLoggerService,
    anomalyConfig?: Record<string, unknown>,
  ) {
    this.prefix = config.prefix || "nest_shield";
    this.aggregatorFactory = new AggregatorFactoryService();
    this.collectorFactory = new CollectorFactoryService();
    this.exporterFactory = new ExporterFactoryService();
    this.anomalyDetectionService = new MetricsAnomalyDetectionService(logger, anomalyConfig as any);

    // Initialize with NoOp collector until async initialization completes
    this.collector = new NoOpMetricsCollector();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize factories
    await Promise.all([
      this.aggregatorFactory.initialize(),
      this.collectorFactory.initialize(),
      this.exporterFactory.initialize(),
    ]);

    this.enhancedMode = this.aggregatorFactory.isAvailable();

    // Initialize aggregators if enhanced mode is available
    if (this.enhancedMode) {
      this.initializeAggregators();
    }

    // Create collector
    this.collector = this.createCollector();

    // Create exporter if enhanced mode and collector support it
    if (this.enhancedMode && this.collector) {
      this.createExporter();
    }

    // Connect collector if it supports it
    if (this.collector && typeof (this.collector as any).connect === "function") {
      try {
        await (this.collector as any).connect();
      } catch (error) {
        this.logger.metricsWarn("Failed to connect collector", {
          operation: "collector_connect",
          metadata: { error: (error as Error).message },
        });
      }
    }

    this.initialized = true;
    this.logger.metrics("Metrics manager initialized", {
      operation: "initialization",
      metadata: {
        enhancedMode: this.enhancedMode,
        collectorType: this.config.type,
        anomalyDetectionEnabled: this.anomalyDetectionService.isEnabled(),
      },
    });
  }

  async destroy(): Promise<void> {
    if (this.collector && typeof (this.collector as any).disconnect === "function") {
      try {
        await (this.collector as any).disconnect();
      } catch (error) {
        this.logger.metricsWarn("Failed to disconnect collector", {
          operation: "collector_disconnect",
          metadata: { error: (error as Error).message },
        });
      }
    }
    this.initialized = false;
  }

  private initializeAggregators(): void {
    this.timeWindowAggregator = this.aggregatorFactory.createTimeWindowAggregator(
      this.config.windowSize || 60000, // 1 minute
      this.config.maxWindows || 60, // 1 hour
    );

    this.rollingWindowAggregator = this.aggregatorFactory.createRollingWindowAggregator(
      this.config.rollingWindowSize || 300000, // 5 minutes
    );

    this.percentileAggregator = this.aggregatorFactory.createPercentileAggregator();
  }

  private createCollector(): IMetricsCollector {
    if (!this.config.enabled) {
      return new NoOpMetricsCollector();
    }

    if (this.config.customCollector) {
      return this.config.customCollector;
    }

    const collectorConfig = {
      type: this.config.type || "prometheus",
      prefix: this.prefix,
      labels: this.config.labels,
      buckets: this.config.buckets,
      percentiles: this.config.percentiles,
      flushInterval: this.config.flushInterval,
      maxBufferSize: this.config.maxBufferSize,
      ...this.config.collectorOptions,
    };

    let collector: IMetricsCollector | null = null;

    switch (collectorConfig.type) {
      case "prometheus":
        collector = this.collectorFactory.createPrometheusCollector(collectorConfig);
        break;
      case "statsd":
        collector = this.collectorFactory.createStatsDCollector(collectorConfig);
        break;
      case "datadog":
        collector = this.collectorFactory.createDatadogCollector(collectorConfig);
        break;
      case "cloudwatch":
        collector = this.collectorFactory.createCloudWatchCollector(collectorConfig);
        break;
      default:
        collector = this.collectorFactory.createPrometheusCollector(collectorConfig);
    }

    return collector || new NoOpMetricsCollector();
  }

  private createExporter(): void {
    if (!this.enhancedMode || !this.config.enabled) {
      return;
    }

    const exporterConfig = {
      format: (this.config.type || "prometheus") as "prometheus" | "json" | "openmetrics",
      includeTimestamp: this.config.includeTimestamp,
      includeHelp: this.config.includeHelp,
      groupByName: this.config.groupByName,
    };

    let exporter: IMetricsExporter | null = null;

    switch (exporterConfig.format) {
      case "prometheus":
        exporter = this.exporterFactory.createPrometheusExporter(
          this.collector as any,
          exporterConfig,
        );
        break;
      case "json":
        exporter = this.exporterFactory.createJsonExporter(this.collector as any, exporterConfig);
        break;
      case "openmetrics":
        exporter = this.exporterFactory.createOpenMetricsExporter(
          this.collector as any,
          exporterConfig,
        );
        break;
    }

    this.exporter = exporter;
  }

  // Core metric methods
  increment(metric: string, value: MetricValue = 1, labels?: MetricLabels): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.increment(metricName, value, mergedLabels);
    this.updateAggregators(metricName, value, mergedLabels, "counter");
    void this.detectAnomalies(metricName, value, mergedLabels, "counter");
  }

  decrement(metric: string, value: MetricValue = 1, labels?: MetricLabels): void {
    this.increment(metric, -value, labels);
  }

  gauge(metric: string, value: MetricValue, labels?: MetricLabels): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.gauge(metricName, value, mergedLabels);
    this.updateAggregators(metricName, value, mergedLabels, "gauge");
    void this.detectAnomalies(metricName, value, mergedLabels, "gauge");
  }

  histogram(metric: string, value: MetricValue, labels?: MetricLabels): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.histogram(metricName, value, mergedLabels);
    this.updateAggregators(metricName, value, mergedLabels, "histogram");
    void this.detectAnomalies(metricName, value, mergedLabels, "histogram");
  }

  summary(metric: string, value: MetricValue, labels?: MetricLabels): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.summary(metricName, value, mergedLabels);
    this.updateAggregators(metricName, value, mergedLabels, "summary");
    void this.detectAnomalies(metricName, value, mergedLabels, "summary");
  }

  startTimer(metric: string, labels?: MetricLabels): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.histogram(metric, duration / 1000, labels);
    };
  }

  private updateAggregators(
    metricName: string,
    value: MetricValue,
    labels: MetricLabels,
    type: string,
  ): void {
    if (!this.enhancedMode) {
      return;
    }

    const key = this.createAggregatorKey(metricName, labels);

    // Update rolling window aggregator
    if (this.rollingWindowAggregator) {
      this.rollingWindowAggregator.addValue(key, value);
    }

    // Update time window aggregator
    if (this.timeWindowAggregator) {
      this.timeWindowAggregator.addMetric({
        name: metricName,
        type: type as any,
        value,
        timestamp: Date.now(),
        labels,
      });
    }

    // Update percentile aggregator for histogram and summary metrics
    if (this.percentileAggregator && (type === "histogram" || type === "summary")) {
      this.percentileAggregator.addValue(key, value);
    }
  }

  private async detectAnomalies(
    metricName: string,
    value: MetricValue,
    labels: MetricLabels,
    type: string,
  ): Promise<void> {
    const anomaly = await this.anomalyDetectionService.detectAnomaly(
      metricName,
      value,
      labels,
      type,
      this.rollingWindowAggregator || undefined,
    );

    if (anomaly) {
      this.handleAnomalyDetected(anomaly);
    }
  }

  private handleAnomalyDetected(anomaly: IAnomaly): void {
    // Increment anomaly counter
    this.increment("anomalies_detected", 1, {
      severity: anomaly.severity,
      type: anomaly.type,
      detector: anomaly.detector,
    });

    // Log anomaly with detailed context
    this.logger.anomalyWarn("Anomaly detected", {
      operation: "anomaly_detected",
      metadata: {
        metric: anomaly.data.metricName,
        value: anomaly.data.value,
        severity: anomaly.severity,
        score: anomaly.score,
        description: anomaly.description,
        timestamp: new Date(anomaly.timestamp).toISOString(),
      },
    });
  }

  // Enhanced analytics methods
  getRollingStatistics(metric: string, labels?: MetricLabels) {
    if (!this.enhancedMode || !this.rollingWindowAggregator) {
      return null;
    }

    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    return this.rollingWindowAggregator.getStatistics(key);
  }

  getPercentiles(metric: string, labels?: MetricLabels, percentiles: number[] = [50, 90, 95, 99]) {
    if (!this.enhancedMode || !this.percentileAggregator) {
      return null;
    }

    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    return this.percentileAggregator.getPercentiles(key, percentiles);
  }

  getTimeSeriesData(metric: string, labels?: MetricLabels, windowCount: number = 60) {
    if (!this.enhancedMode || !this.timeWindowAggregator) {
      return null;
    }

    const metricName = this.formatMetricName(metric);
    return this.timeWindowAggregator.getTimeSeriesData(
      metricName,
      this.mergeLabels(labels),
      windowCount,
    );
  }

  // Export methods
  async exportMetrics(format: "prometheus" | "json" | "openmetrics" = "json") {
    if (!this.enhancedMode || !this.exporter) {
      return { error: "Enhanced export not available" };
    }

    try {
      if (format === "json" && this.exporter.exportJson) {
        return await this.exporter.exportJson();
      }
      return await this.exporter.export();
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  // Utility methods
  resetMetric(metric: string, labels?: MetricLabels): void {
    if (!this.enhancedMode) {
      return;
    }

    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));

    this.rollingWindowAggregator?.clearKey(key);
    this.percentileAggregator?.reset(key);
  }

  resetAllMetrics(): void {
    if (!this.enhancedMode) {
      return;
    }

    this.rollingWindowAggregator?.clear();
    this.percentileAggregator?.resetAll();

    if (this.collector && typeof (this.collector as any).reset === "function") {
      (this.collector as any).reset();
    }
  }

  getHealth(): IMetricsHealth {
    try {
      const details = {
        collectorType: this.config.type,
        enabled: this.config.enabled || false,
        enhancedMode: this.enhancedMode,
        lastUpdate: Date.now(),
        anomalyDetectionEnabled: this.anomalyDetectionService.isEnabled(),
        metricsCount:
          this.enhancedMode && this.rollingWindowAggregator
            ? this.rollingWindowAggregator.getAllKeys().length
            : 0,
      };

      return {
        status: "healthy",
        details,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: (error as Error).message,
          collectorType: this.config.type,
          enabled: this.config.enabled || false,
          enhancedMode: this.enhancedMode,
          lastUpdate: Date.now(),
          anomalyDetectionEnabled: this.anomalyDetectionService.isEnabled(),
        },
      };
    }
  }

  // Helper methods
  private formatMetricName(metric: string): string {
    return `${this.prefix}_${metric}`;
  }

  private mergeLabels(labels?: MetricLabels): MetricLabels {
    return {
      ...this.config.labels,
      ...labels,
    };
  }

  private createAggregatorKey(metric: string, labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return metric;
    }
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((key) => `${key}="${labels[key]}"`)
      .join(",");
    return `${metric}{${sortedLabels}}`;
  }

  // Getters
  getCollector(): IMetricsCollector {
    return this.collector;
  }

  isEnhancedModeAvailable(): boolean {
    return this.enhancedMode;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getAnomalyDetectionService(): MetricsAnomalyDetectionService {
    return this.anomalyDetectionService;
  }
}
