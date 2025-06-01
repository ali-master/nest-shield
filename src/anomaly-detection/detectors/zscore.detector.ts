import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import { IAnomalyData, IAnomaly, AnomalyType } from "../interfaces/anomaly.interface";
import { IDetectorContext } from "../interfaces/detector.interface";

@Injectable()
export class ZScoreDetector extends BaseAnomalyDetector {
  readonly name = "Z-Score Detector";
  readonly version = "1.0.0";
  readonly description = "Statistical anomaly detection using Z-Score analysis";

  private baseline: IBaseline | null = null;
  private rollingWindow: number[] = [];

  async detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isReady() || data.length === 0) {
      return [];
    }

    const anomalies: IAnomaly[] = [];

    for (const dataPoint of data) {
      // Skip if in maintenance window
      if (this.isMaintenanceWindow(dataPoint.timestamp, context)) {
        continue;
      }

      const anomaly = await this.detectSinglePoint(dataPoint, context);
      if (anomaly) {
        const processedAnomaly = this.applyBusinessRules(anomaly);
        if (processedAnomaly) {
          anomalies.push(processedAnomaly);
        }
      }

      // Update rolling window
      this.updateRollingWindow(dataPoint.value);
    }

    return anomalies;
  }

  private async detectSinglePoint(
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): Promise<IAnomaly | null> {
    if (!this.baseline) {
      return null;
    }

    // Calculate Z-score using baseline
    const zScore = this.calculateZScore(dataPoint.value, this.baseline.mean, this.baseline.stdDev);

    // Check if it's anomalous
    if (zScore < this.config.threshold) {
      return null;
    }

    // Calculate modified Z-score using rolling window for better accuracy
    const modifiedZScore =
      this.rollingWindow.length >= this.config.minDataPoints
        ? this.calculateModifiedZScore(dataPoint.value, this.rollingWindow)
        : zScore;

    // Determine anomaly type
    const anomalyType = this.determineAnomalyType(dataPoint.value, this.baseline);

    // Calculate confidence based on various factors
    const confidence = this.calculateConfidence(zScore, modifiedZScore, context);

    // Normalize score to 0-1 range
    const normalizedScore = Math.min(zScore / (this.config.threshold * 2), 1);

    const description =
      `Z-Score anomaly detected: value=${dataPoint.value.toFixed(2)}, ` +
      `z-score=${zScore.toFixed(2)}, expected=${this.baseline.mean.toFixed(2)} ± ${this.baseline.stdDev.toFixed(2)}`;

    return this.createAnomaly(
      dataPoint,
      anomalyType,
      normalizedScore,
      confidence,
      description,
      this.baseline.mean,
    );
  }

  private determineAnomalyType(value: number, baseline: IBaseline): AnomalyType {
    const upperBound = baseline.mean + this.config.threshold * baseline.stdDev;
    const lowerBound = baseline.mean - this.config.threshold * baseline.stdDev;

    if (value > upperBound) {
      // Check if it's a significant spike
      const spikeThreshold = baseline.mean + 3 * baseline.stdDev;
      return value > spikeThreshold ? AnomalyType.SPIKE : AnomalyType.OUTLIER;
    } else if (value < lowerBound) {
      // Check if it's a significant drop
      const dropThreshold = baseline.mean - 3 * baseline.stdDev;
      return value < dropThreshold ? AnomalyType.DROP : AnomalyType.OUTLIER;
    }

    return AnomalyType.OUTLIER;
  }

  private calculateConfidence(
    zScore: number,
    modifiedZScore: number,
    context?: IDetectorContext,
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher Z-scores increase confidence
    confidence += Math.min(zScore / 10, 0.3);

    // Consistency between Z-score and modified Z-score increases confidence
    const consistency = 1 - Math.abs(zScore - modifiedZScore) / Math.max(zScore, modifiedZScore, 1);
    confidence += consistency * 0.2;

    // Recent deployments decrease confidence
    if (context && this.hasRecentDeployment(Date.now(), context)) {
      confidence -= 0.15;
    }

    // Window size affects confidence
    const windowConfidence = Math.min(this.rollingWindow.length / this.config.windowSize, 1);
    confidence *= windowConfidence;

    return Math.min(Math.max(confidence, 0), 1);
  }

  private updateRollingWindow(value: number): void {
    this.rollingWindow.push(value);

    if (this.rollingWindow.length > this.config.windowSize) {
      this.rollingWindow.shift();
    }

    // Update baseline if we have enough data
    if (this.rollingWindow.length >= this.config.minDataPoints) {
      this.updateBaseline();
    }
  }

  private updateBaseline(): void {
    const stats = this.calculateStatistics(this.rollingWindow);
    this.baseline = {
      mean: stats.mean,
      stdDev: stats.stdDev,
      sampleSize: this.rollingWindow.length,
      lastUpdated: Date.now(),
    };
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    // Initialize rolling window with training data
    this.rollingWindow = data.slice(-this.config.windowSize).map((d) => d.value);

    // Calculate initial baseline
    this.updateBaseline();

    this.logger.log(
      `Z-Score detector trained with baseline: mean=${this.baseline.mean.toFixed(2)}, stdDev=${this.baseline.stdDev.toFixed(2)}`,
    );
  }

  reset(): void {
    super.reset();
    this.baseline = null;
    this.rollingWindow = [];
  }

  // Additional methods for advanced Z-Score analysis

  getBaseline(): IBaseline | null {
    return this.baseline ? { ...this.baseline } : null;
  }

  setBaseline(baseline: IBaseline): void {
    this.baseline = baseline;
    this.ready = true;
  }

  // Adaptive threshold based on recent data volatility
  private getAdaptiveThreshold(): number {
    if (this.rollingWindow.length < this.config.minDataPoints) {
      return this.config.threshold;
    }

    const recentVolatility = this.calculateVolatility(this.rollingWindow.slice(-20));
    const baseVolatility = this.baseline?.stdDev || 1;

    // Adjust threshold based on current volatility vs baseline
    const volatilityRatio = recentVolatility / baseVolatility;

    // Increase threshold during high volatility periods
    if (volatilityRatio > 1.5) {
      return this.config.threshold * 1.2;
    } else if (volatilityRatio < 0.5) {
      return this.config.threshold * 0.8;
    }

    return this.config.threshold;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns = values
      .slice(1)
      .map((val, i) => Math.log(val / values[i]) || 0)
      .filter((ret) => isFinite(ret));

    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  // Seasonal adjustment for Z-Score calculation
  private getSeasonallyAdjustedValue(
    value: number,
    timestamp: number,
    seasonalPattern?: number[],
  ): number {
    if (!seasonalPattern || seasonalPattern.length === 0) {
      return value;
    }

    // Simple seasonal adjustment based on hour of day
    const hour = new Date(timestamp).getHours();
    const seasonalIndex = hour % seasonalPattern.length;
    const seasonalFactor = seasonalPattern[seasonalIndex];

    return value / (seasonalFactor || 1);
  }
}

interface IBaseline {
  mean: number;
  stdDev: number;
  sampleSize: number;
  lastUpdated: number;
}
