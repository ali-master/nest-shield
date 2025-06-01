import { Injectable, Logger } from "@nestjs/common";
import { BaseMetricsCollector } from "./base.collector";
import { ICollectorConfig } from "../interfaces/collector.interface";
import { MetricType } from "../interfaces/metrics.interface";

interface CloudWatchConfig extends ICollectorConfig {
  region?: string;
  namespace?: string;
  batchSize?: number;
  storageResolution?: 1 | 60; // 1 second or 60 seconds
  dimensions?: Record<string, string>;
}

interface CloudWatchMetric {
  MetricName: string;
  Value?: number;
  Values?: number[];
  Counts?: number[];
  Unit?: string;
  Timestamp?: Date;
  Dimensions?: Array<{ Name: string; Value: string }>;
  StorageResolution?: number;
  StatisticValues?: {
    SampleCount: number;
    Sum: number;
    Minimum: number;
    Maximum: number;
  };
}

@Injectable()
export class CloudWatchCollector extends BaseMetricsCollector {
  private readonly logger = new Logger(CloudWatchCollector.name);
  private metricsBuffer: CloudWatchMetric[] = [];
  private flushTimer?: NodeJS.Timeout;
  private cloudWatchConfig: CloudWatchConfig;
  private cloudWatchClient?: any; // AWS CloudWatch client would be injected

  constructor(config: CloudWatchConfig) {
    super(config);
    this.cloudWatchConfig = {
      region: "us-east-1",
      namespace: "NestShield",
      batchSize: 20,
      flushInterval: 60000, // 1 minute
      storageResolution: 60,
      ...config,
    };
  }

  async connect(): Promise<void> {
    // Initialize AWS CloudWatch client here
    // this.cloudWatchClient = new AWS.CloudWatch({ region: this.cloudWatchConfig.region });

    // Start flush timer
    this.startFlushTimer();
  }

  async disconnect(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error("Failed to flush metrics to CloudWatch:", error);
      });
    }, this.cloudWatchConfig.flushInterval || 60000);
  }

  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    // Process metrics in batches
    while (this.metricsBuffer.length > 0) {
      const batch = this.metricsBuffer.splice(0, this.cloudWatchConfig.batchSize || 20);
      await this.putMetrics(batch);
    }
  }

  private async putMetrics(metrics: CloudWatchMetric[]): Promise<void> {
    if (!this.cloudWatchClient) {
      this.logger.warn("CloudWatch client not initialized");
      return;
    }

    const params = {
      Namespace: this.cloudWatchConfig.namespace,
      MetricData: metrics,
    };

    try {
      // await this.cloudWatchClient.putMetricData(params).promise();
      this.logger.debug(`Sent ${metrics.length} metrics to CloudWatch`);
    } catch (error) {
      this.logger.error("Failed to send metrics to CloudWatch:", error);
      throw error;
    }
  }

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    super.increment(metric, value, labels);

    const cloudWatchMetric: CloudWatchMetric = {
      MetricName: metric,
      Value: value,
      Unit: "Count",
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(labels),
      StorageResolution: this.cloudWatchConfig.storageResolution,
    };

    this.addToBuffer(cloudWatchMetric);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    super.gauge(metric, value, labels);

    const cloudWatchMetric: CloudWatchMetric = {
      MetricName: metric,
      Value: value,
      Unit: "None",
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(labels),
      StorageResolution: this.cloudWatchConfig.storageResolution,
    };

    this.addToBuffer(cloudWatchMetric);
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    super.histogram(metric, value, labels);

    // For histograms, we'll aggregate values and send statistics
    const existing = this.findExistingMetric(metric, labels);

    if (existing) {
      if (!existing.Values) {
        existing.Values = [];
        existing.Counts = [];
      }
      existing.Values.push(value);
      existing.Counts!.push(1);
    } else {
      const cloudWatchMetric: CloudWatchMetric = {
        MetricName: metric,
        Values: [value],
        Counts: [1],
        Unit: "None",
        Timestamp: new Date(),
        Dimensions: this.formatDimensions(labels),
        StorageResolution: this.cloudWatchConfig.storageResolution,
      };

      this.addToBuffer(cloudWatchMetric);
    }
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    super.summary(metric, value, labels);

    // For summaries, we'll calculate statistics
    const existing = this.findExistingMetric(metric, labels);

    if (existing) {
      if (!existing.StatisticValues) {
        existing.StatisticValues = {
          SampleCount: 0,
          Sum: 0,
          Minimum: Number.MAX_VALUE,
          Maximum: Number.MIN_VALUE,
        };
      }

      existing.StatisticValues.SampleCount++;
      existing.StatisticValues.Sum += value;
      existing.StatisticValues.Minimum = Math.min(existing.StatisticValues.Minimum, value);
      existing.StatisticValues.Maximum = Math.max(existing.StatisticValues.Maximum, value);
    } else {
      const cloudWatchMetric: CloudWatchMetric = {
        MetricName: metric,
        StatisticValues: {
          SampleCount: 1,
          Sum: value,
          Minimum: value,
          Maximum: value,
        },
        Unit: "None",
        Timestamp: new Date(),
        Dimensions: this.formatDimensions(labels),
        StorageResolution: this.cloudWatchConfig.storageResolution,
      };

      this.addToBuffer(cloudWatchMetric);
    }
  }

  private formatDimensions(labels?: Record<string, string>): CloudWatchMetric["Dimensions"] {
    const dimensions: Array<{ Name: string; Value: string }> = [];

    // Add global dimensions
    if (this.cloudWatchConfig.dimensions) {
      Object.entries(this.cloudWatchConfig.dimensions).forEach(([name, value]) => {
        dimensions.push({ Name: name, Value: value });
      });
    }

    // Add metric-specific labels
    if (labels) {
      Object.entries(labels).forEach(([name, value]) => {
        dimensions.push({ Name: name, Value: value });
      });
    }

    // CloudWatch has a limit of 10 dimensions per metric
    return dimensions.slice(0, 10);
  }

  private findExistingMetric(
    name: string,
    labels?: Record<string, string>,
  ): CloudWatchMetric | undefined {
    const dimensions = this.formatDimensions(labels);

    return this.metricsBuffer.find(
      (metric) => metric.MetricName === name && this.dimensionsMatch(metric.Dimensions, dimensions),
    );
  }

  private dimensionsMatch(
    dims1?: Array<{ Name: string; Value: string }>,
    dims2?: Array<{ Name: string; Value: string }>,
  ): boolean {
    if (!dims1 && !dims2) return true;
    if (!dims1 || !dims2) return false;
    if (dims1.length !== dims2.length) return false;

    const sorted1 = [...dims1].sort((a, b) => a.Name.localeCompare(b.Name));
    const sorted2 = [...dims2].sort((a, b) => a.Name.localeCompare(b.Name));

    return sorted1.every(
      (dim, index) => dim.Name === sorted2[index].Name && dim.Value === sorted2[index].Value,
    );
  }

  private addToBuffer(metric: CloudWatchMetric): void {
    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= (this.cloudWatchConfig.batchSize || 20)) {
      this.flush().catch((error) => {
        this.logger.error("Failed to flush buffer:", error);
      });
    }
  }
}
