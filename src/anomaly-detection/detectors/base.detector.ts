import { Injectable, Logger } from "@nestjs/common";
import {
  IAnomalyDetector,
  IDetectorConfig,
  IDetectorContext,
  IModelInfo,
} from "../interfaces/detector.interface";
import {
  IAnomalyData,
  IAnomaly,
  AnomalyType,
  AnomalySeverity,
} from "../interfaces/anomaly.interface";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export abstract class BaseAnomalyDetector implements IAnomalyDetector {
  protected readonly logger = new Logger(this.constructor.name);
  protected config: IDetectorConfig;
  protected ready: boolean = false;
  protected modelInfo: IModelInfo;

  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;

  constructor() {
    this.modelInfo = {
      algorithm: this.name,
      lastUpdated: Date.now(),
      version: this.version,
      parameters: {},
    };
  }

  configure(config: IDetectorConfig): void {
    this.config = {
      enabled: true,
      sensitivity: 0.5,
      threshold: 2.0,
      windowSize: 100,
      minDataPoints: 10,
      learningPeriod: 1000,
      ...config,
    };

    this.modelInfo.parameters = { ...this.config };
    this.logger.log(`Configured detector ${this.name} with sensitivity ${this.config.sensitivity}`);
  }

  abstract detect(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]>;

  async train(historicalData: IAnomalyData[]): Promise<void> {
    if (historicalData.length < this.config.minDataPoints) {
      throw new Error(
        `Insufficient training data: ${historicalData.length} < ${this.config.minDataPoints}`,
      );
    }

    this.logger.log(`Training ${this.name} with ${historicalData.length} data points`);
    await this.performTraining(historicalData);

    this.modelInfo.trainedAt = Date.now();
    this.modelInfo.trainingDataSize = historicalData.length;
    this.ready = true;

    this.logger.log(`Training completed for ${this.name}`);
  }

  protected abstract performTraining(data: IAnomalyData[]): Promise<void>;

  getModelInfo(): IModelInfo {
    return { ...this.modelInfo };
  }

  isReady(): boolean {
    return this.ready && this.config?.enabled;
  }

  reset(): void {
    this.ready = false;
    this.modelInfo.trainedAt = undefined;
    this.modelInfo.trainingDataSize = undefined;
    this.logger.log(`Reset detector ${this.name}`);
  }

  protected createAnomaly(
    data: IAnomalyData,
    type: AnomalyType,
    score: number,
    confidence: number,
    description: string,
    expectedValue?: number,
  ): IAnomaly {
    const severity = this.calculateSeverity(score, confidence);
    const deviation =
      expectedValue !== undefined ? Math.abs(data.value - expectedValue) : Math.abs(data.value);

    return {
      id: uuidv4(),
      type,
      severity,
      score: Math.min(Math.max(score, 0), 1),
      confidence: Math.min(Math.max(confidence, 0), 1),
      timestamp: data.timestamp,
      data,
      description,
      expectedValue,
      actualValue: data.value,
      deviation,
      context: {
        metric: data.source || "unknown",
        labels: data.labels,
        windowSize: this.config.windowSize,
        algorithm: this.name,
        threshold: this.config.threshold,
      },
      resolved: false,
    };
  }

  protected calculateSeverity(score: number, confidence: number): AnomalySeverity {
    const adjustedScore = score * confidence;

    if (adjustedScore >= 0.9) return AnomalySeverity.CRITICAL;
    if (adjustedScore >= 0.7) return AnomalySeverity.HIGH;
    if (adjustedScore >= 0.4) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  protected calculateStatistics(values: number[]): IStatistics {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
    };
  }

  protected calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return Math.abs(value - mean) / stdDev;
  }

  protected calculateModifiedZScore(value: number, values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const deviations = values.map((v) => Math.abs(v - median));
    const madSorted = deviations.sort((a, b) => a - b);
    const mad = madSorted[Math.floor(madSorted.length / 2)];

    if (mad === 0) return 0;
    return (0.6745 * Math.abs(value - median)) / mad;
  }

  protected isMaintenanceWindow(timestamp: number, context?: IDetectorContext): boolean {
    if (!context?.maintenanceWindows) return false;

    return context.maintenanceWindows.some(
      (window) => timestamp >= window.start && timestamp <= window.end,
    );
  }

  protected hasRecentDeployment(timestamp: number, context?: IDetectorContext): boolean {
    if (!context?.deployments) return false;

    const deploymentWindow = 30 * 60 * 1000; // 30 minutes
    return context.deployments.some(
      (deployment) =>
        Math.abs(timestamp - deployment.timestamp) <= deploymentWindow &&
        deployment.status === "completed",
    );
  }

  protected applyBusinessRules(anomaly: IAnomaly): IAnomaly {
    if (!this.config.businessRules) return anomaly;

    for (const rule of this.config.businessRules) {
      if (this.evaluateBusinessRule(rule.condition, anomaly)) {
        switch (rule.action) {
          case "suppress":
            // Mark as suppressed but don't return it
            return null;
          case "escalate":
            anomaly.severity = AnomalySeverity.CRITICAL;
            break;
          case "auto_resolve":
            anomaly.resolved = true;
            anomaly.resolvedAt = Date.now();
            break;
        }
      }
    }

    return anomaly;
  }

  private evaluateBusinessRule(condition: string, anomaly: IAnomaly): boolean {
    try {
      // Simple expression evaluator - in production, use a proper expression engine
      const context = {
        severity: anomaly.severity,
        score: anomaly.score,
        confidence: anomaly.confidence,
        type: anomaly.type,
        value: anomaly.actualValue,
        deviation: anomaly.deviation,
      };

      // Replace variables in condition
      let evaluableCondition = condition;
      Object.entries(context).forEach(([key, value]) => {
        evaluableCondition = evaluableCondition.replace(
          new RegExp(`\\b${key}\\b`, "g"),
          JSON.stringify(value),
        );
      });

      // Evaluate the condition (use a safe evaluator in production)
      return new Function("return " + evaluableCondition)();
    } catch (error) {
      this.logger.warn(`Failed to evaluate business rule: ${condition}`, error);
      return false;
    }
  }
}

interface IStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
}
