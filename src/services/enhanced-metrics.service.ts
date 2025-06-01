import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { IMetricsConfig, IMetricsCollector } from "../interfaces/shield-config.interface";
import { SHIELD_MODULE_OPTIONS } from "../core/constants";
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

  constructor(@Inject(SHIELD_MODULE_OPTIONS) private readonly options: any) {
    this.config = this.options.metrics || { enabled: false };
    this.prefix = this.config.prefix || "nest_shield";

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
        this.exporter = new JsonExporter(this.collector as BaseMetricsCollector, exporterConfig);
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
}

class NoOpMetricsCollector implements IMetricsCollector {
  increment(metric: string, value?: number, labels?: Record<string, string>): void {}
  decrement(metric: string, value?: number, labels?: Record<string, string>): void {}
  gauge(metric: string, value: number, labels?: Record<string, string>): void {}
  histogram(metric: string, value: number, labels?: Record<string, string>): void {}
  summary(metric: string, value: number, labels?: Record<string, string>): void {}
}
