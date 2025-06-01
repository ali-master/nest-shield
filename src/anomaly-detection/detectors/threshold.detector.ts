import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import { IAnomalyData, IAnomaly, AnomalyType } from "../interfaces/anomaly.interface";
import { IDetectorContext } from "../interfaces/detector.interface";

@Injectable()
export class ThresholdAnomalyDetector extends BaseAnomalyDetector {
  readonly name = "Threshold Anomaly Detector";
  readonly version = "1.0.0";
  readonly description = "Simple boundary-based anomaly detection with adaptive thresholds";

  private thresholds: Map<string, IThresholdSet> = new Map();
  private adaptiveThresholds: Map<string, IAdaptiveThreshold> = new Map();
  private recentValues: Map<string, IRollingBuffer> = new Map();

  async detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isReady() || data.length === 0) {
      return [];
    }

    const anomalies: IAnomaly[] = [];

    for (const dataPoint of data) {
      if (this.isMaintenanceWindow(dataPoint.timestamp, context)) {
        continue;
      }

      // Update rolling statistics
      this.updateRollingStatistics(dataPoint);

      const anomaly = await this.detectSinglePoint(dataPoint, context);
      if (anomaly) {
        const processedAnomaly = this.applyBusinessRules(anomaly);
        if (processedAnomaly) {
          anomalies.push(processedAnomaly);
        }
      }
    }

    return anomalies;
  }

  private async detectSinglePoint(
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): Promise<IAnomaly | null> {
    const source = dataPoint.source || "default";
    let thresholdSet = this.thresholds.get(source);

    if (!thresholdSet) {
      // Create default thresholds if none exist
      thresholdSet = this.createDefaultThresholds(dataPoint);
      this.thresholds.set(source, thresholdSet);
    }

    // Get current effective thresholds (static or adaptive)
    const effectiveThresholds = this.getEffectiveThresholds(source, dataPoint, context);

    // Check against thresholds
    const violations = this.checkThresholdViolations(dataPoint, effectiveThresholds);

    if (violations.length === 0) {
      return null;
    }

    // Determine most severe violation
    const primaryViolation = violations.reduce((max, current) =>
      current.severity > max.severity ? current : max,
    );

    // Calculate overall score and confidence
    const score = this.calculateViolationScore(primaryViolation, violations);
    const confidence = this.calculateThresholdConfidence(dataPoint, effectiveThresholds, context);

    const description =
      `Threshold violation: ${primaryViolation.type} threshold exceeded ` +
      `(value=${dataPoint.value.toFixed(2)}, threshold=${primaryViolation.threshold.toFixed(2)}, ` +
      `severity=${primaryViolation.severity.toFixed(2)})`;

    return this.createAnomaly(
      dataPoint,
      this.mapViolationTypeToAnomalyType(primaryViolation.type),
      score,
      confidence,
      description,
      this.getExpectedValue(effectiveThresholds),
    );
  }

  private createDefaultThresholds(dataPoint: IAnomalyData): IThresholdSet {
    // Create reasonable default thresholds based on the data point
    const baseValue = dataPoint.value;

    return {
      upper: baseValue * 2,
      lower: Math.max(0, baseValue * 0.5),
      upperWarning: baseValue * 1.5,
      lowerWarning: Math.max(0, baseValue * 0.75),
      rate: {
        maxIncrease: baseValue * 0.5, // 50% increase per period
        maxDecrease: baseValue * 0.3, // 30% decrease per period
      },
      dynamic: true,
      lastUpdated: Date.now(),
    };
  }

  private getEffectiveThresholds(
    source: string,
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): IEffectiveThresholds {
    const staticThresholds = this.thresholds.get(source);
    const adaptiveThresholds = this.adaptiveThresholds.get(source);

    if (!staticThresholds) {
      throw new Error(`No thresholds configured for source: ${source}`);
    }

    // Use adaptive thresholds if available and enabled
    if (adaptiveThresholds && staticThresholds.dynamic) {
      return this.calculateAdaptiveThresholds(source, dataPoint, context);
    }

    return {
      upper: staticThresholds.upper,
      lower: staticThresholds.lower,
      upperWarning: staticThresholds.upperWarning,
      lowerWarning: staticThresholds.lowerWarning,
      rateUpperLimit: staticThresholds.rate.maxIncrease,
      rateLowerLimit: staticThresholds.rate.maxDecrease,
      type: "static",
    };
  }

  private calculateAdaptiveThresholds(
    source: string,
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): IEffectiveThresholds {
    const rollingBuffer = this.recentValues.get(source);
    const staticThresholds = this.thresholds.get(source)!;

    if (!rollingBuffer || rollingBuffer.values.length < this.config.minDataPoints) {
      // Fall back to static thresholds
      return this.getEffectiveThresholds(source, dataPoint, context);
    }

    const stats = this.calculateRollingStatistics(rollingBuffer.values);
    const volatility = this.calculateVolatility(rollingBuffer.values);

    // Adaptive threshold calculation based on recent statistics
    const adaptiveFactor = this.getAdaptiveFactor(volatility, context);
    const stdDevMultiplier = this.config.threshold * adaptiveFactor;

    return {
      upper: stats.mean + stdDevMultiplier * stats.stdDev,
      lower: Math.max(0, stats.mean - stdDevMultiplier * stats.stdDev),
      upperWarning: stats.mean + stdDevMultiplier * 0.7 * stats.stdDev,
      lowerWarning: Math.max(0, stats.mean - stdDevMultiplier * 0.7 * stats.stdDev),
      rateUpperLimit: staticThresholds.rate.maxIncrease * adaptiveFactor,
      rateLowerLimit: staticThresholds.rate.maxDecrease * adaptiveFactor,
      type: "adaptive",
      baseline: stats.mean,
      volatility,
    };
  }

  private getAdaptiveFactor(volatility: number, context?: IDetectorContext): number {
    let factor = 1.0;

    // Increase thresholds during high volatility periods
    if (volatility > 0.2) {
      factor *= 1.3;
    } else if (volatility < 0.05) {
      factor *= 0.8;
    }

    // Adjust for deployment windows
    if (context && this.hasRecentDeployment(Date.now(), context)) {
      factor *= 1.5; // More lenient during deployments
    }

    // Adjust for maintenance windows
    if (context?.maintenanceWindows) {
      const inMaintenanceWindow = context.maintenanceWindows.some(
        (window) => Date.now() >= window.start && Date.now() <= window.end,
      );
      if (inMaintenanceWindow) {
        factor *= 2.0; // Much more lenient during maintenance
      }
    }

    return Math.max(0.5, Math.min(3.0, factor)); // Clamp between 0.5x and 3x
  }

  private checkThresholdViolations(
    dataPoint: IAnomalyData,
    thresholds: IEffectiveThresholds,
  ): IThresholdViolation[] {
    const violations: IThresholdViolation[] = [];
    const value = dataPoint.value;

    // Check absolute value thresholds
    if (value > thresholds.upper) {
      violations.push({
        type: "upper_critical",
        threshold: thresholds.upper,
        actualValue: value,
        deviation: value - thresholds.upper,
        severity: this.calculateSeverity(value, thresholds.upper, "upper"),
      });
    } else if (value > thresholds.upperWarning) {
      violations.push({
        type: "upper_warning",
        threshold: thresholds.upperWarning,
        actualValue: value,
        deviation: value - thresholds.upperWarning,
        severity: this.calculateSeverity(value, thresholds.upperWarning, "warning"),
      });
    }

    if (value < thresholds.lower) {
      violations.push({
        type: "lower_critical",
        threshold: thresholds.lower,
        actualValue: value,
        deviation: thresholds.lower - value,
        severity: this.calculateSeverity(value, thresholds.lower, "lower"),
      });
    } else if (value < thresholds.lowerWarning) {
      violations.push({
        type: "lower_warning",
        threshold: thresholds.lowerWarning,
        actualValue: value,
        deviation: thresholds.lowerWarning - value,
        severity: this.calculateSeverity(value, thresholds.lowerWarning, "warning"),
      });
    }

    // Check rate of change thresholds
    const rateViolations = this.checkRateViolations(dataPoint, thresholds);
    violations.push(...rateViolations);

    return violations;
  }

  private checkRateViolations(
    dataPoint: IAnomalyData,
    thresholds: IEffectiveThresholds,
  ): IThresholdViolation[] {
    const source = dataPoint.source || "default";
    const rollingBuffer = this.recentValues.get(source);

    if (!rollingBuffer || rollingBuffer.values.length < 2) {
      return [];
    }

    const previousValue = rollingBuffer.values[rollingBuffer.values.length - 1];
    const rateOfChange = dataPoint.value - previousValue;
    const violations: IThresholdViolation[] = [];

    if (rateOfChange > thresholds.rateUpperLimit) {
      violations.push({
        type: "rate_increase",
        threshold: thresholds.rateUpperLimit,
        actualValue: rateOfChange,
        deviation: rateOfChange - thresholds.rateUpperLimit,
        severity: Math.min(
          1.0,
          (rateOfChange - thresholds.rateUpperLimit) / thresholds.rateUpperLimit,
        ),
      });
    }

    if (Math.abs(rateOfChange) > thresholds.rateLowerLimit && rateOfChange < 0) {
      violations.push({
        type: "rate_decrease",
        threshold: thresholds.rateLowerLimit,
        actualValue: Math.abs(rateOfChange),
        deviation: Math.abs(rateOfChange) - thresholds.rateLowerLimit,
        severity: Math.min(
          1.0,
          (Math.abs(rateOfChange) - thresholds.rateLowerLimit) / thresholds.rateLowerLimit,
        ),
      });
    }

    return violations;
  }

  private calculateSeverity(value: number, threshold: number, type: string): number {
    const deviation = Math.abs(value - threshold);
    const relativeDeviation = deviation / Math.abs(threshold);

    // Scale severity based on how far beyond threshold
    let severity = Math.min(1.0, relativeDeviation);

    // Boost severity for critical thresholds
    if (type === "upper" || type === "lower") {
      severity = Math.min(1.0, severity * 1.5);
    }

    return severity;
  }

  private calculateViolationScore(
    primaryViolation: IThresholdViolation,
    allViolations: IThresholdViolation[],
  ): number {
    // Base score from primary violation
    let score = primaryViolation.severity;

    // Increase score if multiple thresholds are violated
    if (allViolations.length > 1) {
      const additionalSeverity = allViolations
        .filter((v) => v !== primaryViolation)
        .reduce((sum, v) => sum + v.severity, 0);
      score += additionalSeverity * 0.3; // Weight additional violations lower
    }

    return Math.min(1.0, score);
  }

  private calculateThresholdConfidence(
    dataPoint: IAnomalyData,
    thresholds: IEffectiveThresholds,
    context?: IDetectorContext,
  ): number {
    let confidence = 0.8; // Base confidence for threshold detection

    // Static thresholds have higher confidence
    if (thresholds.type === "static") {
      confidence += 0.1;
    } else {
      // Adaptive thresholds - confidence depends on data quality
      const source = dataPoint.source || "default";
      const rollingBuffer = this.recentValues.get(source);

      if (rollingBuffer && rollingBuffer.values.length >= this.config.windowSize) {
        confidence += 0.1; // Full buffer increases confidence
      }

      // Lower confidence during high volatility
      if (thresholds.volatility && thresholds.volatility > 0.3) {
        confidence -= 0.2;
      }
    }

    // Deployment context affects confidence
    if (context && this.hasRecentDeployment(dataPoint.timestamp, context)) {
      confidence -= 0.15;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private mapViolationTypeToAnomalyType(violationType: string): AnomalyType {
    switch (violationType) {
      case "upper_critical":
      case "upper_warning":
        return AnomalyType.SPIKE;
      case "lower_critical":
      case "lower_warning":
        return AnomalyType.DROP;
      case "rate_increase":
        return AnomalyType.SPIKE;
      case "rate_decrease":
        return AnomalyType.DROP;
      default:
        return AnomalyType.OUTLIER;
    }
  }

  private getExpectedValue(thresholds: IEffectiveThresholds): number {
    if (thresholds.baseline !== undefined) {
      return thresholds.baseline;
    }

    // Return midpoint of warning thresholds as expected value
    return (thresholds.upperWarning + thresholds.lowerWarning) / 2;
  }

  private updateRollingStatistics(dataPoint: IAnomalyData): void {
    const source = dataPoint.source || "default";
    let rollingBuffer = this.recentValues.get(source);

    if (!rollingBuffer) {
      rollingBuffer = {
        values: [],
        maxSize: this.config.windowSize,
        lastUpdated: Date.now(),
      };
      this.recentValues.set(source, rollingBuffer);
    }

    // Add new value
    rollingBuffer.values.push(dataPoint.value);
    rollingBuffer.lastUpdated = Date.now();

    // Maintain buffer size
    if (rollingBuffer.values.length > rollingBuffer.maxSize) {
      rollingBuffer.values.shift();
    }

    // Update adaptive thresholds if needed
    this.updateAdaptiveThresholds(source, rollingBuffer);
  }

  private updateAdaptiveThresholds(source: string, rollingBuffer: IRollingBuffer): void {
    if (rollingBuffer.values.length < this.config.minDataPoints) {
      return;
    }

    const stats = this.calculateRollingStatistics(rollingBuffer.values);
    const volatility = this.calculateVolatility(rollingBuffer.values);

    this.adaptiveThresholds.set(source, {
      mean: stats.mean,
      stdDev: stats.stdDev,
      volatility,
      confidence: Math.min(rollingBuffer.values.length / this.config.windowSize, 1),
      lastUpdated: Date.now(),
    });
  }

  private calculateRollingStatistics(values: number[]): { mean: number; stdDev: number } {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return {
      mean,
      stdDev: Math.sqrt(variance),
    };
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const changes = values.slice(1).map((val, i) => Math.abs(val - values[i]) / values[i]);
    return changes.reduce((sum, change) => sum + change, 0) / changes.length;
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    this.logger.log(`Training threshold detector with ${data.length} data points`);

    // Group data by source
    const groupedData = this.groupBySource(data);

    for (const [source, sourceData] of groupedData) {
      this.trainSourceThresholds(source, sourceData);
    }

    this.logger.log(`Thresholds configured for ${this.thresholds.size} sources`);
  }

  private groupBySource(data: IAnomalyData[]): Map<string, IAnomalyData[]> {
    const grouped = new Map<string, IAnomalyData[]>();

    for (const dataPoint of data) {
      const source = dataPoint.source || "default";
      if (!grouped.has(source)) {
        grouped.set(source, []);
      }
      grouped.get(source)!.push(dataPoint);
    }

    return grouped;
  }

  private trainSourceThresholds(source: string, data: IAnomalyData[]): void {
    const values = data.map((d) => d.value);
    const stats = this.calculateStatistics(values);

    // Calculate thresholds based on statistical analysis
    const stdDevMultiplier = this.config.threshold || 2.0;

    const thresholdSet: IThresholdSet = {
      upper: stats.mean + stdDevMultiplier * stats.stdDev,
      lower: Math.max(0, stats.mean - stdDevMultiplier * stats.stdDev),
      upperWarning: stats.mean + stdDevMultiplier * 0.7 * stats.stdDev,
      lowerWarning: Math.max(0, stats.mean - stdDevMultiplier * 0.7 * stats.stdDev),
      rate: this.calculateRateThresholds(data),
      dynamic: this.config.adaptiveThresholds !== false,
      lastUpdated: Date.now(),
    };

    this.thresholds.set(source, thresholdSet);

    // Initialize rolling buffer with recent data
    const recentData = data.slice(-this.config.windowSize);
    this.recentValues.set(source, {
      values: recentData.map((d) => d.value),
      maxSize: this.config.windowSize,
      lastUpdated: Date.now(),
    });
  }

  private calculateRateThresholds(data: IAnomalyData[]): IRateThresholds {
    if (data.length < 2) {
      return { maxIncrease: 100, maxDecrease: 50 }; // Default values
    }

    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const changes = sortedData.slice(1).map((point, i) => point.value - sortedData[i].value);

    const positiveChanges = changes.filter((c) => c > 0);
    const negativeChanges = changes.filter((c) => c < 0).map((c) => Math.abs(c));

    const maxIncreaseStats = this.calculateStatistics(positiveChanges);
    const maxDecreaseStats = this.calculateStatistics(negativeChanges);

    return {
      maxIncrease: maxIncreaseStats.mean + 2 * maxIncreaseStats.stdDev,
      maxDecrease: maxDecreaseStats.mean + 2 * maxDecreaseStats.stdDev,
    };
  }

  reset(): void {
    super.reset();
    this.thresholds.clear();
    this.adaptiveThresholds.clear();
    this.recentValues.clear();
  }

  // Threshold management methods

  setThreshold(source: string, thresholds: Partial<IThresholdSet>): void {
    const existing =
      this.thresholds.get(source) ||
      this.createDefaultThresholds({
        value: 0,
        timestamp: Date.now(),
        source,
      } as IAnomalyData);

    this.thresholds.set(source, {
      ...existing,
      ...thresholds,
      lastUpdated: Date.now(),
    });
  }

  getThresholds(source?: string): Map<string, IThresholdSet> | IThresholdSet | undefined {
    if (source) {
      return this.thresholds.get(source);
    }
    return new Map(this.thresholds);
  }

  getAdaptiveThresholds(): Map<string, IAdaptiveThreshold> {
    return new Map(this.adaptiveThresholds);
  }

  enableAdaptiveThresholds(source: string): void {
    const thresholds = this.thresholds.get(source);
    if (thresholds) {
      thresholds.dynamic = true;
      thresholds.lastUpdated = Date.now();
    }
  }

  disableAdaptiveThresholds(source: string): void {
    const thresholds = this.thresholds.get(source);
    if (thresholds) {
      thresholds.dynamic = false;
      thresholds.lastUpdated = Date.now();
    }
  }
}

// Interfaces for threshold detection

interface IThresholdSet {
  upper: number;
  lower: number;
  upperWarning: number;
  lowerWarning: number;
  rate: IRateThresholds;
  dynamic: boolean;
  lastUpdated: number;
}

interface IRateThresholds {
  maxIncrease: number;
  maxDecrease: number;
}

interface IEffectiveThresholds {
  upper: number;
  lower: number;
  upperWarning: number;
  lowerWarning: number;
  rateUpperLimit: number;
  rateLowerLimit: number;
  type: "static" | "adaptive";
  baseline?: number;
  volatility?: number;
}

interface IThresholdViolation {
  type: string;
  threshold: number;
  actualValue: number;
  deviation: number;
  severity: number;
}

interface IAdaptiveThreshold {
  mean: number;
  stdDev: number;
  volatility: number;
  confidence: number;
  lastUpdated: number;
}

interface IRollingBuffer {
  values: number[];
  maxSize: number;
  lastUpdated: number;
}
