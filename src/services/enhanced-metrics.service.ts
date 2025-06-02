import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { IMetricsConfig, IMetricsCollector } from "../interfaces/shield-config.interface";
import { SHIELD_MODULE_OPTIONS } from "../core/constants";
import { AnomalyDetectionService } from "./anomaly-detection.service";
import { IAnomalyData } from "../anomaly-detection";
import {
  PrometheusCollector,
  StatsDCollector,
  DatadogCollector,
  CloudWatchCollector,
  CustomMetricsCollector,
  BaseMetricsCollector,
} from "../metrics/collectors";
import {
  TimeWindowAggregator,
  RollingWindowAggregator,
  PercentileAggregator,
} from "../metrics/aggregators";
import { PrometheusExporter, JsonExporter, OpenMetricsExporter } from "../metrics/exporters";

@Injectable()
export class EnhancedMetricsService implements IMetricsCollector, OnModuleInit, OnModuleDestroy {
  private collector: BaseMetricsCollector | IMetricsCollector;
  private config: IMetricsConfig;
  private prefix: string;
  private timeWindowAggregator: TimeWindowAggregator;
  private rollingWindowAggregator: RollingWindowAggregator;
  private percentileAggregator: PercentileAggregator;
  private exporter?: PrometheusExporter | JsonExporter | OpenMetricsExporter;
  private anomalyDetectionService?: AnomalyDetectionService;
  private anomalyDetectionEnabled = false;
  private anomalyDetectionConfig?: any;

  constructor(
    @Inject(SHIELD_MODULE_OPTIONS) private readonly options: any,
    private readonly anomalyDetection?: AnomalyDetectionService,
  ) {
    this.config = this.options.metrics || { enabled: false };
    this.prefix = this.config.prefix || "nest_shield";
    this.anomalyDetectionConfig = this.options.advanced?.adaptiveProtection?.anomalyDetection;
    this.anomalyDetectionEnabled = this.anomalyDetectionConfig?.enabled || false;

    if (this.anomalyDetectionEnabled && this.anomalyDetection) {
      this.anomalyDetectionService = this.anomalyDetection;
    }

    // Initialize aggregators
    this.timeWindowAggregator = new TimeWindowAggregator(
      this.config.windowSize || 60000, // 1 minute
      this.config.maxWindows || 60, // 1 hour
    );
    this.rollingWindowAggregator = new RollingWindowAggregator(
      this.config.rollingWindowSize || 300000, // 5 minutes
    );
    this.percentileAggregator = new PercentileAggregator();

    // Create collector
    this.collector = this.createCollector();

    // Create exporter
    this.createExporter();
  }

  async onModuleInit(): Promise<void> {
    if (this.collector instanceof BaseMetricsCollector) {
      await this.collector.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.collector instanceof BaseMetricsCollector) {
      await this.collector.disconnect();
    }
  }

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.increment(metricName, value, mergedLabels);

    // Update aggregators
    const key = this.createAggregatorKey(metricName, mergedLabels);
    this.rollingWindowAggregator.addValue(key, value);
    this.timeWindowAggregator.addMetric({
      name: metricName,
      type: "counter" as any,
      value,
      timestamp: Date.now(),
      labels: mergedLabels,
    });

    // Detect anomalies if enabled
    this.detectAnomaliesForMetric(metricName, value, mergedLabels, "counter");
  }

  decrement(metric: string, value: number = 1, labels?: Record<string, string>): void {
    this.increment(metric, -value, labels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.gauge(metricName, value, mergedLabels);

    // Update aggregators
    const key = this.createAggregatorKey(metricName, mergedLabels);
    this.rollingWindowAggregator.addValue(key, value);
    this.timeWindowAggregator.addMetric({
      name: metricName,
      type: "gauge" as any,
      value,
      timestamp: Date.now(),
      labels: mergedLabels,
    });

    // Detect anomalies if enabled
    this.detectAnomaliesForMetric(metricName, value, mergedLabels, "gauge");
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.histogram(metricName, value, mergedLabels);

    // Update aggregators
    const key = this.createAggregatorKey(metricName, mergedLabels);
    this.rollingWindowAggregator.addValue(key, value);
    this.percentileAggregator.addValue(key, value);
    this.timeWindowAggregator.addMetric({
      name: metricName,
      type: "histogram" as any,
      value,
      timestamp: Date.now(),
      labels: mergedLabels,
    });

    // Detect anomalies if enabled
    this.detectAnomaliesForMetric(metricName, value, mergedLabels, "histogram");
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const mergedLabels = this.mergeLabels(labels);

    this.collector.summary(metricName, value, mergedLabels);

    // Update aggregators
    const key = this.createAggregatorKey(metricName, mergedLabels);
    this.rollingWindowAggregator.addValue(key, value);
    this.percentileAggregator.addValue(key, value);
    this.timeWindowAggregator.addMetric({
      name: metricName,
      type: "summary" as any,
      value,
      timestamp: Date.now(),
      labels: mergedLabels,
    });

    // Detect anomalies if enabled
    this.detectAnomaliesForMetric(metricName, value, mergedLabels, "summary");
  }

  // Enhanced timer with labels
  startTimer(metric: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.histogram(metric, duration / 1000, labels);
    };
  }

  // Advanced aggregation methods
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
  } {
    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    return this.rollingWindowAggregator.getStatistics(key);
  }

  getPercentiles(
    metric: string,
    labels?: Record<string, string>,
    percentiles: number[] = [50, 90, 95, 99],
  ): Record<string, number | null> {
    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    return this.percentileAggregator.getPercentiles(key, percentiles);
  }

  getTimeSeriesData(
    metric: string,
    labels?: Record<string, string>,
    windowCount: number = 60,
  ): Array<{ timestamp: number; value: number; count: number }> {
    const metricName = this.formatMetricName(metric);
    return this.timeWindowAggregator.getTimeSeriesData(
      metricName,
      this.mergeLabels(labels),
      windowCount,
    );
  }

  // Export methods
  async exportPrometheus(): Promise<string> {
    if (this.exporter && this.exporter instanceof PrometheusExporter) {
      return this.exporter.export();
    }
    throw new Error("Prometheus exporter not configured");
  }

  async exportJson(): Promise<any> {
    if (this.exporter) {
      return this.exporter.exportJson();
    }
    return { error: "No exporter configured" };
  }

  async exportMetrics(
    format: "prometheus" | "json" | "openmetrics" = "json",
  ): Promise<string | any> {
    switch (format) {
      case "prometheus":
        return this.exportPrometheus();
      case "json":
        return this.exportJson();
      case "openmetrics":
        if (this.exporter && this.exporter instanceof OpenMetricsExporter) {
          return this.exporter.export();
        }
        throw new Error("OpenMetrics exporter not configured");
      default:
        return this.exportJson();
    }
  }

  // Utility methods
  resetMetric(metric: string, labels?: Record<string, string>): void {
    const metricName = this.formatMetricName(metric);
    const key = this.createAggregatorKey(metricName, this.mergeLabels(labels));
    this.rollingWindowAggregator.clearKey(key);
    this.percentileAggregator.reset(key);
  }

  resetAllMetrics(): void {
    this.rollingWindowAggregator.clear();
    this.percentileAggregator.resetAll();
    if (this.collector instanceof BaseMetricsCollector) {
      this.collector.reset();
    }
  }

  // Health check method
  getHealth(): { status: "healthy" | "unhealthy"; details: any } {
    try {
      const stats = this.getRollingStatistics("health_check");
      return {
        status: "healthy",
        details: {
          collectorType: this.config.type,
          enabled: this.config.enabled,
          metricsCount: this.rollingWindowAggregator.getAllKeys().length,
          lastUpdate: Date.now(),
          anomalyDetectionEnabled: this.anomalyDetectionEnabled,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: (error as Error).message,
          collectorType: this.config.type,
          enabled: this.config.enabled,
        },
      };
    }
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

  private createCollector(): BaseMetricsCollector | IMetricsCollector {
    if (!this.config.enabled) {
      return new NoOpMetricsCollector();
    }

    if (this.config.customCollector) {
      return new CustomMetricsCollector(this.config.customCollector);
    }

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

  private createExporter(): void {
    if (!this.config.enabled || !(this.collector instanceof BaseMetricsCollector)) {
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
        this.exporter = new PrometheusExporter(
          this.collector as PrometheusCollector,
          exporterConfig,
        );
        break;
      case "json":
        this.exporter = new JsonExporter(this.collector, exporterConfig);
        break;
      case "openmetrics":
        this.exporter = new OpenMetricsExporter(
          this.collector as PrometheusCollector,
          exporterConfig,
        );
        break;
    }
  }

  getCollector(): IMetricsCollector {
    return this.collector;
  }

  // Anomaly detection methods
  private async detectAnomaliesForMetric(
    metricName: string,
    value: number,
    labels: Record<string, string>,
    type: string,
  ): Promise<void> {
    if (!this.anomalyDetectionEnabled || !this.anomalyDetectionService) {
      return;
    }

    try {
      const anomalyData: IAnomalyData = {
        metricName,
        value,
        timestamp: Date.now(),
        labels,
        type: type as any,
      };

      const anomalies = await this.anomalyDetectionService.detectAnomalies([anomalyData]);

      if (anomalies.length > 0) {
        for (const anomaly of anomalies) {
          this.handleAnomalyDetected(anomaly);
        }
      }
    } catch (error) {
      // Log error but don't fail metric collection
      console.warn(`Anomaly detection failed for metric ${metricName}:`, error);
    }
  }

  private handleAnomalyDetected(anomaly: any): void {
    // Increment anomaly counter
    this.increment("anomalies_detected", 1, {
      severity: anomaly.severity,
      type: anomaly.type,
      detector: anomaly.detector,
    });

    // Log anomaly (could be enhanced with proper logging service)
    console.warn("Anomaly detected:", {
      metric: anomaly.data.metricName,
      value: anomaly.data.value,
      severity: anomaly.severity,
      score: anomaly.score,
      description: anomaly.description,
      timestamp: new Date(anomaly.timestamp).toISOString(),
    });
  }

  // Method to get detected anomalies for a specific metric
  async getAnomaliesForMetric(
    metricName: string,
    startTime?: number,
    endTime?: number,
  ): Promise<any[]> {
    if (!this.anomalyDetectionService) {
      return [];
    }

    const timeSeriesData = this.getTimeSeriesData(metricName);
    const anomalyDataPoints: IAnomalyData[] = timeSeriesData
      .filter((point) => {
        if (startTime && point.timestamp < startTime) return false;
        if (endTime && point.timestamp > endTime) return false;
        return true;
      })
      .map((point) => ({
        metricName: this.formatMetricName(metricName),
        value: point.value,
        timestamp: point.timestamp,
        labels: {},
        type: "gauge" as any,
      }));

    return await this.anomalyDetectionService.detectAnomalies(anomalyDataPoints);
  }

  // Method to enable/disable anomaly detection at runtime
  setAnomalyDetectionEnabled(enabled: boolean): void {
    this.anomalyDetectionEnabled = enabled && !!this.anomalyDetectionService;
  }

  // Method to check if anomaly detection is enabled
  isAnomalyDetectionEnabled(): boolean {
    return this.anomalyDetectionEnabled;
  }
}

class NoOpMetricsCollector implements IMetricsCollector {
  increment(metric: string, value?: number, labels?: Record<string, string>): void {}
  decrement(metric: string, value?: number, labels?: Record<string, string>): void {}
  gauge(metric: string, value: number, labels?: Record<string, string>): void {}
  histogram(metric: string, value: number, labels?: Record<string, string>): void {}
  summary(metric: string, value: number, labels?: Record<string, string>): void {}
}
