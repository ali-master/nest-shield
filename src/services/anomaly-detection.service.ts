import { Injectable, Logger } from "@nestjs/common";
import {
  IAnomalyData,
  IAnomaly,
  AnomalySeverity,
} from "../anomaly-detection/interfaces/anomaly.interface";
import {
  IDetectorContext,
  BusinessRuleAction,
} from "../anomaly-detection/interfaces/detector.interface";
import { IAnalysisResult } from "../anomaly-detection/interfaces/analyzer.interface";
import { IAnomalyAlert } from "../anomaly-detection/interfaces/alert.interface";
import { IAnomalyDetectionConfig } from "../interfaces/shield-config.interface";

// Import all detectors
import {
  BaseAnomalyDetector,
  ZScoreDetector,
  IsolationForestDetector,
  SeasonalAnomalyDetector,
  ThresholdAnomalyDetector,
  StatisticalAnomalyDetector,
  MachineLearningDetector,
  CompositeAnomalyDetector,
} from "../anomaly-detection/detectors";

import { IMetricsCollector } from "../interfaces/shield-config.interface";

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private detectors: Map<string, BaseAnomalyDetector> = new Map();
  private activeDetector: BaseAnomalyDetector | null = null;
  private isInitialized = false;
  private historicalData: Map<string, IAnomalyData[]> = new Map();
  private recentAnomalies: IAnomaly[] = [];
  private readonly maxHistoricalData = 10000;
  private readonly maxRecentAnomalies = 1000;

  constructor() {
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
      new CompositeAnomalyDetector(),
    ];

    detectorInstances.forEach((detector) => {
      this.detectors.set(detector.name, detector);
    });

    // Default to composite detector for best overall performance
    this.activeDetector = this.detectors.get("Composite Anomaly Detector") || null;

    this.logger.log(`Initialized ${this.detectors.size} anomaly detectors`);
  }

  async initialize(config: IAnomalyDetectionConfig): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("Anomaly detection service already initialized");
      return;
    }

    try {
      // Set active detector based on configuration
      if (config.detectorType && this.detectors.has(config.detectorType)) {
        this.activeDetector = this.detectors.get(config.detectorType)!;
      }

      if (!this.activeDetector) {
        throw new Error("No active detector configured");
      }

      // Configure the active detector
      this.activeDetector.configure({
        enabled: config.enabled ?? true,
        sensitivity: config.sensitivity ?? 0.5,
        threshold: typeof config.threshold === "number" ? config.threshold : 2.0,
        windowSize: config.windowSize ?? 100,
        minDataPoints: config.minDataPoints ?? 20,
        learningPeriod: config.learningPeriod ?? 1000,
        businessRules: config.businessRules?.map((rule) => ({
          name: rule.name,
          condition: rule.condition,
          action:
            rule.action === "suppress"
              ? BusinessRuleAction.SUPPRESS
              : rule.action === "escalate"
                ? BusinessRuleAction.ESCALATE
                : rule.action === "auto_resolve"
                  ? BusinessRuleAction.AUTO_RESOLVE
                  : BusinessRuleAction.ALERT,
          severity: "medium",
          message: rule.description,
        })),
      });

      // Train detector if historical data is provided
      // TODO: Add historicalData to IAnomalyDetectionConfig if needed
      // if (config.historicalData && config.historicalData.length > 0) {
      //   await this.trainDetector(config.historicalData);
      // }

      this.isInitialized = true;
      this.logger.log(`Anomaly detection service initialized with ${this.activeDetector.name}`);
    } catch (error) {
      this.logger.error("Failed to initialize anomaly detection service:", error);
      throw error;
    }
  }

  async detectAnomalies(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isInitialized || !this.activeDetector) {
      this.logger.warn("Anomaly detection service not initialized");
      return [];
    }

    try {
      // Store historical data for future training
      this.storeHistoricalData(data);

      // Detect anomalies using the active detector
      const anomalies = await this.activeDetector.detect(data, context);

      // Store recent anomalies
      this.storeRecentAnomalies(anomalies);

      // Log detection results
      if (anomalies.length > 0) {
        this.logger.log(`Detected ${anomalies.length} anomalies using ${this.activeDetector.name}`);
      }

      return anomalies;
    } catch (error) {
      this.logger.error("Error detecting anomalies:", error);
      return [];
    }
  }

  async detectSingleDataPoint(
    dataPoint: IAnomalyData,
    context?: IDetectorContext,
  ): Promise<IAnomaly | null> {
    const anomalies = await this.detectAnomalies([dataPoint], context);
    return anomalies.length > 0 ? anomalies[0] : null;
  }

  async trainDetector(historicalData: IAnomalyData[]): Promise<void> {
    if (!this.activeDetector) {
      throw new Error("No active detector to train");
    }

    try {
      this.logger.log(
        `Training ${this.activeDetector.name} with ${historicalData.length} data points`,
      );
      await this.activeDetector.train(historicalData);
      this.logger.log("Detector training completed successfully");
    } catch (error) {
      this.logger.error("Error training detector:", error);
      throw error;
    }
  }

  switchDetector(detectorName: string): boolean {
    if (!this.detectors.has(detectorName)) {
      this.logger.warn(`Detector ${detectorName} not found`);
      return false;
    }

    const newDetector = this.detectors.get(detectorName)!;

    // Transfer configuration from current detector if possible
    if (this.activeDetector) {
      const currentConfig = this.activeDetector.getModelInfo();
      if (currentConfig && currentConfig.parameters) {
        // Ensure parameters match IDetectorConfig
        const detectorConfig: any = {
          enabled: currentConfig.parameters.enabled ?? true,
          sensitivity: currentConfig.parameters.sensitivity ?? 0.5,
          threshold: currentConfig.parameters.threshold ?? 2.0,
          windowSize: currentConfig.parameters.windowSize ?? 100,
          minDataPoints: currentConfig.parameters.minDataPoints ?? 20,
          ...currentConfig.parameters,
        };
        newDetector.configure(detectorConfig);
      }
    }

    this.activeDetector = newDetector;
    this.logger.log(`Switched to detector: ${detectorName}`);
    return true;
  }

  getAvailableDetectors(): string[] {
    return Array.from(this.detectors.keys());
  }

  getActiveDetectorName(): string | null {
    return this.activeDetector?.name || null;
  }

  getDetectorInfo(detectorName?: string): any {
    const detector = detectorName ? this.detectors.get(detectorName) : this.activeDetector;

    if (!detector) {
      return null;
    }

    return {
      name: detector.name,
      version: detector.version,
      description: detector.description,
      isReady: detector.isReady(),
      modelInfo: detector.getModelInfo(),
    };
  }

  getRecentAnomalies(limit: number = 100): IAnomaly[] {
    return this.recentAnomalies.slice(-limit);
  }

  getHistoricalData(source?: string, limit: number = 1000): IAnomalyData[] {
    if (source) {
      const sourceData = this.historicalData.get(source) || [];
      return sourceData.slice(-limit);
    }

    // Combine all historical data
    const allData: IAnomalyData[] = [];
    this.historicalData.forEach((data) => {
      allData.push(...data);
    });

    // Sort by timestamp and return recent data
    return allData.sort((a, b) => a.timestamp - b.timestamp).slice(-limit);
  }

  getAnomalyStatistics(): IAnomalyStatistics {
    const total = this.recentAnomalies.length;

    if (total === 0) {
      return {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byType: { spike: 0, drop: 0, outlier: 0, trend: 0 },
        averageConfidence: 0,
        detectionRate: 0,
        lastDetection: null,
      };
    }

    // Calculate statistics
    const bySeverity = this.recentAnomalies.reduce(
      (acc, anomaly) => {
        acc[anomaly.severity.toLowerCase() as keyof typeof acc]++;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 },
    );

    const byType = this.recentAnomalies.reduce(
      (acc, anomaly) => {
        acc[anomaly.type.toLowerCase() as keyof typeof acc]++;
        return acc;
      },
      { spike: 0, drop: 0, outlier: 0, trend: 0 },
    );

    const averageConfidence =
      this.recentAnomalies.reduce((sum, anomaly) => sum + anomaly.confidence, 0) / total;

    const totalDataPoints = Array.from(this.historicalData.values()).reduce(
      (sum, data) => sum + data.length,
      0,
    );

    const detectionRate = totalDataPoints > 0 ? total / totalDataPoints : 0;

    const lastDetection =
      this.recentAnomalies.length > 0
        ? Math.max(...this.recentAnomalies.map((a) => a.timestamp))
        : null;

    return {
      total,
      bySeverity,
      byType,
      averageConfidence,
      detectionRate,
      lastDetection,
    };
  }

  async analyzeAnomalies(): Promise<IAnalysisResult | null> {
    if (this.recentAnomalies.length === 0) {
      return null;
    }

    // Simplified analysis - in production, use dedicated analyzer
    const summary = {
      totalAnomalies: this.recentAnomalies.length,
      criticalAnomalies: this.recentAnomalies.filter((a) => a.severity === AnomalySeverity.CRITICAL)
        .length,
      highSeverityAnomalies: this.recentAnomalies.filter((a) => a.severity === AnomalySeverity.HIGH)
        .length,
      mediumSeverityAnomalies: this.recentAnomalies.filter(
        (a) => a.severity === AnomalySeverity.MEDIUM,
      ).length,
      lowSeverityAnomalies: this.recentAnomalies.filter((a) => a.severity === AnomalySeverity.LOW)
        .length,
      affectedServices: [
        ...new Set(this.recentAnomalies.map((a) => a.context?.metric || "unknown")),
      ],
      timeRange: {
        start: Math.min(...this.recentAnomalies.map((a) => a.timestamp)),
        end: Math.max(...this.recentAnomalies.map((a) => a.timestamp)),
      },
      overallSeverity: this.calculateOverallSeverity(),
    };

    return {
      summary,
      patterns: [],
      correlations: [],
      timeSeriesAnalysis: {} as any,
      recommendations: [],
      confidence: 0.8,
      analysisTimestamp: Date.now(),
    };
  }

  resetDetector(): void {
    if (this.activeDetector) {
      this.activeDetector.reset();
      this.logger.log(`Reset detector: ${this.activeDetector.name}`);
    }
  }

  clearHistory(): void {
    this.historicalData.clear();
    this.recentAnomalies = [];
    this.logger.log("Cleared anomaly detection history");
  }

  // Integration with metrics system
  integrateWithMetrics(metricsCollector: IMetricsCollector): void {
    // This method can be used to integrate with the metrics system
    // for automatic anomaly detection on collected metrics
    this.logger.log("Integrated anomaly detection with metrics collector");
  }

  private storeHistoricalData(data: IAnomalyData[]): void {
    data.forEach((dataPoint) => {
      const source = dataPoint.source || "default";

      if (!this.historicalData.has(source)) {
        this.historicalData.set(source, []);
      }

      const sourceData = this.historicalData.get(source)!;
      sourceData.push(dataPoint);

      // Maintain maximum size
      if (sourceData.length > this.maxHistoricalData) {
        sourceData.splice(0, sourceData.length - this.maxHistoricalData);
      }
    });
  }

  private storeRecentAnomalies(anomalies: IAnomaly[]): void {
    this.recentAnomalies.push(...anomalies);

    // Maintain maximum size
    if (this.recentAnomalies.length > this.maxRecentAnomalies) {
      this.recentAnomalies.splice(0, this.recentAnomalies.length - this.maxRecentAnomalies);
    }
  }

  private calculateOverallSeverity(): string {
    if (this.recentAnomalies.length === 0) return "NONE";

    const severityCounts = this.recentAnomalies.reduce(
      (acc, anomaly) => {
        acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    if (severityCounts["CRITICAL"] > 0) return "CRITICAL";
    if (severityCounts["HIGH"] > 0) return "HIGH";
    if (severityCounts["MEDIUM"] > 0) return "MEDIUM";
    return "LOW";
  }
}

// Interfaces for the service

export interface IAnomalyStatistics {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: {
    spike: number;
    drop: number;
    outlier: number;
    trend: number;
  };
  averageConfidence: number;
  detectionRate: number;
  lastDetection: number | null;
}
