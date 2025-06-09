import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import type { IAnomalyData, IAnomaly } from "../interfaces/anomaly.interface";
import { AnomalyType } from "../interfaces/anomaly.interface";
import type { IDetectorContext } from "../interfaces/detector.interface";

@Injectable()
export class SeasonalAnomalyDetector extends BaseAnomalyDetector {
  readonly name = "Seasonal Anomaly Detector";
  readonly version = "1.0.0";
  readonly description = "Time-based pattern anomaly detection with seasonal decomposition";

  private seasonalPatterns: Map<string, ISeasonalPattern> = new Map();
  private timeSeriesDecomposer: TimeSeriesDecomposer;
  private seasonalityDetector: SeasonalityDetector;

  constructor() {
    super();
    this.timeSeriesDecomposer = new TimeSeriesDecomposer();
    this.seasonalityDetector = new SeasonalityDetector();
  }

  async detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isReady() || data.length === 0) {
      return [];
    }

    const anomalies: IAnomaly[] = [];

    for (const dataPoint of data) {
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
    }

    return anomalies;
  }

  private async detectSinglePoint(
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): Promise<IAnomaly | null> {
    const timeFeatures = this.extractTimeFeatures(dataPoint.timestamp);
    const expectedValue = this.getExpectedValue(dataPoint.timestamp, dataPoint.source);

    if (expectedValue === null) {
      return null;
    }

    // Calculate seasonal deviation
    const deviation = Math.abs(dataPoint.value - expectedValue);
    const normalizedDeviation = this.normalizeDeviation(
      deviation,
      dataPoint.timestamp,
      dataPoint.source,
    );

    if (normalizedDeviation < this.config.threshold) {
      return null;
    }

    // Determine anomaly type based on seasonal context
    const anomalyType = this.determineSeasonalAnomalyType(dataPoint, expectedValue, timeFeatures);

    // Calculate confidence based on seasonal strength and historical patterns
    const confidence = this.calculateSeasonalConfidence(
      dataPoint,
      expectedValue,
      timeFeatures,
      context,
    );

    // Score based on normalized deviation
    const score = Math.min(normalizedDeviation / (this.config.threshold * 2), 1);

    const seasonalInfo = this.getSeasonalInfo(dataPoint.timestamp, dataPoint.source);
    const description =
      `Seasonal anomaly detected: value=${dataPoint.value.toFixed(2)}, ` +
      `expected=${expectedValue.toFixed(2)}, ` +
      `pattern=${seasonalInfo?.pattern || "unknown"}, ` +
      `deviation=${deviation.toFixed(2)}`;

    return this.createAnomaly(
      dataPoint,
      anomalyType,
      score,
      confidence,
      description,
      expectedValue,
    );
  }

  private extractTimeFeatures(timestamp: number): ITimeFeatures {
    const date = new Date(timestamp);
    return {
      hour: date.getHours(),
      dayOfWeek: date.getDay(),
      dayOfMonth: date.getDate(),
      month: date.getMonth(),
      quarterHour: Math.floor(date.getMinutes() / 15),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isBusinessHour: date.getHours() >= 9 && date.getHours() <= 17,
      weekOfYear: this.getWeekOfYear(date),
    };
  }

  private getWeekOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }

  private getExpectedValue(timestamp: number, source?: string): number | null {
    const pattern = this.seasonalPatterns.get(source || "default");
    if (!pattern) {
      return null;
    }

    const timeFeatures = this.extractTimeFeatures(timestamp);

    // Combine multiple seasonal components
    let expectedValue = pattern.baseline;

    // Hourly pattern
    if (pattern.hourlyPattern) {
      expectedValue += pattern.hourlyPattern[timeFeatures.hour] || 0;
    }

    // Daily pattern
    if (pattern.dailyPattern) {
      expectedValue += pattern.dailyPattern[timeFeatures.dayOfWeek] || 0;
    }

    // Weekly pattern
    if (pattern.weeklyPattern) {
      expectedValue +=
        pattern.weeklyPattern[timeFeatures.weekOfYear % pattern.weeklyPattern.length] || 0;
    }

    // Monthly pattern
    if (pattern.monthlyPattern) {
      expectedValue += pattern.monthlyPattern[timeFeatures.month] || 0;
    }

    // Apply trend component
    if (pattern.trend) {
      const timeSinceBaseline = timestamp - pattern.baselineTimestamp;
      expectedValue += pattern.trend * (timeSinceBaseline / (24 * 60 * 60 * 1000)); // per day
    }

    return expectedValue;
  }

  private normalizeDeviation(deviation: number, timestamp: number, source?: string): number {
    const pattern = this.seasonalPatterns.get(source || "default");
    if (!pattern) {
      return deviation;
    }

    // Normalize by expected volatility at this time
    const volatility = this.getExpectedVolatility(timestamp, pattern);
    return deviation / (volatility || 1);
  }

  private getExpectedVolatility(timestamp: number, pattern: ISeasonalPattern): number {
    const timeFeatures = this.extractTimeFeatures(timestamp);

    // Base volatility
    let volatility = pattern.baselineVolatility || 1;

    // Time-based volatility adjustments
    if (pattern.volatilityByHour) {
      volatility *= pattern.volatilityByHour[timeFeatures.hour] || 1;
    }

    if (pattern.volatilityByDayOfWeek) {
      volatility *= pattern.volatilityByDayOfWeek[timeFeatures.dayOfWeek] || 1;
    }

    return volatility;
  }

  private determineSeasonalAnomalyType(
    dataPoint: IAnomalyData,
    expectedValue: number,
    timeFeatures: ITimeFeatures,
  ): AnomalyType {
    const isAboveExpected = dataPoint.value > expectedValue;
    const deviationMagnitude = Math.abs(dataPoint.value - expectedValue) / expectedValue;

    // Consider time context for anomaly type
    if (timeFeatures.isBusinessHour) {
      if (deviationMagnitude > 0.5) {
        return isAboveExpected ? AnomalyType.SPIKE : AnomalyType.DROP;
      }
      return AnomalyType.OUTLIER;
    } else {
      // Outside business hours, different thresholds
      if (deviationMagnitude > 0.3) {
        return isAboveExpected ? AnomalyType.SPIKE : AnomalyType.DROP;
      }
      return AnomalyType.OUTLIER;
    }
  }

  private calculateSeasonalConfidence(
    dataPoint: IAnomalyData,
    expectedValue: number,
    timeFeatures: ITimeFeatures,
    context?: IDetectorContext,
  ): number {
    let confidence = 0.7; // Base confidence

    const pattern = this.seasonalPatterns.get(dataPoint.source || "default");
    if (!pattern) {
      return 0.3; // Low confidence without pattern
    }

    // Pattern strength increases confidence
    confidence += pattern.strength * 0.2;

    // Consistency with multiple seasonal components increases confidence
    const componentMatches = this.countConsistentComponents(dataPoint, expectedValue, timeFeatures);
    confidence += (componentMatches / 4) * 0.1; // Max 4 components (hourly, daily, weekly, monthly)

    // Recent deployments decrease confidence
    if (context && this.hasRecentDeployment(dataPoint.timestamp, context)) {
      confidence -= 0.15;
    }

    // Historical accuracy of pattern increases confidence
    if (pattern.accuracy) {
      confidence *= pattern.accuracy;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private countConsistentComponents(
    dataPoint: IAnomalyData,
    expectedValue: number,
    timeFeatures: ITimeFeatures,
  ): number {
    // Count how many seasonal components agree on the anomaly
    let consistentComponents = 0;

    const pattern = this.seasonalPatterns.get(dataPoint.source || "default");
    if (!pattern) return 0;

    const _isAnomalous = Math.abs(dataPoint.value - expectedValue) > this.config.threshold;

    // Check each component for consistency
    if (pattern.hourlyPattern && this.isHourlyAnomalous(dataPoint, timeFeatures, pattern)) {
      consistentComponents++;
    }

    if (pattern.dailyPattern && this.isDailyAnomalous(dataPoint, timeFeatures, pattern)) {
      consistentComponents++;
    }

    if (pattern.weeklyPattern && this.isWeeklyAnomalous(dataPoint, timeFeatures, pattern)) {
      consistentComponents++;
    }

    if (pattern.monthlyPattern && this.isMonthlyAnomalous(dataPoint, timeFeatures, pattern)) {
      consistentComponents++;
    }

    return consistentComponents;
  }

  private isHourlyAnomalous(
    dataPoint: IAnomalyData,
    timeFeatures: ITimeFeatures,
    pattern: ISeasonalPattern,
  ): boolean {
    if (!pattern.hourlyPattern) return false;
    const hourlyExpected = pattern.baseline + (pattern.hourlyPattern[timeFeatures.hour] || 0);
    return Math.abs(dataPoint.value - hourlyExpected) > this.config.threshold;
  }

  private isDailyAnomalous(
    dataPoint: IAnomalyData,
    timeFeatures: ITimeFeatures,
    pattern: ISeasonalPattern,
  ): boolean {
    if (!pattern.dailyPattern) return false;
    const dailyExpected = pattern.baseline + (pattern.dailyPattern[timeFeatures.dayOfWeek] || 0);
    return Math.abs(dataPoint.value - dailyExpected) > this.config.threshold;
  }

  private isWeeklyAnomalous(
    dataPoint: IAnomalyData,
    timeFeatures: ITimeFeatures,
    pattern: ISeasonalPattern,
  ): boolean {
    if (!pattern.weeklyPattern) return false;
    const weeklyIndex = timeFeatures.weekOfYear % pattern.weeklyPattern.length;
    const weeklyExpected = pattern.baseline + (pattern.weeklyPattern[weeklyIndex] || 0);
    return Math.abs(dataPoint.value - weeklyExpected) > this.config.threshold;
  }

  private isMonthlyAnomalous(
    dataPoint: IAnomalyData,
    timeFeatures: ITimeFeatures,
    pattern: ISeasonalPattern,
  ): boolean {
    if (!pattern.monthlyPattern) return false;
    const monthlyExpected = pattern.baseline + (pattern.monthlyPattern[timeFeatures.month] || 0);
    return Math.abs(dataPoint.value - monthlyExpected) > this.config.threshold;
  }

  private getSeasonalInfo(timestamp: number, source?: string): ISeasonalInfo | null {
    const pattern = this.seasonalPatterns.get(source || "default");
    if (!pattern) return null;

    const timeFeatures = this.extractTimeFeatures(timestamp);
    return {
      pattern: pattern.dominantPeriod,
      strength: pattern.strength,
      phase: this.calculatePhase(timeFeatures, pattern),
      confidence: pattern.accuracy || 0.5,
    };
  }

  private calculatePhase(timeFeatures: ITimeFeatures, pattern: ISeasonalPattern): string {
    // Determine current phase in dominant seasonal cycle
    if (pattern.dominantPeriod === "daily") {
      if (timeFeatures.hour < 6) return "night";
      if (timeFeatures.hour < 12) return "morning";
      if (timeFeatures.hour < 18) return "afternoon";
      return "evening";
    } else if (pattern.dominantPeriod === "weekly") {
      return timeFeatures.isWeekend ? "weekend" : "weekday";
    } else if (pattern.dominantPeriod === "monthly") {
      if (timeFeatures.dayOfMonth <= 10) return "early";
      if (timeFeatures.dayOfMonth <= 20) return "mid";
      return "late";
    }
    return "unknown";
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    this.logger.log(`Training seasonal detector with ${data.length} data points`);

    // Group data by source
    const groupedData = this.groupBySource(data);

    for (const [source, sourceData] of groupedData) {
      await this.trainSourcePattern(source, sourceData);
    }

    this.logger.log(`Seasonal patterns created for ${this.seasonalPatterns.size} sources`);
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

  private async trainSourcePattern(source: string, data: IAnomalyData[]): Promise<void> {
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    // Detect seasonality
    const seasonality = this.seasonalityDetector.detect(sortedData);

    // Decompose time series
    const decomposition = this.timeSeriesDecomposer.decompose(sortedData, seasonality);

    // Create seasonal pattern
    const pattern: ISeasonalPattern = {
      baseline: decomposition.trend,
      dominantPeriod: seasonality.dominantPeriod,
      strength: seasonality.strength,
      baselineTimestamp: sortedData[0].timestamp,
      baselineVolatility: decomposition.noiseLevel,
      trend: decomposition.trendSlope,
      accuracy: 0.8, // Initial accuracy, should be updated based on validation
      hourlyPattern: decomposition.hourlyPattern,
      dailyPattern: decomposition.dailyPattern,
      weeklyPattern: decomposition.weeklyPattern,
      monthlyPattern: decomposition.monthlyPattern,
      volatilityByHour: decomposition.hourlyVolatility,
      volatilityByDayOfWeek: decomposition.dailyVolatility,
    };

    this.seasonalPatterns.set(source, pattern);
  }

  reset(): void {
    super.reset();
    this.seasonalPatterns.clear();
  }

  // Advanced seasonal analysis methods

  getSeasonalPatterns(): Map<string, ISeasonalPattern> {
    return new Map(this.seasonalPatterns);
  }

  updatePattern(source: string, newData: IAnomalyData[]): void {
    // Update existing pattern with new data
    const existingPattern = this.seasonalPatterns.get(source);
    if (existingPattern) {
      // Incremental pattern update
      this.updateExistingPattern(existingPattern, newData);
    } else {
      // Create new pattern
      this.trainSourcePattern(source, newData);
    }
  }

  private updateExistingPattern(pattern: ISeasonalPattern, newData: IAnomalyData[]): void {
    // Implement incremental pattern update
    // This is a simplified version - in production, use more sophisticated online learning
    const alpha = 0.1; // Learning rate

    for (const dataPoint of newData) {
      const timeFeatures = this.extractTimeFeatures(dataPoint.timestamp);
      const currentExpected = this.getExpectedValue(dataPoint.timestamp, "updating");

      if (currentExpected !== null) {
        const error = dataPoint.value - currentExpected;

        // Update hourly pattern
        if (pattern.hourlyPattern) {
          pattern.hourlyPattern[timeFeatures.hour] =
            (pattern.hourlyPattern[timeFeatures.hour] || 0) + alpha * error;
        }

        // Update daily pattern
        if (pattern.dailyPattern) {
          pattern.dailyPattern[timeFeatures.dayOfWeek] =
            (pattern.dailyPattern[timeFeatures.dayOfWeek] || 0) + alpha * error;
        }
      }
    }
  }

  predictNextValues(source: string, horizon: number): ISeasonalForecast | null {
    const pattern = this.seasonalPatterns.get(source);
    if (!pattern) return null;

    const predictions: { timestamp: number; value: number; confidence: number }[] = [];
    const currentTime = Date.now();

    for (let i = 1; i <= horizon; i++) {
      const futureTimestamp = currentTime + i * 60 * 60 * 1000; // 1 hour intervals
      const expectedValue = this.getExpectedValue(futureTimestamp, source);

      if (expectedValue !== null) {
        predictions.push({
          timestamp: futureTimestamp,
          value: expectedValue,
          confidence: pattern.accuracy || 0.5,
        });
      }
    }

    return {
      predictions,
      pattern: pattern.dominantPeriod,
      horizon,
      generatedAt: Date.now(),
    };
  }
}

class TimeSeriesDecomposer {
  decompose(data: IAnomalyData[], _seasonality: ISeasonalityInfo): IDecomposition {
    const values = data.map((d) => d.value);
    const _timestamps = data.map((d) => d.timestamp);

    // Simple trend extraction (linear regression)
    const trend = this.extractTrend(values);
    const trendSlope = this.calculateTrendSlope(values);

    // Extract seasonal patterns by time components
    const hourlyPattern = this.extractHourlyPattern(data);
    const dailyPattern = this.extractDailyPattern(data);
    const weeklyPattern = this.extractWeeklyPattern(data);
    const monthlyPattern = this.extractMonthlyPattern(data);

    // Calculate volatility patterns
    const hourlyVolatility = this.calculateHourlyVolatility(data);
    const dailyVolatility = this.calculateDailyVolatility(data);

    // Calculate residual noise level
    const noiseLevel = this.calculateNoiseLevel(data, trend, hourlyPattern);

    return {
      trend,
      trendSlope,
      hourlyPattern,
      dailyPattern,
      weeklyPattern,
      monthlyPattern,
      hourlyVolatility,
      dailyVolatility,
      noiseLevel,
    };
  }

  private extractTrend(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private extractHourlyPattern(data: IAnomalyData[]): number[] {
    const hourlyValues: number[][] = Array.from({ length: 24 }, () => []);

    data.forEach((d) => {
      const hour = new Date(d.timestamp).getHours();
      hourlyValues[hour].push(d.value);
    });

    return hourlyValues.map((values) =>
      values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    );
  }

  private extractDailyPattern(data: IAnomalyData[]): number[] {
    const dailyValues: number[][] = Array.from({ length: 7 }, () => []);

    data.forEach((d) => {
      const dayOfWeek = new Date(d.timestamp).getDay();
      dailyValues[dayOfWeek].push(d.value);
    });

    return dailyValues.map((values) =>
      values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    );
  }

  private extractWeeklyPattern(data: IAnomalyData[]): number[] {
    // Simplified weekly pattern (4 weeks)
    const weeklyValues: number[][] = Array.from({ length: 4 }, () => []);

    data.forEach((d) => {
      const weekOfMonth = Math.floor(new Date(d.timestamp).getDate() / 7);
      if (weekOfMonth < 4) {
        weeklyValues[weekOfMonth].push(d.value);
      }
    });

    return weeklyValues.map((values) =>
      values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    );
  }

  private extractMonthlyPattern(data: IAnomalyData[]): number[] {
    const monthlyValues: number[][] = Array.from({ length: 12 }, () => []);

    data.forEach((d) => {
      const month = new Date(d.timestamp).getMonth();
      monthlyValues[month].push(d.value);
    });

    return monthlyValues.map((values) =>
      values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    );
  }

  private calculateHourlyVolatility(data: IAnomalyData[]): number[] {
    const hourlyValues: number[][] = Array.from({ length: 24 }, () => []);

    data.forEach((d) => {
      const hour = new Date(d.timestamp).getHours();
      hourlyValues[hour].push(d.value);
    });

    return hourlyValues.map((values) => {
      if (values.length < 2) return 1;
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    });
  }

  private calculateDailyVolatility(data: IAnomalyData[]): number[] {
    const dailyValues: number[][] = Array.from({ length: 7 }, () => []);

    data.forEach((d) => {
      const dayOfWeek = new Date(d.timestamp).getDay();
      dailyValues[dayOfWeek].push(d.value);
    });

    return dailyValues.map((values) => {
      if (values.length < 2) return 1;
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
      return Math.sqrt(variance);
    });
  }

  private calculateNoiseLevel(
    data: IAnomalyData[],
    trend: number,
    hourlyPattern: number[],
  ): number {
    const residuals = data.map((d) => {
      const hour = new Date(d.timestamp).getHours();
      const expected = trend + (hourlyPattern[hour] || 0);
      return Math.abs(d.value - expected);
    });

    return residuals.reduce((sum, res) => sum + res, 0) / residuals.length;
  }
}

class SeasonalityDetector {
  detect(data: IAnomalyData[]): ISeasonalityInfo {
    // Simplified seasonality detection
    const hourlyStrength = this.calculateHourlySeasonality(data);
    const dailyStrength = this.calculateDailySeasonality(data);
    const weeklyStrength = this.calculateWeeklySeasonality(data);

    // Determine dominant period
    const strengths = [
      { period: "hourly", strength: hourlyStrength },
      { period: "daily", strength: dailyStrength },
      { period: "weekly", strength: weeklyStrength },
    ];

    const dominant = strengths.reduce((max, current) =>
      current.strength > max.strength ? current : max,
    );

    return {
      dominantPeriod: dominant.period as "hourly" | "daily" | "weekly" | "monthly",
      strength: dominant.strength,
      periods: {
        hourly: hourlyStrength,
        daily: dailyStrength,
        weekly: weeklyStrength,
      },
    };
  }

  private calculateHourlySeasonality(data: IAnomalyData[]): number {
    // Calculate variance explained by hourly pattern
    const hourlyMeans = this.calculateHourlyMeans(data);
    const overallMean = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    let totalVariance = 0;
    let explainedVariance = 0;

    data.forEach((d) => {
      const hour = new Date(d.timestamp).getHours();
      const hourlyMean = hourlyMeans[hour];

      totalVariance += (d.value - overallMean) ** 2;
      explainedVariance += (hourlyMean - overallMean) ** 2;
    });

    return totalVariance > 0 ? explainedVariance / totalVariance : 0;
  }

  private calculateDailySeasonality(data: IAnomalyData[]): number {
    // Similar calculation for daily patterns
    const dailyMeans = this.calculateDailyMeans(data);
    const overallMean = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    let totalVariance = 0;
    let explainedVariance = 0;

    data.forEach((d) => {
      const dayOfWeek = new Date(d.timestamp).getDay();
      const dailyMean = dailyMeans[dayOfWeek];

      totalVariance += (d.value - overallMean) ** 2;
      explainedVariance += (dailyMean - overallMean) ** 2;
    });

    return totalVariance > 0 ? explainedVariance / totalVariance : 0;
  }

  private calculateWeeklySeasonality(_data: IAnomalyData[]): number {
    // Simplified weekly seasonality calculation
    return 0.1; // Placeholder
  }

  private calculateHourlyMeans(data: IAnomalyData[]): number[] {
    const hourlyValues: number[][] = Array.from({ length: 24 }, () => []);

    data.forEach((d) => {
      const hour = new Date(d.timestamp).getHours();
      hourlyValues[hour].push(d.value);
    });

    return hourlyValues.map((values) =>
      values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    );
  }

  private calculateDailyMeans(data: IAnomalyData[]): number[] {
    const dailyValues: number[][] = Array.from({ length: 7 }, () => []);

    data.forEach((d) => {
      const dayOfWeek = new Date(d.timestamp).getDay();
      dailyValues[dayOfWeek].push(d.value);
    });

    return dailyValues.map((values) =>
      values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
    );
  }
}

// Interfaces for seasonal detection

interface ISeasonalPattern {
  baseline: number;
  dominantPeriod: string;
  strength: number;
  baselineTimestamp: number;
  baselineVolatility: number;
  trend: number;
  accuracy: number;
  hourlyPattern?: number[];
  dailyPattern?: number[];
  weeklyPattern?: number[];
  monthlyPattern?: number[];
  volatilityByHour?: number[];
  volatilityByDayOfWeek?: number[];
}

interface ITimeFeatures {
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  quarterHour: number;
  isWeekend: boolean;
  isBusinessHour: boolean;
  weekOfYear: number;
}

interface ISeasonalInfo {
  pattern: string;
  strength: number;
  phase: string;
  confidence: number;
}

interface ISeasonalityInfo {
  dominantPeriod: "hourly" | "daily" | "weekly" | "monthly";
  strength: number;
  periods: {
    hourly: number;
    daily: number;
    weekly: number;
  };
}

interface IDecomposition {
  trend: number;
  trendSlope: number;
  hourlyPattern: number[];
  dailyPattern: number[];
  weeklyPattern: number[];
  monthlyPattern: number[];
  hourlyVolatility: number[];
  dailyVolatility: number[];
  noiseLevel: number;
}

interface ISeasonalForecast {
  predictions: { timestamp: number; value: number; confidence: number }[];
  pattern: string;
  horizon: number;
  generatedAt: number;
}
