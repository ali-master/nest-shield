import type { ShieldLoggerService } from "../../services/shield-logger.service";
import type {
  IRollingWindowAggregator,
  IAnomalyDetectionConfig,
  IAnomalyData,
  IAnomaly,
} from "../types";

export class MetricsAnomalyDetectionService {
  private enabled: boolean;
  private config: IAnomalyDetectionConfig;

  constructor(
    private readonly logger: ShieldLoggerService,
    config?: IAnomalyDetectionConfig,
  ) {
    this.config = {
      enabled: false,
      thresholds: {
        zScoreThreshold: 3,
        minimumDataPoints: 10,
      },
      ...config,
    };
    this.enabled = this.config.enabled;
  }

  async detectAnomaly(
    metricName: string,
    value: number,
    labels: Record<string, string>,
    type: string,
    rollingWindowAggregator?: IRollingWindowAggregator,
  ): Promise<IAnomaly | null> {
    if (!this.enabled || !rollingWindowAggregator) {
      return null;
    }

    try {
      const key = this.createAggregatorKey(metricName, labels);
      const stats = rollingWindowAggregator.getStatistics(key);

      if (!stats || stats.count < (this.config.thresholds?.minimumDataPoints || 10)) {
        return null;
      }

      const zScore = Math.abs((value - stats.average) / (stats.stdDev || 1));
      const threshold = this.config.thresholds?.zScoreThreshold || 3;

      if (zScore > threshold) {
        return this.createAnomaly({ metricName, value, labels, type }, zScore, stats.average);
      }

      return null;
    } catch (error) {
      this.logger.metricsWarn(`Anomaly detection failed for metric ${metricName}`, {
        operation: "anomaly_detection",
        metadata: { metricName, error: (error as Error).message },
      });
      return null;
    }
  }

  private createAnomaly(data: IAnomalyData, zScore: number, average: number): IAnomaly {
    return {
      data,
      severity: zScore > 5 ? "high" : zScore > 4 ? "medium" : "low",
      score: zScore,
      type: "statistical",
      detector: "z-score",
      description: `Value ${data.value} deviates significantly from average ${average.toFixed(2)} (z-score: ${zScore.toFixed(2)})`,
      timestamp: Date.now(),
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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  updateConfig(config: Partial<IAnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.enabled = this.config.enabled;
  }

  getConfig(): IAnomalyDetectionConfig {
    return { ...this.config };
  }
}
