import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { IMetricsConfig, IMetricsCollector } from "../interfaces";
import { InjectShieldLogger, InjectShieldConfig } from "../core/injection.decorators";
import type { ShieldLoggerService } from "./shield-logger.service";

// Import enhanced collectors if available
let PrometheusCollector: any;
let StatsDCollector: any;
let DatadogCollector: any;
let CloudWatchCollector: any;
let CustomMetricsCollector: any;
let BaseMetricsCollector: any;
let TimeWindowAggregator: any;
let RollingWindowAggregator: any;
let PercentileAggregator: any;
let PrometheusExporter: any;
let JsonExporter: any;
let OpenMetricsExporter: any;

// Dynamic imports are loaded asynchronously during service initialization

class NoOpMetricsCollector implements IMetricsCollector {
  increment(): void {}
  decrement(): void {}
  gauge(): void {}
  histogram(): void {}
  summary(): void {}
}

@Injectable()
export class MetricsService implements IMetricsCollector, OnModuleInit, OnModuleDestroy {
  private readonly collector: any;
  private config: IMetricsConfig;
  private readonly prefix: string;
  private timeWindowAggregator?: any;
  private rollingWindowAggregator?: any;
  private percentileAggregator?: any;
  private exporter?: any;
  private anomalyDetectionEnabled = false;
  private anomalyDetectionConfig?: any;
  private enhancedMode = false;

  constructor(
    @InjectShieldConfig() private readonly options: any,
    @InjectShieldLogger() private readonly logger: ShieldLoggerService,
  ) {
    this.config = this.options.metrics || { enabled: false };
    this.prefix = this.config.prefix || "nest_shield";
    this.anomalyDetectionConfig = this.options.advanced?.adaptiveProtection?.anomalyDetection;
    this.anomalyDetectionEnabled = this.anomalyDetectionConfig?.enabled || false;

    // Check if enhanced components are available
    this.enhancedMode = !!(
      TimeWindowAggregator &&
      RollingWindowAggregator &&
      PercentileAggregator &&
      BaseMetricsCollector
    );

    if (this.enhancedMode) {
      this.initializeEnhancedMode();
    }

    this.collector = this.createCollector();

    if (this.enhancedMode) {
      this.createExporter();
    }
  }

  async onModuleInit(): Promise<void> {
    // Load enhanced components if available
    try {
      const collectors = await import("../metrics/collectors");
      PrometheusCollector = collectors.PrometheusCollector;
      StatsDCollector = collectors.StatsDCollector;
      DatadogCollector = collectors.DatadogCollector;
      CloudWatchCollector = collectors.CloudWatchCollector;
      CustomMetricsCollector = collectors.CustomMetricsCollector;
      BaseMetricsCollector = collectors.BaseMetricsCollector;

      const aggregators = await import("../metrics/aggregators");
      TimeWindowAggregator = aggregators.TimeWindowAggregator;
      RollingWindowAggregator = aggregators.RollingWindowAggregator;
      PercentileAggregator = aggregators.PercentileAggregator;

      const exporters = await import("../metrics/exporters");
      PrometheusExporter = exporters.PrometheusExporter;
      JsonExporter = exporters.JsonExporter;
      OpenMetricsExporter = exporters.OpenMetricsExporter;

      this.enhancedMode = true;
    } catch {
      // Enhanced components not available, will fall back to basic implementation
      this.enhancedMode = false;
    }

    if (this.enhancedMode && this.collector && typeof this.collector.connect === "function") {
      await this.collector.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.enhancedMode && this.collector && typeof this.collector.disconnect === "function") {
      await this.collector.disconnect();
    }
  }

  private initializeEnhancedMode(): void {
    // Initialize aggregators
    this.timeWindowAggregator = new TimeWindowAggregator(
      this.config.windowSize || 60000, // 1 minute
      this.config.maxWindows || 60, // 1 hour
    );
    this.rollingWindowAggregator = new RollingWindowAggregator(
      this.config.rollingWindowSize || 300000, // 5 minutes
    );
    this.percentileAggregator = new PercentileAggregator();
  }

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.increment(metricName, value, mergedLabels);

    if (this.enhancedMode) {
      // Update aggregators
      const key = this.createAggregatorKey(metricName, mergedLabels);
      this.rollingWindowAggregator.addValue(key, value);
      this.timeWindowAggregator.addMetric({
        name: metricName,
        type: "counter",
        value,
        timestamp: Date.now(),
        labels: mergedLabels,
      });

      // Detect anomalies if enabled
      void this.detectAnomaliesForMetric(metricName, value, mergedLabels, "counter");
    }
  }

  decrement(metric: string, value: number = 1, labels?: Record<string, string>): void {
    this.increment(metric, -value, labels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.gauge(metricName, value, mergedLabels);

    if (this.enhancedMode) {
      // Update aggregators
      const key = this.createAggregatorKey(metricName, mergedLabels);
      this.rollingWindowAggregator.addValue(key, value);
      this.timeWindowAggregator.addMetric({
        name: metricName,
        type: "gauge",
        value,
        timestamp: Date.now(),
        labels: mergedLabels,
      });

      // Detect anomalies if enabled
      void this.detectAnomaliesForMetric(metricName, value, mergedLabels, "gauge");
    }
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.histogram(metricName, value, mergedLabels);

    if (this.enhancedMode) {
      // Update aggregators
      const key = this.createAggregatorKey(metricName, mergedLabels);
      this.rollingWindowAggregator.addValue(key, value);
      this.percentileAggregator.addValue(key, value);
      this.timeWindowAggregator.addMetric({
        name: metricName,
        type: "histogram",
        value,
        timestamp: Date.now(),
        labels: mergedLabels,
      });

      // Detect anomalies if enabled
      void this.detectAnomaliesForMetric(metricName, value, mergedLabels, "histogram");
    }
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.summary(metricName, value, mergedLabels);

    if (this.enhancedMode) {
      // Update aggregators
      const key = this.createAggregatorKey(metricName, mergedLabels);
      this.rollingWindowAggregator.addValue(key, value);
      this.percentileAggregator.addValue(key, value);
      this.timeWindowAggregator.addMetric({
        name: metricName,
        type: "summary",
        value,
        timestamp: Date.now(),
        labels: mergedLabels,
      });

      // Detect anomalies if enabled
      void this.detectAnomaliesForMetric(metricName, value, mergedLabels, "summary");
    }
  }

  startTimer(metric: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.histogram(metric, duration / 1000, labels);
    };
  }

  // Enhanced methods (only available when enhanced components are loaded)
  getRollingStatistics(
    metric: string,
    labels?: Record<string, string>,
  ): {
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
  } | null {
    if (!this.enhancedMode || !this.rollingWindowAggregator) {
      return null;
    }

    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    return this.rollingWindowAggregator.getStatistics(key);
  }

  getPercentiles(
    metric: string,
    labels?: Record<string, string>,
    percentiles: number[] = [50, 90, 95, 99],
  ): Record<string, number | null> | null {
    if (!this.enhancedMode || !this.percentileAggregator) {
      return null;
    }

    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    return this.percentileAggregator.getPercentiles(key, percentiles);
  }

  getTimeSeriesData(
    metric: string,
    labels?: Record<string, string>,
    windowCount: number = 60,
  ): Array<{ timestamp: number; value: number; count: number }> | null {
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
  async exportPrometheus(): Promise<string> {
    if (this.enhancedMode && this.exporter && this.exporter instanceof PrometheusExporter) {
      return this.exporter.export();
    }
    throw new Error("Prometheus exporter not available");
  }

  async exportJson(): Promise<any> {
    if (this.enhancedMode && this.exporter) {
      return this.exporter.exportJson();
    }
    return { error: "Enhanced mode not available" };
  }

  async exportMetrics(
    format: "prometheus" | "json" | "openmetrics" = "json",
  ): Promise<string | any> {
    if (!this.enhancedMode) {
      return { error: "Enhanced export not available" };
    }

    switch (format) {
      case "prometheus":
        return this.exportPrometheus();
      case "json":
        return this.exportJson();
      case "openmetrics":
        if (this.exporter && this.exporter instanceof OpenMetricsExporter) {
          return this.exporter.export();
        }
        throw new Error("OpenMetrics exporter not available");
      default:
        return this.exportJson();
    }
  }

  // Utility methods
  resetMetric(metric: string, labels?: Record<string, string>): void {
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
    if (this.collector && typeof this.collector.reset === "function") {
      this.collector.reset();
    }
  }

  // Health check method
  getHealth(): { status: "healthy" | "unhealthy"; details: any } {
    try {
      const details: any = {
        collectorType: this.config.type,
        enabled: this.config.enabled,
        enhancedMode: this.enhancedMode,
        lastUpdate: Date.now(),
        anomalyDetectionEnabled: this.anomalyDetectionEnabled,
      };

      if (this.enhancedMode && this.rollingWindowAggregator) {
        details.metricsCount = this.rollingWindowAggregator.getAllKeys().length;
      }

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
          enabled: this.config.enabled,
          enhancedMode: this.enhancedMode,
        },
      };
    }
  }

  // Anomaly detection methods
  private async detectAnomaliesForMetric(
    metricName: string,
    value: number,
    labels: Record<string, string>,
    type: string,
  ): Promise<void> {
    if (!this.anomalyDetectionEnabled) {
      return;
    }

    try {
      // Basic anomaly detection based on statistical thresholds
      // This replaces the dependency on AnomalyDetectionService
      const key = this.createAggregatorKey(metricName, labels);
      const stats = this.rollingWindowAggregator?.getStatistics(key);

      if (stats && stats.count > 10) {
        // Need sufficient data points
        const zScore = Math.abs((value - stats.average) / (stats.stdDev || 1));

        if (zScore > 3) {
          // Simple z-score threshold
          this.handleAnomalyDetected({
            data: { metricName, value, labels, type },
            severity: zScore > 5 ? "high" : "medium",
            score: zScore,
            type: "statistical",
            detector: "z-score",
            description: `Value ${value} deviates significantly from average ${stats.average.toFixed(2)}`,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      // Log error but don't fail metric collection
      this.logger.metricsWarn(`Anomaly detection failed for metric ${metricName}`, {
        operation: "anomaly_detection",
        metadata: { metricName, error: error.message },
      });
    }
  }

  private handleAnomalyDetected(anomaly: any): void {
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

  // Method to enable/disable anomaly detection at runtime
  setAnomalyDetectionEnabled(enabled: boolean): void {
    this.anomalyDetectionEnabled = enabled;
  }

  // Method to check if anomaly detection is enabled
  isAnomalyDetectionEnabled(): boolean {
    return this.anomalyDetectionEnabled;
  }

  // Check if enhanced mode is available
  isEnhancedModeAvailable(): boolean {
    return this.enhancedMode;
  }

  private formatMetricName(metric: string): string {
    return `${this.prefix}_${metric}`;
  }

  private mergeLabels(labels?: Record<string, string>): Record<string, string> {
    return {
      ...this.config.labels,
      ...labels,
    };
  }

  private createAggregatorKey(metric: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return metric;
    }
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((key) => `${key}="${labels[key]}"`)
      .join(",");
    return `${metric}{${sortedLabels}}`;
  }

  private createCollector(): any {
    if (!this.config.enabled) {
      return new NoOpMetricsCollector();
    }

    if (this.config.customCollector) {
      if (this.enhancedMode && CustomMetricsCollector) {
        return new CustomMetricsCollector(this.config.customCollector);
      }
      return this.config.customCollector;
    }

    if (this.enhancedMode) {
      return this.createEnhancedCollector();
    } else {
      return this.createBasicCollector();
    }
  }

  private createEnhancedCollector(): any {
    const collectorConfig = {
      type: this.config.type,
      prefix: this.prefix,
      labels: this.config.labels,
      buckets: this.config.buckets,
      percentiles: this.config.percentiles,
      flushInterval: this.config.flushInterval,
      maxBufferSize: this.config.maxBufferSize,
      ...this.config.collectorOptions,
    };

    switch (this.config.type) {
      case "prometheus":
        return new PrometheusCollector(collectorConfig);
      case "statsd":
        return new StatsDCollector(collectorConfig);
      case "datadog":
        return new DatadogCollector(collectorConfig);
      case "cloudwatch":
        return new CloudWatchCollector(collectorConfig);
      default:
        return new NoOpMetricsCollector();
    }
  }

  private createBasicCollector(): IMetricsCollector {
    switch (this.config.type) {
      case "prometheus":
        return this.createPrometheusCollector();
      case "statsd":
        return this.createStatsdCollector();
      default:
        return new NoOpMetricsCollector();
    }
  }

  private createPrometheusCollector(): IMetricsCollector {
    const metrics: Record<string, any> = {};

    return {
      increment: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "counter", value: 0, labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!metrics[metric].labels[labelKey]) {
          metrics[metric].labels[labelKey] = 0;
        }
        metrics[metric].labels[labelKey] += value;
      },

      decrement: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        this.increment(metric, -value, labels);
      },

      gauge: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "gauge", labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        metrics[metric].labels[labelKey] = value;
      },

      histogram: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = {
            type: "histogram",
            buckets: this.config.buckets || [
              0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
            ],
            labels: {},
          };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!metrics[metric].labels[labelKey]) {
          metrics[metric].labels[labelKey] = [];
        }
        metrics[metric].labels[labelKey].push(value);
      },

      summary: (metric: string, value: number, labels?: Record<string, string>) => {
        if (!metrics[metric]) {
          metrics[metric] = { type: "summary", labels: {} };
        }
        const labelKey = JSON.stringify(labels || {});
        if (!metrics[metric].labels[labelKey]) {
          metrics[metric].labels[labelKey] = [];
        }
        metrics[metric].labels[labelKey].push(value);
      },
    };
  }

  private createStatsdCollector(): IMetricsCollector {
    const buffer: Array<{
      metric: string;
      value: number;
      type: string;
      labels?: Record<string, string>;
    }> = [];

    return {
      increment: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "c", labels });
      },

      decrement: (metric: string, value: number = 1, labels?: Record<string, string>) => {
        buffer.push({ metric, value: -value, type: "c", labels });
      },

      gauge: (metric: string, value: number, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "g", labels });
      },

      histogram: (metric: string, value: number, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "h", labels });
      },

      summary: (metric: string, value: number, labels?: Record<string, string>) => {
        buffer.push({ metric, value, type: "ms", labels });
      },
    };
  }

  private createExporter(): void {
    if (!this.enhancedMode || !this.config.enabled || !BaseMetricsCollector) {
      return;
    }

    if (!(this.collector instanceof BaseMetricsCollector)) {
      return;
    }

    const exporterConfig = {
      format: this.config.type as any,
      includeTimestamp: this.config.includeTimestamp,
      includeHelp: this.config.includeHelp,
      groupByName: this.config.groupByName,
    };

    switch (this.config.type) {
      case "prometheus":
        if (PrometheusExporter) {
          this.exporter = new PrometheusExporter(this.collector, exporterConfig);
        }
        break;
      case "json":
        if (JsonExporter) {
          this.exporter = new JsonExporter(this.collector, exporterConfig);
        }
        break;
      case "openmetrics":
        if (OpenMetricsExporter) {
          this.exporter = new OpenMetricsExporter(this.collector, exporterConfig);
        }
        break;
    }
  }

  getCollector(): IMetricsCollector {
    return this.collector;
  }
}
