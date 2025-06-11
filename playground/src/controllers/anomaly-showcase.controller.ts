import { Controller, Get, Post, Body } from "@nestjs/common";
import { Shield, ShieldContext, Priority } from "@usex/nest-shield/decorators";
import { InjectAnomalyDetection } from "@usex/nest-shield/core";
import type { IProtectionContext, AnomalyDetectionService } from "@usex/nest-shield";

/**
 * Anomaly Detection Showcase Controller
 *
 * Demonstrates all anomaly detection capabilities using the new DI implementation.
 * Shows integration with all detector types and advanced features.
 */
@Controller("anomaly-showcase")
export class AnomalyShowcaseController {
  constructor(
    @InjectAnomalyDetection()
    private readonly anomalyDetectionService: AnomalyDetectionService,
  ) {}

  @Get("detectors-overview")
  @Priority(8)
  async getDetectorsOverview() {
    return {
      message: "Comprehensive anomaly detection overview",
      diImplementation: {
        anomalyDetectionDecorator: "@InjectAnomalyDetection()",
        performanceMonitorDecorator: "@InjectPerformanceMonitor()",
        dataCollectorDecorator: "@InjectDataCollector()",
        alertingDecorator: "@InjectAlerting()",
        detectorManagementDecorator: "@InjectDetectorManagement()",
      },
      injectedServices: {
        anomalyDetection: !!this.anomalyDetectionService,
        performanceMonitor: false, // Not injected in this showcase
        dataCollector: false, // Not injected in this showcase
        alerting: false, // Not injected in this showcase
        detectorManagement: false, // Not injected in this showcase
      },
      availableDetectors: [
        {
          name: "Z-Score Detector",
          decorator: "@InjectZScoreDetector()",
          description: "Statistical outlier detection using z-scores",
          useCase: "Simple threshold-based anomalies",
          complexity: "Low",
          accuracy: "Medium",
          performance: "High",
        },
        {
          name: "Threshold Detector",
          decorator: "@InjectThresholdDetector()",
          description: "Static and dynamic threshold monitoring",
          useCase: "Known limit violations",
          complexity: "Low",
          accuracy: "Medium",
          performance: "Very High",
        },
        {
          name: "Statistical Detector",
          decorator: "@InjectStatisticalDetector()",
          description: "Advanced statistical methods (IQR, modified z-score)",
          useCase: "Comprehensive statistical analysis",
          complexity: "Medium",
          accuracy: "High",
          performance: "Medium",
        },
        {
          name: "Seasonal Detector",
          decorator: "@InjectSeasonalDetector()",
          description: "Time-series pattern analysis",
          useCase: "Detecting deviations from expected patterns",
          complexity: "High",
          accuracy: "High",
          performance: "Medium",
        },
        {
          name: "Machine Learning Detector",
          decorator: "@InjectMachineLearningDetector()",
          description: "Deep learning and neural networks",
          useCase: "Complex pattern recognition",
          complexity: "Very High",
          accuracy: "Very High",
          performance: "Low",
        },
        {
          name: "Isolation Forest Detector",
          decorator: "@InjectIsolationForestDetector()",
          description: "Machine learning-based anomaly detection",
          useCase: "Complex multi-dimensional anomalies",
          complexity: "High",
          accuracy: "Very High",
          performance: "Medium",
        },
        {
          name: "Composite Detector",
          decorator: "@InjectCompositeDetector()",
          description: "Combines multiple detection methods",
          useCase: "Comprehensive anomaly coverage",
          complexity: "Very High",
          accuracy: "Exceptional",
          performance: "Low",
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Post("zscore-detection")
  @Shield({
    rateLimit: { points: 20, duration: 60 },
  })
  async zscoreDetection(
    @Body() body: { values: number[]; threshold?: number; windowSize?: number },
  ) {
    const { values, threshold = 2.5, windowSize = 50 } = body;

    // Simulate Z-Score detection via DI injection
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const detectionResults = values.map((value, index) => {
      const zScore = Math.abs(value - mean) / stdDev;
      return {
        index,
        value,
        zScore: parseFloat(zScore.toFixed(4)),
        isAnomaly: zScore > threshold,
        severity: zScore > threshold * 1.5 ? "high" : zScore > threshold ? "medium" : "low",
      };
    });

    const anomalies = detectionResults.filter((r) => r.isAnomaly);

    return {
      message: "Z-Score anomaly detection via DI injection",
      detectorType: "zscore",
      detectorDecorator: "@InjectZScoreDetector()",
      serviceInjected: !!this.anomalyDetectionService,
      configuration: {
        threshold,
        windowSize,
        method: "z-score",
      },
      statistics: {
        mean: parseFloat(mean.toFixed(4)),
        standardDeviation: parseFloat(stdDev.toFixed(4)),
        variance: parseFloat(variance.toFixed(4)),
        totalValues: values.length,
        anomaliesFound: anomalies.length,
        anomalyRate: parseFloat(((anomalies.length / values.length) * 100).toFixed(2)),
      },
      results: detectionResults,
      anomalies,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("threshold-detection")
  async thresholdDetection(
    @Body()
    body: {
      values: number[];
      upperThreshold?: number;
      lowerThreshold?: number;
      adaptive?: boolean;
    },
  ) {
    const { values, upperThreshold = 100, lowerThreshold = 0, adaptive = false } = body;

    let actualUpperThreshold = upperThreshold;
    let actualLowerThreshold = lowerThreshold;

    if (adaptive) {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length,
      );
      actualUpperThreshold = mean + 2 * stdDev;
      actualLowerThreshold = mean - 2 * stdDev;
    }

    const detectionResults = values.map((value, index) => {
      const exceedsUpper = value > actualUpperThreshold;
      const exceedsLower = value < actualLowerThreshold;
      const isAnomaly = exceedsUpper || exceedsLower;

      return {
        index,
        value,
        isAnomaly,
        violationType: exceedsUpper ? "upper" : exceedsLower ? "lower" : null,
        thresholds: {
          upper: actualUpperThreshold,
          lower: actualLowerThreshold,
        },
        severity:
          Math.abs(value - (actualUpperThreshold + actualLowerThreshold) / 2) > 50
            ? "high"
            : "medium",
      };
    });

    const anomalies = detectionResults.filter((r) => r.isAnomaly);

    return {
      message: "Threshold anomaly detection via DI injection",
      detectorType: "threshold",
      detectorDecorator: "@InjectThresholdDetector()",
      serviceInjected: !!this.anomalyDetectionService,
      configuration: {
        upperThreshold: actualUpperThreshold,
        lowerThreshold: actualLowerThreshold,
        adaptive,
        method: "threshold",
      },
      statistics: {
        totalValues: values.length,
        anomaliesFound: anomalies.length,
        upperViolations: anomalies.filter((a) => a.violationType === "upper").length,
        lowerViolations: anomalies.filter((a) => a.violationType === "lower").length,
        anomalyRate: parseFloat(((anomalies.length / values.length) * 100).toFixed(2)),
      },
      results: detectionResults,
      anomalies,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("isolation-forest-detection")
  async isolationForestDetection(
    @Body()
    body: {
      dataPoints: Array<{ features: number[]; timestamp?: number }>;
      contamination?: number;
      nTrees?: number;
    },
  ) {
    const { dataPoints, contamination = 0.1, nTrees = 100 } = body;

    // Simulate Isolation Forest detection
    const detectionResults = dataPoints.map((point, index) => {
      // Simulate anomaly score (0-1, higher = more anomalous)
      const anomalyScore = Math.random();
      const isAnomaly = anomalyScore > 1 - contamination;

      return {
        index,
        features: point.features,
        anomalyScore: parseFloat(anomalyScore.toFixed(4)),
        isAnomaly,
        confidence: parseFloat((anomalyScore * 100).toFixed(2)),
        isolationPath: Math.floor(Math.random() * 20) + 5, // Simulated path length
        timestamp: point.timestamp || Date.now() - (dataPoints.length - index) * 1000,
      };
    });

    const anomalies = detectionResults.filter((r) => r.isAnomaly);

    return {
      message: "Isolation Forest anomaly detection via DI injection",
      detectorType: "isolation-forest",
      detectorDecorator: "@InjectIsolationForestDetector()",
      serviceInjected: !!this.anomalyDetectionService,
      configuration: {
        contamination,
        nTrees,
        method: "isolation-forest",
        features: dataPoints[0]?.features.length || 0,
      },
      statistics: {
        totalDataPoints: dataPoints.length,
        anomaliesFound: anomalies.length,
        averageAnomalyScore: parseFloat(
          (
            detectionResults.reduce((sum, r) => sum + r.anomalyScore, 0) / detectionResults.length
          ).toFixed(4),
        ),
        highConfidenceAnomalies: anomalies.filter((a) => a.confidence > 80).length,
        anomalyRate: parseFloat(((anomalies.length / dataPoints.length) * 100).toFixed(2)),
      },
      results: detectionResults,
      anomalies,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("seasonal-detection")
  async seasonalDetection(
    @Body()
    body: {
      timeSeries: Array<{ value: number; timestamp: number }>;
      seasonality?: number;
      trendAnalysis?: boolean;
    },
  ) {
    const { timeSeries, seasonality = 24, trendAnalysis = true } = body;

    // Simulate seasonal anomaly detection
    const detectionResults = timeSeries.map((point, index) => {
      const hour = new Date(point.timestamp).getHours();
      const expectedValue = 50 + 30 * Math.sin((hour / 24) * 2 * Math.PI); // Simulated seasonal pattern
      const deviation = Math.abs(point.value - expectedValue);
      const isAnomaly = deviation > 25; // Threshold for seasonal deviation

      return {
        index,
        timestamp: point.timestamp,
        actualValue: point.value,
        expectedValue: parseFloat(expectedValue.toFixed(2)),
        deviation: parseFloat(deviation.toFixed(2)),
        isAnomaly,
        seasonalIndex: hour,
        confidence: Math.min(100, deviation * 2),
        trendDirection:
          index > 0 ? (point.value > timeSeries[index - 1].value ? "up" : "down") : "neutral",
      };
    });

    const anomalies = detectionResults.filter((r) => r.isAnomaly);

    return {
      message: "Seasonal anomaly detection via DI injection",
      detectorType: "seasonal",
      detectorDecorator: "@InjectSeasonalDetector()",
      serviceInjected: !!this.anomalyDetectionService,
      configuration: {
        seasonality,
        trendAnalysis,
        method: "seasonal",
        timeRange: `${new Date(timeSeries[0]?.timestamp).toISOString()} - ${new Date(timeSeries[timeSeries.length - 1]?.timestamp).toISOString()}`,
      },
      statistics: {
        totalDataPoints: timeSeries.length,
        anomaliesFound: anomalies.length,
        averageDeviation: parseFloat(
          (
            detectionResults.reduce((sum, r) => sum + r.deviation, 0) / detectionResults.length
          ).toFixed(2),
        ),
        seasonalPattern: "Simulated daily pattern with peak at midday",
        anomalyRate: parseFloat(((anomalies.length / timeSeries.length) * 100).toFixed(2)),
      },
      results: detectionResults,
      anomalies,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("composite-detection")
  @Priority(9) // High priority for comprehensive analysis
  async compositeDetection(
    @Body()
    body: {
      values: number[];
      enabledDetectors: string[];
      votingStrategy?: "majority" | "unanimous" | "weighted";
    },
  ) {
    const { values, enabledDetectors, votingStrategy = "majority" } = body;

    // Simulate composite detection using multiple detectors
    const detectorResults = {
      zscore: enabledDetectors.includes("zscore") ? this.simulateZScoreDetection(values) : null,
      threshold: enabledDetectors.includes("threshold")
        ? this.simulateThresholdDetection(values)
        : null,
      statistical: enabledDetectors.includes("statistical")
        ? this.simulateStatisticalDetection(values)
        : null,
      isolationForest: enabledDetectors.includes("isolation-forest")
        ? this.simulateIsolationForestDetection(values)
        : null,
    };

    const compositeResults = values.map((value, index) => {
      const detectorVotes: Array<{ detector: string; vote: boolean; weight: number }> = [];
      let weightedScore = 0;
      let totalWeight = 0;

      if (detectorResults.zscore) {
        const vote = detectorResults.zscore[index]?.isAnomaly || false;
        detectorVotes.push({ detector: "zscore", vote, weight: 1 });
        weightedScore += vote ? 1 : 0;
        totalWeight += 1;
      }

      if (detectorResults.threshold) {
        const vote = detectorResults.threshold[index]?.isAnomaly || false;
        detectorVotes.push({ detector: "threshold", vote, weight: 1.2 });
        weightedScore += vote ? 1.2 : 0;
        totalWeight += 1.2;
      }

      if (detectorResults.statistical) {
        const vote = detectorResults.statistical[index]?.isAnomaly || false;
        detectorVotes.push({ detector: "statistical", vote, weight: 1.5 });
        weightedScore += vote ? 1.5 : 0;
        totalWeight += 1.5;
      }

      if (detectorResults.isolationForest) {
        const vote = detectorResults.isolationForest[index]?.isAnomaly || false;
        detectorVotes.push({ detector: "isolation-forest", vote, weight: 2 });
        weightedScore += vote ? 2 : 0;
        totalWeight += 2;
      }

      const positiveVotes = detectorVotes.filter((v) => v.vote).length;
      const totalVotes = detectorVotes.length;

      let isAnomaly = false;
      switch (votingStrategy) {
        case "majority":
          isAnomaly = positiveVotes > totalVotes / 2;
          break;
        case "unanimous":
          isAnomaly = positiveVotes === totalVotes && totalVotes > 0;
          break;
        case "weighted":
          isAnomaly = weightedScore / totalWeight > 0.5;
          break;
      }

      return {
        index,
        value,
        detectorVotes,
        positiveVotes,
        totalVotes,
        weightedScore: parseFloat((weightedScore / totalWeight).toFixed(4)),
        isAnomaly,
        confidence: parseFloat(((positiveVotes / totalVotes) * 100).toFixed(2)),
      };
    });

    const anomalies = compositeResults.filter((r) => r.isAnomaly);

    return {
      message: "Composite anomaly detection via DI injection",
      detectorType: "composite",
      detectorDecorator: "@InjectCompositeDetector()",
      serviceInjected: !!this.anomalyDetectionService,
      configuration: {
        enabledDetectors,
        votingStrategy,
        method: "composite",
        totalDetectors: enabledDetectors.length,
      },
      detectorResults: Object.keys(detectorResults).reduce((acc, key) => {
        if (detectorResults[key]) {
          acc[key] = {
            anomaliesFound: detectorResults[key].filter((r) => r.isAnomaly).length,
            active: true,
          };
        }
        return acc;
      }, {}),
      statistics: {
        totalValues: values.length,
        anomaliesFound: anomalies.length,
        averageConfidence: parseFloat(
          (
            compositeResults.reduce((sum, r) => sum + r.confidence, 0) / compositeResults.length
          ).toFixed(2),
        ),
        highConfidenceAnomalies: anomalies.filter((a) => a.confidence > 75).length,
        anomalyRate: parseFloat(((anomalies.length / values.length) * 100).toFixed(2)),
      },
      results: compositeResults,
      anomalies,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("performance-monitoring")
  async getPerformanceMonitoring(@ShieldContext() context: IProtectionContext) {
    const performanceMetrics = {
      detectionLatency: {
        zscore: Math.random() * 5 + 1,
        threshold: Math.random() * 2 + 0.5,
        statistical: Math.random() * 10 + 5,
        seasonal: Math.random() * 20 + 10,
        isolationForest: Math.random() * 50 + 25,
        machineLearning: Math.random() * 100 + 50,
        composite: Math.random() * 150 + 75,
      },
      memoryUsage: {
        zscore: Math.random() * 10 + 5,
        threshold: Math.random() * 5 + 2,
        statistical: Math.random() * 20 + 10,
        seasonal: Math.random() * 30 + 15,
        isolationForest: Math.random() * 100 + 50,
        machineLearning: Math.random() * 200 + 100,
        composite: Math.random() * 300 + 150,
      },
      accuracy: {
        zscore: 75 + Math.random() * 15,
        threshold: 70 + Math.random() * 20,
        statistical: 80 + Math.random() * 15,
        seasonal: 85 + Math.random() * 10,
        isolationForest: 90 + Math.random() * 8,
        machineLearning: 95 + Math.random() * 5,
        composite: 97 + Math.random() * 3,
      },
    };

    return {
      message: "Anomaly detection performance monitoring",
      performanceMonitorDecorator: "@InjectPerformanceMonitor()",
      serviceInjected: false, // Not injected in this showcase
      requestContext: {
        id: "mock-request-id",
        method: context.method,
        userAgent: context.userAgent?.substring(0, 50),
      },
      metrics: performanceMetrics,
      recommendations: [
        "Use Z-Score for simple, fast detection",
        "Use Threshold for known limits",
        "Use Isolation Forest for complex patterns",
        "Use Composite for highest accuracy",
        "Consider Seasonal for time-based patterns",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("alerting-configuration")
  async getAlertingConfiguration() {
    const alertingConfig = {
      channels: [
        { name: "webhook", enabled: true, url: "https://api.example.com/alerts" },
        { name: "email", enabled: true, recipients: ["admin@example.com"] },
        { name: "slack", enabled: false, channel: "#alerts" },
        { name: "sms", enabled: false, numbers: ["+1234567890"] },
      ],
      thresholds: {
        anomalyRate: { warning: 5, critical: 15 },
        confidence: { minimum: 70, high: 90 },
        detectionLatency: { warning: 1000, critical: 5000 },
      },
      alertTypes: [
        { type: "anomaly_detected", severity: "high", frequency: "immediate" },
        { type: "detection_failure", severity: "critical", frequency: "immediate" },
        { type: "performance_degradation", severity: "medium", frequency: "batched" },
        { type: "threshold_breach", severity: "high", frequency: "immediate" },
      ],
      recentAlerts: [
        {
          id: "alert_001",
          type: "anomaly_detected",
          message: "High anomaly rate detected in response_time metric",
          severity: "high",
          timestamp: new Date(Date.now() - 300000).toISOString(),
          resolved: false,
        },
        {
          id: "alert_002",
          type: "threshold_breach",
          message: "CPU usage exceeded 90% threshold",
          severity: "critical",
          timestamp: new Date(Date.now() - 600000).toISOString(),
          resolved: true,
        },
      ],
    };

    return {
      message: "Anomaly detection alerting configuration",
      alertingDecorator: "@InjectAlerting()",
      serviceInjected: false, // Not injected in this showcase
      configuration: alertingConfig,
      features: [
        "Multi-channel alerting",
        "Configurable thresholds",
        "Alert batching and throttling",
        "Severity-based routing",
        "Alert resolution tracking",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods for composite detection simulation
  private simulateZScoreDetection(values: number[]) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length,
    );
    return values.map((value) => ({ isAnomaly: Math.abs(value - mean) / stdDev > 2 }));
  }

  private simulateThresholdDetection(values: number[]) {
    return values.map((value) => ({ isAnomaly: value > 100 || value < 0 }));
  }

  private simulateStatisticalDetection(values: number[]) {
    return values.map(() => ({ isAnomaly: Math.random() > 0.85 }));
  }

  private simulateIsolationForestDetection(values: number[]) {
    return values.map(() => ({ isAnomaly: Math.random() > 0.9 }));
  }
}
