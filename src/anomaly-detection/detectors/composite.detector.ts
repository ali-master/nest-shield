import { Injectable } from "@nestjs/common";
import { BaseAnomalyDetector } from "./base.detector";
import type { IAnomalyData, IAnomaly } from "../interfaces/anomaly.interface";
import { AnomalyType } from "../interfaces/anomaly.interface";
import type { IDetectorContext } from "../interfaces/detector.interface";

// Import all detector types
import { ZScoreDetector } from "./zscore.detector";
import { IsolationForestDetector } from "./isolation-forest.detector";
import { SeasonalAnomalyDetector } from "./seasonal.detector";
import { ThresholdAnomalyDetector } from "./threshold.detector";
import { StatisticalAnomalyDetector } from "./statistical.detector";
import { MachineLearningDetector } from "./machine-learning.detector";

// Enums and Interfaces

enum EnsembleStrategy {
  MAJORITY_VOTE = "majority_vote",
  WEIGHTED_AVERAGE = "weighted_average",
  ADAPTIVE_WEIGHTED = "adaptive_weighted",
  STACKING = "stacking",
  HIERARCHICAL = "hierarchical",
}

interface IDetectorAnomaly {
  detectorName: string;
  anomaly: IAnomaly;
  weight: number;
  confidence: number;
  responseTime: number;
}

interface IDetectorPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  responseTime: number;
  detectionCount: number;
  lastUpdated: number;
}

@Injectable()
export class CompositeAnomalyDetector extends BaseAnomalyDetector {
  readonly name = "Composite Anomaly Detector";
  readonly version = "1.0.0";
  readonly description =
    "Multi-algorithm ensemble detector with adaptive weighting and intelligent combination";

  private detectors: Map<string, BaseAnomalyDetector> = new Map();
  private detectorWeights: Map<string, number> = new Map();
  private detectorPerformance: Map<string, IDetectorPerformance> = new Map();
  private ensembleStrategy: EnsembleStrategy = EnsembleStrategy.ADAPTIVE_WEIGHTED;
  private conflictResolver: ConflictResolver;
  private performanceTracker: PerformanceTracker;
  private contextAnalyzer: ContextAnalyzer;

  constructor() {
    super();
    this.conflictResolver = new ConflictResolver();
    this.performanceTracker = new PerformanceTracker();
    this.contextAnalyzer = new ContextAnalyzer();
    this.initializeDetectors();
  }

  private initializeDetectors(): void {
    // Initialize all available detectors
    const detectorInstances = [
      new ZScoreDetector(),
      new IsolationForestDetector(),
      new SeasonalAnomalyDetector(),
      new ThresholdAnomalyDetector(),
      new StatisticalAnomalyDetector(),
      new MachineLearningDetector(),
    ];

    detectorInstances.forEach((detector) => {
      this.detectors.set(detector.name, detector);
      this.detectorWeights.set(detector.name, this.getInitialWeight(detector.name));
      this.detectorPerformance.set(detector.name, this.createInitialPerformance());
    });

    this.logger.log(`Initialized ${this.detectors.size} detectors in composite ensemble`);
  }

  private getInitialWeight(detectorName: string): number {
    // Initial weights based on detector characteristics
    const weights: Record<string, number> = {
      "Z-Score Detector": 1.0, // Baseline statistical method
      "Isolation Forest Detector": 1.2, // Good for complex patterns
      "Seasonal Anomaly Detector": 1.1, // Excellent for time series
      "Threshold Anomaly Detector": 0.8, // Simple but reliable
      "Statistical Anomaly Detector": 1.3, // Robust ensemble method
      "Machine Learning Detector": 1.4, // Advanced ML techniques
    };

    return weights[detectorName] || 1.0;
  }

  private createInitialPerformance(): IDetectorPerformance {
    return {
      accuracy: 0.8, // Initial estimate
      precision: 0.75,
      recall: 0.7,
      f1Score: 0.725,
      falsePositiveRate: 0.1,
      responseTime: 0,
      detectionCount: 0,
      lastUpdated: Date.now(),
    };
  }

  async detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isReady() || data.length === 0) {
      return [];
    }

    // Analyze context to determine optimal detector subset
    const contextAnalysis = this.contextAnalyzer.analyze(data, context);
    const activeDetectors = this.selectActiveDetectors(contextAnalysis);

    const startTime = Date.now();
    const anomalies: IAnomaly[] = [];

    for (const dataPoint of data) {
      if (this.isMaintenanceWindow(dataPoint.timestamp, context)) {
        continue;
      }

      const anomaly = await this.detectSinglePoint(dataPoint, context, activeDetectors);
      if (anomaly) {
        const processedAnomaly = this.applyBusinessRules(anomaly);
        if (processedAnomaly) {
          anomalies.push(processedAnomaly);
        }
      }
    }

    // Update performance metrics
    const responseTime = Date.now() - startTime;
    this.updatePerformanceMetrics(activeDetectors, responseTime, anomalies.length);

    return anomalies;
  }

  private async detectSinglePoint(
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
    activeDetectors?: string[],
  ): Promise<IAnomaly | null> {
    const detectorsToUse = activeDetectors || Array.from(this.detectors.keys());

    // Run detection in parallel across all active detectors
    const detectionPromises = detectorsToUse.map(async (detectorName) => {
      const detector = this.detectors.get(detectorName);
      if (!detector || !detector.isReady()) {
        return null;
      }

      try {
        const startTime = Date.now();
        const results = await detector.detect([dataPoint], context);
        const endTime = Date.now();

        this.updateDetectorResponseTime(detectorName, endTime - startTime);

        return {
          detectorName,
          results,
          responseTime: endTime - startTime,
        };
      } catch (error) {
        this.logger.warn(`Detector ${detectorName} failed:`, error);
        return null;
      }
    });

    const detectionResults = (await Promise.all(detectionPromises)).filter((r) => r !== null);

    if (detectionResults.length === 0) {
      return null;
    }

    // Extract anomalies from each detector
    const detectorAnomalies: IDetectorAnomaly[] = detectionResults
      .filter((result) => result.results.length > 0)
      .map((result) => ({
        detectorName: result.detectorName,
        anomaly: result.results[0], // Single data point, single anomaly
        weight: this.detectorWeights.get(result.detectorName) || 1.0,
        confidence: result.results[0].confidence,
        responseTime: result.responseTime,
      }));

    if (detectorAnomalies.length === 0) {
      return null;
    }

    // Apply ensemble strategy
    const ensembleResult = await this.applyEnsembleStrategy(detectorAnomalies, dataPoint, context);

    if (!ensembleResult || ensembleResult.score < this.config.threshold) {
      return null;
    }

    return ensembleResult;
  }

  private selectActiveDetectors(contextAnalysis: IContextAnalysis): string[] {
    const allDetectors = Array.from(this.detectors.keys());

    // Smart detector selection based on context
    if (contextAnalysis.dataCharacteristics.hasSeasonality) {
      // Prioritize seasonal and time-series detectors
      return allDetectors.filter(
        (name) =>
          name.includes("Seasonal") ||
          name.includes("Machine Learning") ||
          name.includes("Statistical"),
      );
    }

    if (contextAnalysis.dataCharacteristics.isHighDimensional) {
      // Prioritize ML and isolation forest detectors
      return allDetectors.filter(
        (name) =>
          name.includes("Machine Learning") ||
          name.includes("Isolation Forest") ||
          name.includes("Statistical"),
      );
    }

    if (contextAnalysis.performanceRequirements.lowLatency) {
      // Prioritize fast detectors
      return allDetectors.filter((name) => name.includes("Threshold") || name.includes("Z-Score"));
    }

    if (contextAnalysis.dataCharacteristics.hasKnownBounds) {
      // Prioritize threshold-based detectors
      return allDetectors.filter(
        (name) => name.includes("Threshold") || name.includes("Statistical"),
      );
    }

    // Default: use all detectors
    return allDetectors;
  }

  private async applyEnsembleStrategy(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): Promise<IAnomaly | null> {
    switch (this.ensembleStrategy) {
      case EnsembleStrategy.MAJORITY_VOTE:
        return this.majorityVoteEnsemble(detectorAnomalies, dataPoint);

      case EnsembleStrategy.WEIGHTED_AVERAGE:
        return this.weightedAverageEnsemble(detectorAnomalies, dataPoint);

      case EnsembleStrategy.ADAPTIVE_WEIGHTED:
        return this.adaptiveWeightedEnsemble(detectorAnomalies, dataPoint, context);

      case EnsembleStrategy.STACKING:
        return this.stackingEnsemble(detectorAnomalies, dataPoint, context);

      case EnsembleStrategy.HIERARCHICAL:
        return this.hierarchicalEnsemble(detectorAnomalies, dataPoint, context);

      default:
        return this.adaptiveWeightedEnsemble(detectorAnomalies, dataPoint, context);
    }
  }

  private majorityVoteEnsemble(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
  ): IAnomaly | null {
    if (detectorAnomalies.length < 2) {
      return detectorAnomalies[0]?.anomaly || null;
    }

    // Simple majority vote
    const majority = Math.ceil(detectorAnomalies.length / 2);
    if (detectorAnomalies.length >= majority) {
      // Combine anomalies using average
      return this.combineAnomalies(detectorAnomalies, dataPoint, "majority_vote");
    }

    return null;
  }

  private weightedAverageEnsemble(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
  ): IAnomaly | null {
    // Weight by detector weights and confidence
    const weightedScore = detectorAnomalies.reduce((sum, da) => {
      return sum + da.anomaly.score * da.weight * da.confidence;
    }, 0);

    const totalWeight = detectorAnomalies.reduce((sum, da) => {
      return sum + da.weight * da.confidence;
    }, 0);

    if (totalWeight === 0) return null;

    const ensembleScore = weightedScore / totalWeight;
    return this.createEnsembleAnomaly(
      detectorAnomalies,
      dataPoint,
      ensembleScore,
      "weighted_average",
    );
  }

  private adaptiveWeightedEnsemble(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): IAnomaly | null {
    // Adapt weights based on recent performance and context
    const adaptedWeights = new Map<string, number>();

    detectorAnomalies.forEach((da) => {
      let adaptedWeight = da.weight;
      const performance = this.detectorPerformance.get(da.detectorName);

      if (performance) {
        // Adjust weight based on recent performance
        const performanceMultiplier = (performance.accuracy + performance.f1Score) / 2;
        adaptedWeight *= performanceMultiplier;

        // Penalize slow detectors in low-latency contexts
        if (context && performance.responseTime > 10) {
          // 10ms threshold
          adaptedWeight *= 0.8;
        }
      }

      // Context-based adjustments
      if (context) {
        adaptedWeight *= this.getContextualWeight(da.detectorName, context);
      }

      adaptedWeights.set(da.detectorName, adaptedWeight);
    });

    // Calculate ensemble score with adapted weights
    const weightedScore = detectorAnomalies.reduce((sum, da) => {
      const weight = adaptedWeights.get(da.detectorName) || 1.0;
      return sum + da.anomaly.score * weight * da.confidence;
    }, 0);

    const totalWeight = detectorAnomalies.reduce((sum, da) => {
      const weight = adaptedWeights.get(da.detectorName) || 1.0;
      return sum + weight * da.confidence;
    }, 0);

    if (totalWeight === 0) return null;

    const ensembleScore = weightedScore / totalWeight;
    return this.createEnsembleAnomaly(
      detectorAnomalies,
      dataPoint,
      ensembleScore,
      "adaptive_weighted",
    );
  }

  private getContextualWeight(detectorName: string, context: IDetectorContext): number {
    let weight = 1.0;

    // Deployment context - be more conservative
    if (this.hasRecentDeployment(Date.now(), context)) {
      if (detectorName.includes("Threshold") || detectorName.includes("Statistical")) {
        weight *= 1.2; // More reliable during deployments
      } else {
        weight *= 0.9; // Less weight for complex detectors
      }
    }

    // Maintenance context - very conservative
    if (
      context.maintenanceWindows?.some(
        (window) => Date.now() >= window.start && Date.now() <= window.end,
      )
    ) {
      weight *= 0.7; // Reduce all weights during maintenance
    }

    return weight;
  }

  private stackingEnsemble(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): IAnomaly | null {
    // Meta-learning approach (simplified implementation)
    // In production, this would use a trained meta-model

    const features = this.extractMetaFeatures(detectorAnomalies, dataPoint, context);
    const metaPrediction = this.simpleMetaPredictor(features);

    if (metaPrediction.isAnomaly) {
      return this.createEnsembleAnomaly(
        detectorAnomalies,
        dataPoint,
        metaPrediction.score,
        "stacking",
      );
    }

    return null;
  }

  private hierarchicalEnsemble(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): IAnomaly | null {
    // Multi-stage detection pipeline

    // Stage 1: Fast detectors for initial screening
    const fastDetectors = detectorAnomalies.filter(
      (da) => da.detectorName.includes("Threshold") || da.detectorName.includes("Z-Score"),
    );

    if (fastDetectors.length > 0) {
      const fastEnsemble = this.weightedAverageEnsemble(fastDetectors, dataPoint);
      if (!fastEnsemble || fastEnsemble.score < 0.3) {
        return null; // Early exit if fast detectors don't trigger
      }
    }

    // Stage 2: Sophisticated detectors for confirmation
    const sophisticatedDetectors = detectorAnomalies.filter(
      (da) =>
        da.detectorName.includes("Machine Learning") ||
        da.detectorName.includes("Statistical") ||
        da.detectorName.includes("Isolation Forest"),
    );

    if (sophisticatedDetectors.length > 0) {
      return this.adaptiveWeightedEnsemble(sophisticatedDetectors, dataPoint, context);
    }

    // Fallback to all detectors
    return this.adaptiveWeightedEnsemble(detectorAnomalies, dataPoint, context);
  }

  private extractMetaFeatures(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): number[] {
    const features: number[] = [];

    // Detector agreement features
    const scores = detectorAnomalies.map((da) => da.anomaly.score);
    features.push(scores.reduce((sum, score) => sum + score, 0) / scores.length); // Mean score
    features.push(Math.sqrt(scores.reduce((sum, score) => sum + score * score, 0) / scores.length)); // RMS score
    features.push(Math.max(...scores)); // Max score
    features.push(Math.min(...scores)); // Min score

    // Confidence features
    const confidences = detectorAnomalies.map((da) => da.confidence);
    features.push(confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length); // Mean confidence
    features.push(Math.min(...confidences)); // Min confidence

    // Detector type features
    features.push(detectorAnomalies.filter((da) => da.detectorName.includes("Statistical")).length);
    features.push(
      detectorAnomalies.filter((da) => da.detectorName.includes("Machine Learning")).length,
    );
    features.push(detectorAnomalies.filter((da) => da.detectorName.includes("Threshold")).length);

    // Performance features
    const responseTimes = detectorAnomalies.map((da) => da.responseTime);
    features.push(Math.max(...responseTimes)); // Max response time

    // Context features
    features.push(context ? 1 : 0); // Has context
    features.push(this.hasRecentDeployment(Date.now(), context) ? 1 : 0); // Recent deployment

    return features;
  }

  private simpleMetaPredictor(features: number[]): { isAnomaly: boolean; score: number } {
    // Simplified meta-predictor (in production, use trained model)
    const meanScore = features[0];
    const maxScore = features[2];
    const meanConfidence = features[4];

    // Simple heuristic-based meta-prediction
    const metaScore = meanScore * 0.4 + maxScore * 0.4 + meanConfidence * 0.2;
    const isAnomaly = metaScore > 0.6 && meanConfidence > 0.5;

    return { isAnomaly, score: metaScore };
  }

  private createEnsembleAnomaly(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    ensembleScore: number,
    strategy: string,
  ): IAnomaly {
    // Determine ensemble anomaly type
    const anomalyTypes = detectorAnomalies.map((da) => da.anomaly.type);
    const dominantType = this.getMostFrequentType(anomalyTypes);

    // Calculate ensemble confidence
    const confidences = detectorAnomalies.map((da) => da.confidence);
    const ensembleConfidence = this.calculateEnsembleConfidence(
      confidences,
      detectorAnomalies.length,
    );

    // Calculate expected value if available
    const expectedValues = detectorAnomalies
      .map((da) => da.anomaly.expectedValue)
      .filter((val) => val !== undefined);
    const ensembleExpectedValue =
      expectedValues.length > 0
        ? expectedValues.reduce((sum, val) => sum + val, 0) / expectedValues.length
        : undefined;

    // Create ensemble description
    const detectorNames = detectorAnomalies.map((da) => da.detectorName).join(", ");
    const description =
      `Composite anomaly detected by ${detectorAnomalies.length} detectors ` +
      `[${detectorNames}] using ${strategy} strategy ` +
      `(score=${ensembleScore.toFixed(3)}, confidence=${ensembleConfidence.toFixed(3)})`;

    return this.createAnomaly(
      dataPoint,
      dominantType,
      ensembleScore,
      ensembleConfidence,
      description,
      ensembleExpectedValue,
    );
  }

  private getMostFrequentType(types: AnomalyType[]): AnomalyType {
    const typeCounts = new Map<AnomalyType, number>();

    types.forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    let mostFrequent = AnomalyType.OUTLIER;
    let maxCount = 0;

    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = type;
      }
    });

    return mostFrequent;
  }

  private calculateEnsembleConfidence(confidences: number[], detectorCount: number): number {
    const meanConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const agreementBonus = (detectorCount - 1) * 0.1; // Bonus for more detectors agreeing

    return Math.min(meanConfidence + agreementBonus, 1.0);
  }

  private combineAnomalies(
    detectorAnomalies: IDetectorAnomaly[],
    dataPoint: IAnomalyData,
    strategy: string,
  ): IAnomaly {
    const averageScore =
      detectorAnomalies.reduce((sum, da) => sum + da.anomaly.score, 0) / detectorAnomalies.length;
    return this.createEnsembleAnomaly(detectorAnomalies, dataPoint, averageScore, strategy);
  }

  protected async performTraining(data: IAnomalyData[]): Promise<void> {
    this.logger.log(`Training composite detector with ${data.length} data points`);

    // Configure all detectors with consistent settings
    const detectorConfig = {
      ...this.config,
      threshold: this.config.threshold * 0.8, // Slightly more sensitive for individual detectors
    };

    // Train all detectors in parallel
    const trainingPromises = Array.from(this.detectors.entries()).map(async ([name, detector]) => {
      try {
        detector.configure(detectorConfig);
        await detector.train(data);
        this.logger.log(`Successfully trained ${name}`);
        return { name, success: true };
      } catch (error) {
        this.logger.warn(`Failed to train ${name}:`, error);
        return { name, success: false };
      }
    });

    const trainingResults = await Promise.all(trainingPromises);
    const successfulTraining = trainingResults.filter((r) => r.success);

    this.logger.log(
      `Composite detector training completed: ${successfulTraining.length}/${trainingResults.length} detectors trained successfully`,
    );

    // Initialize performance tracking
    this.performanceTracker.initialize(Array.from(this.detectors.keys()));
  }

  private updatePerformanceMetrics(
    activeDetectors: string[],
    responseTime: number,
    detectionCount: number,
  ): void {
    activeDetectors.forEach((detectorName) => {
      const performance = this.detectorPerformance.get(detectorName);
      if (performance) {
        performance.responseTime = (performance.responseTime + responseTime) / 2; // Moving average
        performance.detectionCount += detectionCount;
        performance.lastUpdated = Date.now();
      }
    });
  }

  private updateDetectorResponseTime(detectorName: string, responseTime: number): void {
    const performance = this.detectorPerformance.get(detectorName);
    if (performance) {
      performance.responseTime = (performance.responseTime + responseTime) / 2;
    }
  }

  reset(): void {
    super.reset();
    this.detectors.forEach((detector) => detector.reset());
    this.detectorPerformance.forEach((performance) => {
      Object.assign(performance, this.createInitialPerformance());
    });
  }

  // Advanced composite methods

  setEnsembleStrategy(strategy: EnsembleStrategy): void {
    this.ensembleStrategy = strategy;
    this.logger.log(`Ensemble strategy changed to: ${EnsembleStrategy[strategy]}`);
  }

  getDetectorPerformance(): Map<string, IDetectorPerformance> {
    return new Map(this.detectorPerformance);
  }

  enableDetector(detectorName: string): void {
    const detector = this.detectors.get(detectorName);
    if (detector) {
      const currentParams = detector.getModelInfo().parameters || {};
      detector.configure({
        enabled: true,
        sensitivity: currentParams.sensitivity ?? 0.5,
        threshold: currentParams.threshold ?? 2.0,
        windowSize: currentParams.windowSize ?? 100,
        minDataPoints: currentParams.minDataPoints ?? 20,
        ...currentParams,
      });
    }
  }

  disableDetector(detectorName: string): void {
    const detector = this.detectors.get(detectorName);
    if (detector) {
      const currentParams = detector.getModelInfo().parameters || {};
      detector.configure({
        enabled: false,
        sensitivity: currentParams.sensitivity ?? 0.5,
        threshold: currentParams.threshold ?? 2.0,
        windowSize: currentParams.windowSize ?? 100,
        minDataPoints: currentParams.minDataPoints ?? 20,
        ...currentParams,
      });
    }
  }

  adjustDetectorWeight(detectorName: string, weight: number): void {
    this.detectorWeights.set(detectorName, Math.max(0, Math.min(2, weight))); // Clamp between 0 and 2
  }

  getEnsembleStatistics(): IEnsembleStatistics {
    const detectorStats = Array.from(this.detectors.entries()).map(([name, detector]) => ({
      name,
      isReady: detector.isReady(),
      weight: this.detectorWeights.get(name) || 1.0,
      performance: this.detectorPerformance.get(name),
    }));

    return {
      strategy: EnsembleStrategy[this.ensembleStrategy],
      detectorCount: this.detectors.size,
      activeDetectorCount: detectorStats.filter((d) => d.isReady).length,
      detectorStats,
      lastUpdated: Date.now(),
    };
  }

  async provideDetectorFeedback(
    detectorName: string,
    feedback: IDetectorFeedback[],
  ): Promise<void> {
    const detector = this.detectors.get(detectorName);
    if (detector && "updateModel" in detector) {
      try {
        await (detector as any).updateModel(feedback);
        this.logger.log(`Provided feedback to ${detectorName}`);
      } catch (error) {
        this.logger.warn(`Failed to provide feedback to ${detectorName}:`, error);
      }
    }
  }
}

// Supporting classes

class ConflictResolver {
  resolve(conflictingAnomalies: IDetectorAnomaly[]): IDetectorAnomaly[] {
    // Implement conflict resolution strategies
    // For now, return all anomalies (let ensemble handle it)
    return conflictingAnomalies;
  }
}

class PerformanceTracker {
  private metrics: Map<string, IPerformanceMetrics> = new Map();

  initialize(detectorNames: string[]): void {
    detectorNames.forEach((name) => {
      this.metrics.set(name, {
        totalRequests: 0,
        successfulDetections: 0,
        falsePositives: 0,
        falseNegatives: 0,
        averageResponseTime: 0,
        lastReset: Date.now(),
      });
    });
  }

  updateMetrics(detectorName: string, metrics: Partial<IPerformanceMetrics>): void {
    const current = this.metrics.get(detectorName);
    if (current) {
      Object.assign(current, metrics);
    }
  }

  getMetrics(detectorName: string): IPerformanceMetrics | undefined {
    return this.metrics.get(detectorName);
  }
}

class ContextAnalyzer {
  analyze(data: IAnomalyData[], context?: IDetectorContext): IContextAnalysis {
    const dataCharacteristics = this.analyzeDataCharacteristics(data);
    const performanceRequirements = this.analyzePerformanceRequirements(context);
    const environmentalFactors = this.analyzeEnvironmentalFactors(context);

    return {
      dataCharacteristics,
      performanceRequirements,
      environmentalFactors,
      recommendation: this.generateRecommendation(dataCharacteristics, performanceRequirements),
    };
  }

  private analyzeDataCharacteristics(data: IAnomalyData[]): IDataCharacteristics {
    const values = data.map((d) => d.value);
    const timeDeltas = data.slice(1).map((d, i) => d.timestamp - data[i].timestamp);

    return {
      sampleSize: data.length,
      hasSeasonality: this.detectSeasonality(data),
      isHighDimensional: false, // Single value per point
      hasKnownBounds: this.detectKnownBounds(values),
      isTimeSeries: timeDeltas.every((delta) => delta > 0), // Ordered by time
      volatility: this.calculateVolatility(values),
    };
  }

  private analyzePerformanceRequirements(context?: IDetectorContext): IPerformanceRequirements {
    // Use performance requirements from context if provided, otherwise use defaults
    if (context?.performanceRequirements) {
      return context.performanceRequirements;
    }

    return {
      lowLatency: false,
      highThroughput: false,
      highAccuracy: true, // Default to high accuracy requirement
    };
  }

  private analyzeEnvironmentalFactors(context?: IDetectorContext): IEnvironmentalFactors {
    return {
      hasRecentDeployments: context?.deployments
        ? context.deployments.some((d) => Date.now() - d.timestamp < 3600000)
        : false,
      isMaintenanceWindow: context?.maintenanceWindows
        ? context.maintenanceWindows.some((w) => Date.now() >= w.start && Date.now() <= w.end)
        : false,
      systemLoad: "normal", // Could be determined from system metrics
    };
  }

  private detectSeasonality(data: IAnomalyData[]): boolean {
    // Simplified seasonality detection
    if (data.length < 24) return false; // Need at least 24 points for daily pattern

    const values = data.map((d) => d.value);
    const hours = data.map((d) => new Date(d.timestamp).getHours());

    // Check for daily pattern (simplified)
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    values.forEach((value, i) => {
      const hour = hours[i];
      hourlyAverages[hour] += value;
      hourlyCounts[hour]++;
    });

    // Calculate variance between hours
    const nonZeroHours = hourlyAverages.filter((_, i) => hourlyCounts[i] > 0);
    if (nonZeroHours.length < 12) return false;

    const overallMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const hourlyVariance =
      hourlyAverages.reduce((sum, avg, i) => {
        if (hourlyCounts[i] > 0) {
          const hourlyMean = avg / hourlyCounts[i];
          return sum + (hourlyMean - overallMean) ** 2;
        }
        return sum;
      }, 0) / nonZeroHours.length;

    const totalVariance =
      values.reduce((sum, val) => sum + (val - overallMean) ** 2, 0) / values.length;

    return hourlyVariance / totalVariance > 0.1; // 10% threshold for seasonality
  }

  private detectKnownBounds(values: number[]): boolean {
    // Detect if values seem to have natural bounds (e.g., percentages, ratios)
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Check for common bounded ranges
    return (
      (min >= 0 && max <= 1) || // 0-1 range (percentages, ratios)
      (min >= 0 && max <= 100) || // 0-100 range (percentages)
      (min >= -1 && max <= 1)
    ); // -1 to 1 range (correlation, etc.)
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const changes = values
      .slice(1)
      .map((val, i) => Math.abs(val - values[i]) / Math.abs(values[i] || 1));

    return changes.reduce((sum, change) => sum + change, 0) / changes.length;
  }

  private generateRecommendation(
    dataChar: IDataCharacteristics,
    perfReq: IPerformanceRequirements,
  ): string {
    if (perfReq.lowLatency) {
      return "Use fast detectors (Threshold, Z-Score) for low-latency requirements";
    }

    if (dataChar.hasSeasonality) {
      return "Use seasonal and time-series detectors for pattern-rich data";
    }

    if (dataChar.hasKnownBounds) {
      return "Use threshold-based detectors for bounded data";
    }

    if (perfReq.highAccuracy) {
      return "Use ensemble of multiple detectors for high accuracy";
    }

    return "Use adaptive weighted ensemble for balanced performance";
  }
}

// Additional interfaces

interface IContextAnalysis {
  dataCharacteristics: IDataCharacteristics;
  performanceRequirements: IPerformanceRequirements;
  environmentalFactors: IEnvironmentalFactors;
  recommendation: string;
}

interface IDataCharacteristics {
  sampleSize: number;
  hasSeasonality: boolean;
  isHighDimensional: boolean;
  hasKnownBounds: boolean;
  isTimeSeries: boolean;
  volatility: number;
}

interface IPerformanceRequirements {
  lowLatency: boolean;
  highThroughput: boolean;
  highAccuracy: boolean;
}

interface IEnvironmentalFactors {
  hasRecentDeployments: boolean;
  isMaintenanceWindow: boolean;
  systemLoad: "low" | "normal" | "high";
}

interface IEnsembleStatistics {
  strategy: string;
  detectorCount: number;
  activeDetectorCount: number;
  detectorStats: Array<{
    name: string;
    isReady: boolean;
    weight: number;
    performance?: IDetectorPerformance;
  }>;
  lastUpdated: number;
}

interface IDetectorFeedback {
  dataPoint: IAnomalyData;
  isAnomaly: boolean;
  confidence: number;
  feedback: "correct" | "false_positive" | "false_negative";
  timestamp: number;
}

interface IPerformanceMetrics {
  totalRequests: number;
  successfulDetections: number;
  falsePositives: number;
  falseNegatives: number;
  averageResponseTime: number;
  lastReset: number;
}
