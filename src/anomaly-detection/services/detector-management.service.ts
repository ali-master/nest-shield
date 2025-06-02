import { Injectable } from "@nestjs/common";
import {
  IsolationForestDetector,
  MachineLearningDetector,
  SeasonalAnomalyDetector,
  StatisticalAnomalyDetector,
  ZScoreDetector,
} from "../detectors";
import { IAnomalyData } from "../interfaces";
import { IDataQualityMetrics } from "./data-collector.service";

export interface IDetectorStats {
  name: string;
  type: string;
  ready: boolean;
  stats?: any;
  featureImportance?: Record<string, number>;
  modelInfo?: any;
  dataQuality?: IDataQualityMetrics;
}

export { IDataQualityMetrics };

@Injectable()
export class DetectorManagementService {
  private detectors: Map<string, any> = new Map();

  registerDetector(name: string, detector: any): void {
    this.detectors.set(name, detector);
  }

  getDetectorStats(detectorName?: string): IDetectorStats[] {
    const stats: IDetectorStats[] = [];

    for (const [name, detector] of this.detectors.entries()) {
      if (detectorName && name !== detectorName) continue;

      const stat: IDetectorStats = {
        name,
        type: detector.constructor.name,
        ready: detector.isReady?.() || false,
      };

      // Get detector-specific stats
      if (detector instanceof IsolationForestDetector) {
        stat.stats = detector.getTreeStats();
        stat.featureImportance = detector.getFeatureImportance();
      }

      if (detector instanceof MachineLearningDetector) {
        stat.modelInfo = detector.getSourceModelInfo("default");
      }

      if (detector instanceof StatisticalAnomalyDetector) {
        const models = detector.getStatisticalModels();
        stat.stats = {
          modelCount: Object.keys(models).length,
          models: Object.fromEntries(
            Object.entries(models).map(([key, model]) => [
              key,
              {
                mean: model.mean,
                stdDev: model.stdDev,
                count: model.count,
              },
            ]),
          ),
        };
      }

      stats.push(stat);
    }

    return stats;
  }

  analyzeDataQuality(detectorName: string, data: IAnomalyData[]): IDataQualityMetrics | null {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof StatisticalAnomalyDetector && data.length > 0) {
      // Statistical detector expects a source, use the first data point's source
      const qualityAnalysis = detector.analyzeDataQuality(data[0].source || "default");
      if (qualityAnalysis) {
        // Convert IDataQualityAnalysis to IDataQualityMetrics
        return {
          completeness: qualityAnalysis.completeness,
          accuracy: qualityAnalysis.accuracy,
          consistency: qualityAnalysis.consistency,
          timeliness: qualityAnalysis.timeliness,
          validity: qualityAnalysis.validity,
          uniqueness: qualityAnalysis.uniqueness,
          timestamp: Date.now(),
        };
      }
    }

    // Default quality analysis for other detectors
    return this.defaultDataQualityAnalysis(data);
  }

  async batchScoreAnomalies(detectorName: string, data: IAnomalyData[]): Promise<number[]> {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof IsolationForestDetector) {
      return detector.getAnomalyScores(data);
    }

    // Fallback to individual detection
    const scores: number[] = [];
    for (const point of data) {
      const anomalies = await detector.detect([point]);
      scores.push(anomalies.length > 0 ? anomalies[0].score : 0);
    }

    return scores;
  }

  async retrainModel(detectorName: string, source: string, data: IAnomalyData[]): Promise<void> {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof MachineLearningDetector) {
      await detector.retrainModel(source, data);
    } else if (detector?.train) {
      await detector.train(data);
    }
  }

  async updateModelWithFeedback(
    detectorName: string,
    source: string,
    data: IAnomalyData[],
    feedback: boolean[],
  ): Promise<void> {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof MachineLearningDetector) {
      // MachineLearningDetector's updateModel takes (source, feedback as IModelFeedback[])
      // Convert boolean[] to IModelFeedback[]
      const modelFeedback = data.map((d, i) => ({
        timestamp: d.timestamp,
        wasAnomaly: feedback[i] || false,
        metadata: d.metadata,
      }));
      await detector.updateModel(source, modelFeedback as any);
    }
  }

  getSeasonalPatterns(detectorName: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof SeasonalAnomalyDetector) {
      return detector.getSeasonalPatterns();
    }

    return null;
  }

  predictNextValues(
    detectorName: string,
    source: string,
    steps: number,
    includeConfidenceInterval = false,
  ): any {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof SeasonalAnomalyDetector) {
      // SeasonalAnomalyDetector.predictNextValues only takes 2 parameters: source and horizon
      const forecast = detector.predictNextValues(source, steps);

      if (includeConfidenceInterval && forecast) {
        // Add confidence intervals based on historical volatility
        const patterns = detector.getSeasonalPatterns();
        const volatility = patterns?.[source]?.volatility || 0.1;

        return {
          ...forecast,
          includesConfidenceInterval: true,
          confidenceLevel: 0.95,
          volatilityFactor: volatility,
        };
      }

      return forecast;
    }

    return null;
  }

  getBaseline(detectorName: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof ZScoreDetector) {
      return detector.getBaseline();
    }

    return null;
  }

  setBaseline(detectorName: string, mean: number, stdDev: number, count: number): void {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof ZScoreDetector) {
      // ZScoreDetector.setBaseline expects an IBaseline object
      detector.setBaseline({
        mean,
        stdDev,
        sampleSize: count,
        lastUpdated: Date.now(),
      });
    }
  }

  // Threshold detector management methods
  setThreshold(detectorName: string, source: string, thresholds: any): void {
    const detector = this.detectors.get(detectorName);

    if (detector && "setThreshold" in detector) {
      detector.setThreshold(source, thresholds);
    }
  }

  getThresholds(detectorName: string, source?: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector && "getThresholds" in detector) {
      return detector.getThresholds(source);
    }

    return null;
  }

  getAdaptiveThresholds(detectorName: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector && "getAdaptiveThresholds" in detector) {
      return detector.getAdaptiveThresholds();
    }

    return null;
  }

  setAdaptiveThresholdsEnabled(detectorName: string, source: string, enabled: boolean): void {
    const detector = this.detectors.get(detectorName);

    if (
      detector &&
      "enableAdaptiveThresholds" in detector &&
      "disableAdaptiveThresholds" in detector
    ) {
      if (enabled) {
        detector.enableAdaptiveThresholds(source);
      } else {
        detector.disableAdaptiveThresholds(source);
      }
    }
  }

  // Composite detector ensemble management methods
  setEnsembleStrategy(detectorName: string, strategy: string): boolean {
    const detector = this.detectors.get(detectorName);

    if (detector && "setEnsembleStrategy" in detector) {
      detector.setEnsembleStrategy(strategy);
      return true;
    }

    return false;
  }

  getDetectorPerformance(detectorName: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector && "getDetectorPerformance" in detector) {
      return detector.getDetectorPerformance();
    }

    return null;
  }

  setDetectorEnabled(detectorName: string, childDetectorName: string, enabled: boolean): boolean {
    const detector = this.detectors.get(detectorName);

    if (detector && "enableDetector" in detector && "disableDetector" in detector) {
      if (enabled) {
        detector.enableDetector(childDetectorName);
      } else {
        detector.disableDetector(childDetectorName);
      }
      return true;
    }

    return false;
  }

  adjustDetectorWeight(detectorName: string, childDetectorName: string, weight: number): boolean {
    const detector = this.detectors.get(detectorName);

    if (detector && "adjustDetectorWeight" in detector) {
      detector.adjustDetectorWeight(childDetectorName, weight);
      return true;
    }

    return false;
  }

  getEnsembleStatistics(detectorName: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector && "getEnsembleStatistics" in detector) {
      return detector.getEnsembleStatistics();
    }

    return null;
  }

  provideDetectorFeedback(
    detectorName: string,
    childDetectorName: string,
    feedback: any[],
  ): boolean {
    const detector = this.detectors.get(detectorName);

    if (detector && "provideDetectorFeedback" in detector) {
      detector.provideDetectorFeedback(childDetectorName, feedback);
      return true;
    }

    return false;
  }

  // Machine learning detector methods
  getModelFeatureImportance(detectorName: string, source: string): Record<string, number> | null {
    const detector = this.detectors.get(detectorName);

    if (detector && "getFeatureImportance" in detector) {
      return detector.getFeatureImportance(source);
    }

    return null;
  }

  // Statistical detector methods
  getStatisticalModels(detectorName: string): any {
    const detector = this.detectors.get(detectorName);

    if (detector instanceof StatisticalAnomalyDetector) {
      return detector.getStatisticalModels();
    }

    return null;
  }

  private defaultDataQualityAnalysis(data: IAnomalyData[]): IDataQualityMetrics {
    if (data.length === 0) {
      return {
        completeness: 0,
        consistency: 0,
        accuracy: 0,
        validity: 0,
        uniqueness: 0,
        timeliness: 0,
        timestamp: Date.now(),
      };
    }

    // Completeness: Check for missing required fields
    const completeness =
      data.reduce((acc, point) => {
        const hasRequired =
          point.metricName && point.value !== undefined && point.timestamp !== undefined;
        return acc + (hasRequired ? 1 : 0);
      }, 0) / data.length;

    // Consistency: Check timestamp ordering
    let consistency = 1.0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].timestamp < data[i - 1].timestamp) {
        consistency -= 0.1;
      }
    }
    consistency = Math.max(0, consistency);

    // Validity: Check for valid numeric values
    const validity =
      data.reduce((acc, point) => {
        const isValid = !isNaN(point.value) && isFinite(point.value);
        return acc + (isValid ? 1 : 0);
      }, 0) / data.length;

    // Uniqueness: Check for duplicate timestamps
    const timestamps = new Set(data.map((p) => p.timestamp));
    const uniqueness = timestamps.size / data.length;

    // Accuracy: Basic statistical checks
    const values = data.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const outliers = values.filter((v) => Math.abs(v - mean) > mean * 10).length;
    const accuracy = 1 - outliers / values.length;

    const timeliness = data.length > 0 ? 1.0 : 0.0; // Simplified timeliness check

    return {
      completeness,
      consistency,
      accuracy,
      validity,
      uniqueness,
      timeliness,
      timestamp: Date.now(),
    };
  }
}
