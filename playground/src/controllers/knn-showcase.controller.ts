import { Controller, Post, Body, Get, Inject, Logger } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiResponse, ApiBody } from "@nestjs/swagger";
import { DI_TOKENS } from "../../../src/core/di-tokens";
import { Shield } from "../../../src/decorators";
import type { IAnomalyData } from "../../../src/anomaly-detection/interfaces/anomaly.interface";
import type { IAnomalyDetector } from "../../../src/anomaly-detection/interfaces/detector.interface";

@ApiTags("KNN Anomaly Detection")
@Controller("knn")
export class KNNShowcaseController {
  private readonly logger = new Logger(KNNShowcaseController.name);

  constructor(
    @Inject(DI_TOKENS.DETECTOR_FACTORY)
    private readonly detectorFactory: any,
  ) {}

  @Get("demo/basic")
  @ApiOperation({ summary: "Basic KNN anomaly detection demo" })
  @ApiResponse({
    status: 200,
    description: "Demonstrates basic KNN anomaly detection with sample data",
  })
  async basicKNNDemo() {
    try {
      const detector = this.detectorFactory.create("knn");

      // Configure KNN detector
      detector.configure({
        k: 5,
        anomalyThreshold: 2.0,
        normalizeData: true,
        dynamicK: true,
        weightedVoting: true,
      });

      // Generate normal training data (sinusoidal pattern)
      const trainingData: IAnomalyData[] = Array.from({ length: 100 }, (_, i) => ({
        metricName: "api-response-time",
        value: 50 + Math.sin(i * 0.1) * 10 + Math.random() * 2, // 40-62 range with noise
        timestamp: Date.now() - (100 - i) * 60000, // Last 100 minutes
        source: "api-response-time",
      }));

      // Train the detector
      await detector.train(trainingData);

      // Test data with some anomalies
      const testData: IAnomalyData[] = [
        {
          metricName: "api-response-time",
          value: 51,
          timestamp: Date.now(),
          source: "api-response-time",
        }, // Normal
        {
          metricName: "api-response-time",
          value: 48,
          timestamp: Date.now() + 1000,
          source: "api-response-time",
        }, // Normal
        {
          metricName: "api-response-time",
          value: 85,
          timestamp: Date.now() + 2000,
          source: "api-response-time",
        }, // Anomaly!
        {
          metricName: "api-response-time",
          value: 52,
          timestamp: Date.now() + 3000,
          source: "api-response-time",
        }, // Normal
        {
          metricName: "api-response-time",
          value: 25,
          timestamp: Date.now() + 4000,
          source: "api-response-time",
        }, // Anomaly!
        {
          metricName: "api-response-time",
          value: 55,
          timestamp: Date.now() + 5000,
          source: "api-response-time",
        }, // Normal
      ];

      // Detect anomalies
      const anomalies = await detector.detect(testData);
      const stats = detector.getStatistics();

      return {
        message: "Basic KNN anomaly detection completed",
        detector: {
          name: detector.name,
          version: detector.version,
          trained: detector.isReady(),
          config: stats.config,
          effectiveK: stats.effectiveK,
        },
        training: {
          dataSize: stats.trainingDataSize,
          normalizationParams: stats.normalizationParams,
        },
        results: {
          totalTestPoints: testData.length,
          anomaliesDetected: anomalies.length,
          anomalies: anomalies.map((anomaly) => ({
            value: anomaly.data.value,
            score: Math.round(anomaly.score * 1000) / 1000,
            confidence: Math.round(anomaly.confidence * 1000) / 1000,
            severity: anomaly.severity,
            message: anomaly.message,
            timestamp: anomaly.timestamp,
          })),
        },
      };
    } catch (error) {
      this.logger.error("Error in basic KNN demo:", error);
      throw error;
    }
  }

  @Post("demo/advanced")
  @ApiOperation({ summary: "Advanced KNN configuration demo" })
  @ApiBody({
    description: "KNN configuration options",
    schema: {
      type: "object",
      properties: {
        k: { type: "number", example: 7 },
        distanceMetric: {
          type: "string",
          enum: ["euclidean", "manhattan", "cosine"],
          example: "manhattan",
        },
        anomalyThreshold: { type: "number", example: 1.5 },
        normalizeData: { type: "boolean", example: true },
        dynamicK: { type: "boolean", example: false },
        weightedVoting: { type: "boolean", example: true },
      },
    },
  })
  async advancedKNNDemo(@Body() config: any) {
    try {
      const detector = this.detectorFactory.create("knn");

      // Apply custom configuration
      detector.configure({
        k: config.k || 5,
        distanceMetric: config.distanceMetric || "euclidean",
        anomalyThreshold: config.anomalyThreshold || 2.0,
        normalizeData: config.normalizeData !== false,
        dynamicK: config.dynamicK !== false,
        weightedVoting: config.weightedVoting !== false,
      });

      // Generate more complex training data
      const trainingData: IAnomalyData[] = [];
      for (let i = 0; i < 200; i++) {
        // Multi-modal normal distribution
        const mode = i % 3;
        let value: number;

        if (mode === 0) {
          value = 30 + Math.random() * 10; // Mode 1: 30-40
        } else if (mode === 1) {
          value = 60 + Math.random() * 10; // Mode 2: 60-70
        } else {
          value = 90 + Math.random() * 10; // Mode 3: 90-100
        }

        trainingData.push({
          metricName: "cpu-usage",
          value,
          timestamp: Date.now() - (200 - i) * 30000, // Last 200 * 30s
          source: "cpu-usage",
        });
      }

      await detector.train(trainingData);

      // Test with various data points
      const testData: IAnomalyData[] = [
        { metricName: "test-metric", value: 35, timestamp: Date.now(), source: "cpu-usage" }, // Normal (mode 1)
        { metricName: "test-metric", value: 65, timestamp: Date.now() + 1000, source: "cpu-usage" }, // Normal (mode 2)
        { metricName: "test-metric", value: 95, timestamp: Date.now() + 2000, source: "cpu-usage" }, // Normal (mode 3)
        { metricName: "test-metric", value: 15, timestamp: Date.now() + 3000, source: "cpu-usage" }, // Anomaly (too low)
        { metricName: "test-metric", value: 45, timestamp: Date.now() + 4000, source: "cpu-usage" }, // Between modes
        {
          metricName: "test-metric",
          value: 120,
          timestamp: Date.now() + 5000,
          source: "cpu-usage",
        }, // Anomaly (too high)
        { metricName: "test-metric", value: 75, timestamp: Date.now() + 6000, source: "cpu-usage" }, // Between modes
      ];

      const anomalies = await detector.detect(testData);
      const stats = detector.getStatistics();

      return {
        message: "Advanced KNN anomaly detection completed",
        configuration: {
          applied: stats.config,
          effectiveK: stats.effectiveK,
        },
        training: {
          dataSize: stats.trainingDataSize,
          normalizationParams: stats.normalizationParams,
        },
        results: {
          testPoints: testData.map((point) => ({
            value: point.value,
            timestamp: point.timestamp,
          })),
          anomalies: anomalies.map((anomaly) => ({
            value: anomaly.data.value,
            score: Math.round(anomaly.score * 1000) / 1000,
            confidence: Math.round(anomaly.confidence * 1000) / 1000,
            severity: anomaly.severity,
          })),
          summary: {
            totalPoints: testData.length,
            anomaliesFound: anomalies.length,
            anomalyRate: Math.round((anomalies.length / testData.length) * 100 * 10) / 10,
          },
        },
      };
    } catch (error) {
      this.logger.error("Error in advanced KNN demo:", error);
      throw error;
    }
  }

  @Post("demo/realtime")
  @ApiOperation({ summary: "Real-time KNN anomaly detection with continuous learning" })
  @Shield({
    rateLimit: { points: 10, duration: 60 },
  })
  async realTimeKNNDemo(@Body() requestData: { metrics: number[] }) {
    try {
      const detector = this.detectorFactory.create("knn");

      // Initialize if not already trained
      if (!detector.isReady()) {
        // Generate baseline training data
        const baselineData: IAnomalyData[] = Array.from({ length: 100 }, (_, i) => ({
          metricName: "real-time-metrics",
          value: 100 + Math.sin(i * 0.2) * 20 + (Math.random() - 0.5) * 10,
          timestamp: Date.now() - (100 - i) * 60000,
          source: "real-time-metrics",
        }));

        await detector.train(baselineData);
      }

      // Process incoming metrics
      const currentTime = Date.now();
      const metricsData: IAnomalyData[] = requestData.metrics.map((value, index) => ({
        metricName: "real-time-metrics",
        value,
        timestamp: currentTime + index * 1000,
        source: "real-time-metrics",
      }));

      // Detect anomalies
      const anomalies = await detector.detect(metricsData);

      // Simulate continuous learning by adding normal data points
      const normalData = metricsData.filter(
        (point) => !anomalies.some((anomaly) => anomaly.data.value === point.value),
      );

      if (normalData.length > 0) {
        // Add normal data to training set for continuous learning
        await detector.detect(normalData); // This adds to training data
      }

      const stats = detector.getStatistics();

      return {
        message: "Real-time KNN processing completed",
        processing: {
          timestamp: currentTime,
          metricsProcessed: metricsData.length,
          trainingDataSize: stats.trainingDataSize,
        },
        detection: {
          anomaliesFound: anomalies.length,
          anomalies: anomalies.map((anomaly) => ({
            value: anomaly.data.value,
            score: Math.round(anomaly.score * 1000) / 1000,
            confidence: Math.round(anomaly.confidence * 1000) / 1000,
            severity: anomaly.severity,
            detectedAt: anomaly.timestamp,
          })),
        },
        continuousLearning: {
          normalDataAdded: normalData.length,
          currentTrainingSize: stats.trainingDataSize,
          detectorReady: detector.isReady(),
        },
      };
    } catch (error) {
      this.logger.error("Error in real-time KNN demo:", error);
      throw error;
    }
  }

  @Post("demo/performance")
  @ApiOperation({ summary: "KNN performance benchmark" })
  async performanceBenchmark(@Body() params: { dataSize?: number; testSize?: number }) {
    try {
      const dataSize = params.dataSize || 1000;
      const testSize = params.testSize || 100;

      const detector = this.detectorFactory.create("knn");
      detector.configure({
        k: Math.min(10, Math.floor(Math.sqrt(dataSize))),
        anomalyThreshold: 2.0,
        normalizeData: true,
        dynamicK: true,
      });

      // Generate large training dataset
      const trainingData: IAnomalyData[] = Array.from({ length: dataSize }, (_, i) => ({
        metricName: "performance-test",
        value: Math.random() * 100,
        timestamp: Date.now() - (dataSize - i) * 1000,
        source: "performance-test",
      }));

      // Measure training time
      const trainStart = process.hrtime.bigint();
      await detector.train(trainingData);
      const trainEnd = process.hrtime.bigint();
      const trainingTimeMs = Number(trainEnd - trainStart) / 1_000_000;

      // Generate test data
      const testData: IAnomalyData[] = Array.from({ length: testSize }, (_, i) => ({
        metricName: "performance-test",
        value: Math.random() * 150, // Some values outside training range
        timestamp: Date.now() + i * 1000,
        source: "performance-test",
      }));

      // Measure detection time
      const detectStart = process.hrtime.bigint();
      const anomalies = await detector.detect(testData);
      const detectEnd = process.hrtime.bigint();
      const detectionTimeMs = Number(detectEnd - detectStart) / 1_000_000;

      const stats = detector.getStatistics();

      return {
        message: "KNN performance benchmark completed",
        benchmark: {
          trainingDataSize: dataSize,
          testDataSize: testSize,
          effectiveK: stats.effectiveK,
        },
        performance: {
          trainingTimeMs: Math.round(trainingTimeMs * 100) / 100,
          detectionTimeMs: Math.round(detectionTimeMs * 100) / 100,
          averageDetectionTimePerPoint: Math.round((detectionTimeMs / testSize) * 100) / 100,
          throughputPointsPerSecond: Math.round((testSize / (detectionTimeMs / 1000)) * 100) / 100,
        },
        results: {
          anomaliesDetected: anomalies.length,
          anomalyRate: Math.round((anomalies.length / testSize) * 100 * 10) / 10,
        },
        memory: {
          trainingDataSize: stats.trainingDataSize,
          estimatedMemoryUsage: `${Math.round((stats.trainingDataSize * 32) / 1024)} KB`, // Rough estimate
        },
      };
    } catch (error) {
      this.logger.error("Error in performance benchmark:", error);
      throw error;
    }
  }

  @Get("demo/comparison")
  @ApiOperation({ summary: "Compare KNN with other anomaly detectors" })
  async detectorComparison() {
    try {
      // Create different detectors
      const knnDetector = this.detectorFactory.create("knn");
      const zscoreDetector = this.detectorFactory.create("zscore");
      const thresholdDetector = this.detectorFactory.create("threshold");

      // Configure detectors
      knnDetector.configure({
        k: 5,
        anomalyThreshold: 2.0,
        normalizeData: true,
      });

      zscoreDetector.configure({
        threshold: 2.5,
        windowSize: 50,
      });

      thresholdDetector.configure({
        upperThreshold: 80,
        lowerThreshold: 20,
      });

      // Common training data
      const trainingData: IAnomalyData[] = Array.from({ length: 100 }, (_, i) => ({
        metricName: "comparison-test",
        value: 50 + Math.sin(i * 0.1) * 15 + (Math.random() - 0.5) * 5,
        timestamp: Date.now() - (100 - i) * 60000,
        source: "comparison-test",
      }));

      // Train detectors that need training
      await knnDetector.train(trainingData);
      await zscoreDetector.train(trainingData);

      // Test data with known anomalies
      const testData: IAnomalyData[] = [
        { metricName: "test-metric", value: 52, timestamp: Date.now(), source: "comparison-test" }, // Normal
        {
          metricName: "test-metric",
          value: 90,
          timestamp: Date.now() + 1000,
          source: "comparison-test",
        }, // High anomaly
        {
          metricName: "test-metric",
          value: 48,
          timestamp: Date.now() + 2000,
          source: "comparison-test",
        }, // Normal
        {
          metricName: "test-metric",
          value: 10,
          timestamp: Date.now() + 3000,
          source: "comparison-test",
        }, // Low anomaly
        {
          metricName: "test-metric",
          value: 55,
          timestamp: Date.now() + 4000,
          source: "comparison-test",
        }, // Normal
      ];

      // Run detection on all detectors
      const knnAnomalies = await knnDetector.detect(testData);
      const zscoreAnomalies = await zscoreDetector.detect(testData);
      const thresholdAnomalies = await thresholdDetector.detect(testData);

      return {
        message: "Detector comparison completed",
        testData: testData.map((point) => ({
          value: point.value,
          timestamp: point.timestamp,
        })),
        results: {
          knn: {
            anomaliesDetected: knnAnomalies.length,
            anomalyValues: knnAnomalies.map((a) => a.data.value),
            avgConfidence:
              Math.round(
                (knnAnomalies.reduce((sum, a) => sum + a.confidence, 0) /
                  (knnAnomalies.length || 1)) *
                  100,
              ) / 100,
          },
          zscore: {
            anomaliesDetected: zscoreAnomalies.length,
            anomalyValues: zscoreAnomalies.map((a) => a.data.value),
            avgConfidence:
              Math.round(
                (zscoreAnomalies.reduce((sum, a) => sum + a.confidence, 0) /
                  (zscoreAnomalies.length || 1)) *
                  100,
              ) / 100,
          },
          threshold: {
            anomaliesDetected: thresholdAnomalies.length,
            anomalyValues: thresholdAnomalies.map((a) => a.data.value),
            avgConfidence:
              Math.round(
                (thresholdAnomalies.reduce((sum, a) => sum + a.confidence, 0) /
                  (thresholdAnomalies.length || 1)) *
                  100,
              ) / 100,
          },
        },
        analysis: {
          consensusAnomalies: this.findConsensusAnomalies([
            knnAnomalies,
            zscoreAnomalies,
            thresholdAnomalies,
          ]),
          uniqueDetections: {
            knnOnly: knnAnomalies
              .filter(
                (a) =>
                  !zscoreAnomalies.some((z) => z.data.value === a.data.value) &&
                  !thresholdAnomalies.some((t) => t.data.value === a.data.value),
              )
              .map((a) => a.data.value),
            zscoreOnly: zscoreAnomalies
              .filter(
                (a) =>
                  !knnAnomalies.some((k) => k.data.value === a.data.value) &&
                  !thresholdAnomalies.some((t) => t.data.value === a.data.value),
              )
              .map((a) => a.data.value),
            thresholdOnly: thresholdAnomalies
              .filter(
                (a) =>
                  !knnAnomalies.some((k) => k.data.value === a.data.value) &&
                  !zscoreAnomalies.some((z) => z.data.value === a.data.value),
              )
              .map((a) => a.data.value),
          },
        },
      };
    } catch (error) {
      this.logger.error("Error in detector comparison:", error);
      throw error;
    }
  }

  private findConsensusAnomalies(anomalyArrays: any[][]): number[] {
    const valueCount = new Map<number, number>();

    anomalyArrays.forEach((anomalies) => {
      anomalies.forEach((anomaly) => {
        const value = anomaly.data.value;
        valueCount.set(value, (valueCount.get(value) || 0) + 1);
      });
    });

    // Return values detected by at least 2 detectors
    return Array.from(valueCount.entries())
      .filter(([_, count]) => count >= 2)
      .map(([value, _]) => value);
  }
}
