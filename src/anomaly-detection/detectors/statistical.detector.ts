import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import { IAnomalyData, IAnomaly, AnomalyType } from "../interfaces/anomaly.interface";
import { IDetectorContext } from "../interfaces/detector.interface";

@Injectable()
export class StatisticalAnomalyDetector extends BaseAnomalyDetector {
  readonly name = "Statistical Anomaly Detector";
  readonly version = "1.0.0";
  readonly description = "Multi-method statistical anomaly detection with ensemble scoring";

  private statisticalModels: Map<string, IStatisticalModel> = new Map();
  private detectionMethods: IDetectionMethod[];

  constructor() {
    super();
    this.detectionMethods = [
      new ZScoreMethod(),
      new ModifiedZScoreMethod(),
      new IQRMethod(),
      new GrubbsTestMethod(),
      new TukeyMethod(),
      new ESDTestMethod(),
    ];
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
    const source = dataPoint.source || "default";
    const model = this.statisticalModels.get(source);

    if (!model) {
      return null;
    }

    // Run all detection methods
    const methodResults = await Promise.all(
      this.detectionMethods.map((method) => method.detect(dataPoint, model, this.config)),
    );

    // Filter out non-anomalous results
    const anomalousResults = methodResults.filter((result) => result.isAnomaly);

    if (anomalousResults.length === 0) {
      return null;
    }

    // Ensemble scoring
    const ensembleScore = this.calculateEnsembleScore(anomalousResults);

    if (ensembleScore.score < this.config.threshold) {
      return null;
    }

    // Determine anomaly type based on method consensus
    const anomalyType = this.determineAnomalyType(dataPoint, anomalousResults);

    // Calculate confidence based on method agreement
    const confidence = this.calculateMethodConfidence(anomalousResults, context);

    const methodNames = anomalousResults.map((r) => r.method).join(", ");
    const description =
      `Statistical anomaly detected by methods: [${methodNames}] ` +
      `(ensemble_score=${ensembleScore.score.toFixed(3)}, ` +
      `agreement=${(confidence * 100).toFixed(1)}%)`;

    return this.createAnomaly(
      dataPoint,
      anomalyType,
      ensembleScore.score,
      confidence,
      description,
      model.statistics.mean,
    );
  }

  private calculateEnsembleScore(results: IDetectionResult[]): IEnsembleScore {
    if (results.length === 0) {
      return { score: 0, weights: new Map() };
    }

    // Weight methods based on their reliability and current performance
    const weightedScores: { score: number; weight: number; method: string }[] = results.map(
      (result) => ({
        score: result.score,
        weight: this.getMethodWeight(result.method),
        method: result.method,
      }),
    );

    // Calculate weighted average
    const totalWeight = weightedScores.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = weightedScores.reduce((sum, item) => sum + item.score * item.weight, 0);

    const ensembleScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Create weight map for transparency
    const weights = new Map<string, number>();
    weightedScores.forEach((item) => weights.set(item.method, item.weight));

    return {
      score: ensembleScore,
      weights,
    };
  }

  private getMethodWeight(methodName: string): number {
    // Method reliability weights based on performance characteristics
    const weights: Record<string, number> = {
      "z-score": 1.0, // Baseline method
      "modified-z-score": 1.2, // More robust to outliers
      iqr: 0.8, // Good for skewed distributions
      grubbs: 1.1, // Good for normal distributions
      tukey: 0.9, // Conservative method
      esd: 1.3, // Good for multiple outliers
    };

    return weights[methodName] || 1.0;
  }

  private determineAnomalyType(dataPoint: IAnomalyData, results: IDetectionResult[]): AnomalyType {
    // Analyze method-specific anomaly type suggestions
    const typeVotes = new Map<AnomalyType, number>();

    results.forEach((result) => {
      const weight = this.getMethodWeight(result.method);
      const currentVotes = typeVotes.get(result.anomalyType) || 0;
      typeVotes.set(result.anomalyType, currentVotes + weight);
    });

    // Return type with highest weighted votes
    let maxVotes = 0;
    let dominantType = AnomalyType.OUTLIER;

    typeVotes.forEach((votes, type) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        dominantType = type;
      }
    });

    return dominantType;
  }

  private calculateMethodConfidence(
    results: IDetectionResult[],
    context?: IDetectorContext,
  ): number {
    if (results.length === 0) return 0;

    const totalMethods = this.detectionMethods.length;
    const agreementRatio = results.length / totalMethods;

    // Base confidence from method agreement
    let confidence = 0.3 + agreementRatio * 0.5;

    // Score consistency increases confidence
    const scores = results.map((r) => r.score);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const scoreVariance =
      scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const scoreConsistency = Math.max(0, 1 - Math.sqrt(scoreVariance));

    confidence += scoreConsistency * 0.2;

    // High-confidence methods boost overall confidence
    const highConfidenceMethods = results.filter((r) => r.confidence > 0.8);
    if (highConfidenceMethods.length > 0) {
      confidence += (highConfidenceMethods.length / results.length) * 0.1;
    }

    // Context adjustments
    if (context && this.hasRecentDeployment(Date.now(), context)) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    this.logger.log(`Training statistical detector with ${data.length} data points`);

    // Group data by source
    const groupedData = this.groupBySource(data);

    for (const [source, sourceData] of groupedData) {
      await this.trainSourceModel(source, sourceData);
    }

    this.logger.log(`Statistical models created for ${this.statisticalModels.size} sources`);
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

  private async trainSourceModel(source: string, data: IAnomalyData[]): Promise<void> {
    const values = data.map((d) => d.value);
    const statistics = this.calculateAdvancedStatistics(values);

    // Assess data distribution characteristics
    const distribution = this.analyzeDistribution(values);

    // Create statistical model
    const model: IStatisticalModel = {
      source,
      statistics,
      distribution,
      sampleSize: values.length,
      trainedAt: Date.now(),
      historicalData: values.slice(-1000), // Keep last 1000 points for reference
    };

    this.statisticalModels.set(source, model);

    // Train individual detection methods
    await Promise.all(this.detectionMethods.map((method) => method.train(values, model)));
  }

  private calculateAdvancedStatistics(values: number[]): IAdvancedStatistics {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;

    // Basic statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Percentiles
    const q1 = sorted[Math.floor(n * 0.25)];
    const median = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    // Higher-order moments
    const skewness = this.calculateSkewness(values, mean, stdDev);
    const kurtosis = this.calculateKurtosis(values, mean, stdDev);

    // Robust statistics
    const mad = this.calculateMAD(values, median);
    const trimmedMean = this.calculateTrimmedMean(sorted, 0.1); // 10% trimmed

    return {
      mean,
      median,
      mode: this.calculateMode(values),
      stdDev,
      variance,
      q1,
      q3,
      iqr,
      min: sorted[0],
      max: sorted[n - 1],
      range: sorted[n - 1] - sorted[0],
      skewness,
      kurtosis,
      mad,
      trimmedMean,
      coefficientOfVariation: stdDev / mean,
    };
  }

  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0);
    return (
      ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum -
      (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3))
    );
  }

  private calculateMAD(values: number[], median: number): number {
    const deviations = values.map((val) => Math.abs(val - median));
    const sortedDeviations = deviations.sort((a, b) => a - b);
    return sortedDeviations[Math.floor(sortedDeviations.length / 2)];
  }

  private calculateTrimmedMean(sortedValues: number[], trimPercent: number): number {
    const trimCount = Math.floor(sortedValues.length * trimPercent);
    const trimmedValues = sortedValues.slice(trimCount, -trimCount);
    return trimmedValues.reduce((sum, val) => sum + val, 0) / trimmedValues.length;
  }

  private calculateMode(values: number[]): number {
    const frequency = new Map<number, number>();
    values.forEach((val) => {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    });

    let maxFreq = 0;
    let mode = values[0];
    frequency.forEach((freq, val) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = val;
      }
    });

    return mode;
  }

  private analyzeDistribution(values: number[]): IDistributionAnalysis {
    const stats = this.calculateAdvancedStatistics(values);

    // Test for normality using multiple criteria
    const normalityTests = {
      skewnessTest: Math.abs(stats.skewness) < 0.5,
      kurtosisTest: Math.abs(stats.kurtosis) < 1.0,
      shapiroWilk: this.shapiroWilkTest(values), // Simplified
    };

    const isNormal = Object.values(normalityTests).filter((test) => test).length >= 2;

    // Detect distribution characteristics
    const characteristics = {
      isSymmetric: Math.abs(stats.skewness) < 0.1,
      isRightSkewed: stats.skewness > 0.5,
      isLeftSkewed: stats.skewness < -0.5,
      isHeavyTailed: stats.kurtosis > 1.0,
      isLightTailed: stats.kurtosis < -1.0,
      hasOutliers: this.detectStatisticalOutliers(values, stats),
    };

    return {
      isNormal,
      normalityTests,
      characteristics,
      suggestedDistribution: this.suggestDistribution(stats, characteristics),
    };
  }

  private shapiroWilkTest(values: number[]): boolean {
    // Simplified Shapiro-Wilk test implementation
    // In production, use a proper statistical library
    if (values.length < 3 || values.length > 5000) return false;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((sum, val) => sum + val, 0) / n;

    // Calculate test statistic (simplified)
    const numerator = Math.pow(
      sorted.reduce((sum, val, i) => {
        const weight = this.shapiroWilkWeight(i + 1, n);
        return sum + weight * val;
      }, 0),
      2,
    );

    const denominator = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);

    const w = numerator / denominator;

    // Simplified p-value estimation
    return w > 0.9; // Rough threshold
  }

  private shapiroWilkWeight(i: number, n: number): number {
    // Simplified weight calculation
    if (i <= n / 2) {
      return Math.sqrt(n) * (1 - (2 * (i - 1)) / (n - 1));
    } else {
      return -this.shapiroWilkWeight(n - i + 1, n);
    }
  }

  private detectStatisticalOutliers(values: number[], stats: IAdvancedStatistics): boolean {
    // IQR method for outlier detection
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;

    const outliers = values.filter((val) => val < lowerBound || val > upperBound);
    return outliers.length > 0;
  }

  private suggestDistribution(
    stats: IAdvancedStatistics,
    characteristics: Record<string, boolean>,
  ): string {
    if (characteristics.isSymmetric && Math.abs(stats.kurtosis) < 0.5) {
      return "normal";
    } else if (characteristics.isRightSkewed) {
      return "log-normal";
    } else if (characteristics.isLeftSkewed) {
      return "weibull";
    } else if (characteristics.isHeavyTailed) {
      return "t-distribution";
    } else {
      return "unknown";
    }
  }

  reset(): void {
    super.reset();
    this.statisticalModels.clear();
    this.detectionMethods.forEach((method) => method.reset());
  }

  // Analysis methods

  getStatisticalModels(): Map<string, IStatisticalModel> {
    return new Map(this.statisticalModels);
  }

  analyzeDataQuality(source: string): IDataQualityAnalysis | null {
    const model = this.statisticalModels.get(source);
    if (!model) return null;

    const stats = model.statistics;

    return {
      completeness: 1.0, // Assume complete for now
      consistency: this.calculateConsistency(model.historicalData),
      accuracy: this.estimateAccuracy(stats),
      validity: this.checkDataValidity(stats),
      uniqueness: this.calculateUniqueness(model.historicalData),
      timeliness: 1.0, // Assume timely for now
      overallScore: 0.85, // Placeholder
    };
  }

  private calculateConsistency(values: number[]): number {
    if (values.length < 2) return 1.0;

    const changes = values.slice(1).map((val, i) => Math.abs(val - values[i]));
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const maxChange = Math.max(...changes);

    return maxChange > 0 ? 1 - avgChange / maxChange : 1.0;
  }

  private estimateAccuracy(stats: IAdvancedStatistics): number {
    // Estimate accuracy based on statistical properties
    let accuracy = 0.8; // Base accuracy

    // Lower coefficient of variation suggests more accurate data
    if (stats.coefficientOfVariation < 0.1) {
      accuracy += 0.1;
    } else if (stats.coefficientOfVariation > 1.0) {
      accuracy -= 0.2;
    }

    return Math.min(Math.max(accuracy, 0), 1);
  }

  private checkDataValidity(stats: IAdvancedStatistics): number {
    let validity = 1.0;

    // Check for impossible values
    if (stats.min < 0 && stats.mean > 0) {
      // Might be normal if negative values are expected
    }

    // Check for extreme outliers
    const extremeRange = stats.range / stats.mean;
    if (extremeRange > 10) {
      validity -= 0.2;
    }

    return Math.min(Math.max(validity, 0), 1);
  }

  private calculateUniqueness(values: number[]): number {
    const uniqueValues = new Set(values);
    return uniqueValues.size / values.length;
  }
}

// Detection method implementations

abstract class DetectionMethodBase implements IDetectionMethod {
  abstract name: string;

  abstract detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult>;

  abstract train(values: number[], model: IStatisticalModel): Promise<void>;

  reset(): void {
    // Base implementation - override if needed
  }
}

class ZScoreMethod extends DetectionMethodBase {
  name = "z-score";

  async detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult> {
    const stats = model.statistics;
    const zScore = Math.abs(dataPoint.value - stats.mean) / stats.stdDev;
    const threshold = config.threshold || 2.0;

    return {
      method: this.name,
      isAnomaly: zScore > threshold,
      score: Math.min(zScore / (threshold * 2), 1),
      confidence: this.calculateConfidence(zScore, model),
      anomalyType: dataPoint.value > stats.mean ? AnomalyType.SPIKE : AnomalyType.DROP,
      details: { zScore, threshold },
    };
  }

  private calculateConfidence(zScore: number, model: IStatisticalModel): number {
    let confidence = 0.7;

    // Higher confidence for normal distributions
    if (model.distribution.isNormal) {
      confidence += 0.2;
    }

    // Higher Z-scores get higher confidence
    confidence += Math.min(zScore / 10, 0.1);

    return Math.min(confidence, 1);
  }

  async train(values: number[], model: IStatisticalModel): Promise<void> {
    // Z-score doesn't require additional training beyond basic statistics
  }
}

class ModifiedZScoreMethod extends DetectionMethodBase {
  name = "modified-z-score";

  async detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult> {
    const stats = model.statistics;
    const modifiedZScore = (0.6745 * Math.abs(dataPoint.value - stats.median)) / stats.mad;
    const threshold = config.threshold || 3.5;

    return {
      method: this.name,
      isAnomaly: modifiedZScore > threshold,
      score: Math.min(modifiedZScore / (threshold * 2), 1),
      confidence: 0.8, // Generally more robust than regular Z-score
      anomalyType: dataPoint.value > stats.median ? AnomalyType.SPIKE : AnomalyType.DROP,
      details: { modifiedZScore, threshold },
    };
  }

  async train(values: number[], model: IStatisticalModel): Promise<void> {
    // Modified Z-score uses median and MAD, already calculated
  }
}

class IQRMethod extends DetectionMethodBase {
  name = "iqr";

  async detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult> {
    const stats = model.statistics;
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;
    const isAnomaly = dataPoint.value < lowerBound || dataPoint.value > upperBound;

    let score = 0;
    if (isAnomaly) {
      if (dataPoint.value < lowerBound) {
        score = (lowerBound - dataPoint.value) / stats.iqr;
      } else {
        score = (dataPoint.value - upperBound) / stats.iqr;
      }
    }

    return {
      method: this.name,
      isAnomaly,
      score: Math.min(score / 3, 1), // Normalize score
      confidence: 0.75,
      anomalyType: dataPoint.value > upperBound ? AnomalyType.SPIKE : AnomalyType.DROP,
      details: { lowerBound, upperBound, iqr: stats.iqr },
    };
  }

  async train(values: number[], model: IStatisticalModel): Promise<void> {
    // IQR method uses quartiles, already calculated
  }
}

class GrubbsTestMethod extends DetectionMethodBase {
  name = "grubbs";

  async detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult> {
    const stats = model.statistics;
    const n = model.sampleSize;
    const grubbsStatistic = Math.abs(dataPoint.value - stats.mean) / stats.stdDev;

    // Critical value for Grubbs test (simplified)
    const alpha = 0.05;
    const tCritical = this.getTCritical(n - 2, alpha / (2 * n));
    const grubbsCritical =
      ((n - 1) / Math.sqrt(n)) *
      Math.sqrt(Math.pow(tCritical, 2) / (n - 2 + Math.pow(tCritical, 2)));

    return {
      method: this.name,
      isAnomaly: grubbsStatistic > grubbsCritical,
      score: Math.min(grubbsStatistic / (grubbsCritical * 2), 1),
      confidence: model.distribution.isNormal ? 0.9 : 0.6,
      anomalyType: dataPoint.value > stats.mean ? AnomalyType.SPIKE : AnomalyType.DROP,
      details: { grubbsStatistic, grubbsCritical },
    };
  }

  private getTCritical(df: number, alpha: number): number {
    // Simplified t-critical value calculation
    // In production, use a proper statistical library
    return 2.0 + alpha * df * 0.1; // Rough approximation
  }

  async train(values: number[], model: IStatisticalModel): Promise<void> {
    // Grubbs test uses basic statistics
  }
}

class TukeyMethod extends DetectionMethodBase {
  name = "tukey";

  async detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult> {
    const stats = model.statistics;
    const k = 2.2; // Tukey constant
    const lowerBound = stats.q1 - k * stats.iqr;
    const upperBound = stats.q3 + k * stats.iqr;
    const isAnomaly = dataPoint.value < lowerBound || dataPoint.value > upperBound;

    let score = 0;
    if (isAnomaly) {
      if (dataPoint.value < lowerBound) {
        score = (lowerBound - dataPoint.value) / stats.iqr;
      } else {
        score = (dataPoint.value - upperBound) / stats.iqr;
      }
    }

    return {
      method: this.name,
      isAnomaly,
      score: Math.min(score / 4, 1),
      confidence: 0.7, // Conservative method
      anomalyType: dataPoint.value > upperBound ? AnomalyType.SPIKE : AnomalyType.DROP,
      details: { lowerBound, upperBound, k },
    };
  }

  async train(values: number[], model: IStatisticalModel): Promise<void> {
    // Tukey method uses quartiles
  }
}

class ESDTestMethod extends DetectionMethodBase {
  name = "esd";
  private maxOutliers = 10;

  async detect(
    dataPoint: IAnomalyData,
    model: IStatisticalModel,
    config: any,
  ): Promise<IDetectionResult> {
    // Simplified ESD test for single point
    // In production, implement full iterative ESD test
    const stats = model.statistics;
    const n = model.sampleSize;
    const testStatistic = Math.abs(dataPoint.value - stats.mean) / stats.stdDev;

    // Critical value for ESD test (simplified)
    const alpha = 0.05;
    const lambda =
      ((n - 1) / Math.sqrt(n)) *
      Math.sqrt(
        Math.pow(this.getTCritical(n - 2, alpha / (2 * n)), 2) /
          (n - 2 + Math.pow(this.getTCritical(n - 2, alpha / (2 * n)), 2)),
      );

    return {
      method: this.name,
      isAnomaly: testStatistic > lambda,
      score: Math.min(testStatistic / (lambda * 2), 1),
      confidence: 0.85,
      anomalyType: dataPoint.value > stats.mean ? AnomalyType.SPIKE : AnomalyType.DROP,
      details: { testStatistic, lambda },
    };
  }

  private getTCritical(df: number, alpha: number): number {
    return 2.0 + alpha * df * 0.1;
  }

  async train(values: number[], model: IStatisticalModel): Promise<void> {
    // ESD test configuration
  }
}

// Interfaces

interface IDetectionMethod {
  name: string;
  detect(dataPoint: IAnomalyData, model: IStatisticalModel, config: any): Promise<IDetectionResult>;
  train(values: number[], model: IStatisticalModel): Promise<void>;
  reset(): void;
}

interface IDetectionResult {
  method: string;
  isAnomaly: boolean;
  score: number;
  confidence: number;
  anomalyType: AnomalyType;
  details: Record<string, any>;
}

interface IStatisticalModel {
  source: string;
  statistics: IAdvancedStatistics;
  distribution: IDistributionAnalysis;
  sampleSize: number;
  trainedAt: number;
  historicalData: number[];
}

interface IAdvancedStatistics {
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
  mad: number;
  trimmedMean: number;
  coefficientOfVariation: number;
}

interface IDistributionAnalysis {
  isNormal: boolean;
  normalityTests: Record<string, boolean>;
  characteristics: Record<string, boolean>;
  suggestedDistribution: string;
}

interface IEnsembleScore {
  score: number;
  weights: Map<string, number>;
}

interface IDataQualityAnalysis {
  completeness: number;
  consistency: number;
  accuracy: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
  overallScore: number;
}
