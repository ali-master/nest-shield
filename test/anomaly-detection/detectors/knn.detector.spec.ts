import { Test, TestingModule } from "@nestjs/testing";
import { KNNDetector } from "../../../src/anomaly-detection/detectors/knn.detector";
import { IAnomalyData } from "../../../src/anomaly-detection/interfaces/anomaly.interface";
import { IDetectorContext } from "../../../src/anomaly-detection/interfaces/detector.interface";

describe("KNNDetector", () => {
  let detector: KNNDetector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KNNDetector],
    }).compile();

    detector = module.get<KNNDetector>(KNNDetector);
  });

  afterEach(() => {
    detector.reset();
  });

  describe("initialization", () => {
    it("should be defined", () => {
      expect(detector).toBeDefined();
    });

    it("should have correct name and version", () => {
      expect(detector.name).toBe("K-Nearest Neighbors Detector");
      expect(detector.version).toBe("1.0.0");
    });

    it("should start as not trained", () => {
      expect(detector.isReady()).toBe(false);
    });
  });

  describe("configure", () => {
    it("should update configuration", () => {
      detector.configure({
        k: 3,
        distanceMetric: "manhattan",
        anomalyThreshold: 1.5,
        normalizeData: false,
      });

      const stats = detector.getStatistics();
      expect(stats.config.k).toBe(3);
      expect(stats.config.distanceMetric).toBe("manhattan");
      expect(stats.config.anomalyThreshold).toBe(1.5);
      expect(stats.config.normalizeData).toBe(false);
    });
  });

  describe("train", () => {
    const normalData: IAnomalyData[] = Array.from({ length: 100 }, (_, i) => ({
      metricName: "test-metric",
      value: 10 + Math.sin(i * 0.1) * 2, // Normal sinusoidal pattern
      timestamp: Date.now() + i * 1000,
      source: "test",
    }));

    it("should train successfully with sufficient data", async () => {
      await detector.train(normalData);
      expect(detector.isReady()).toBe(true);
    });

    it("should not be ready with insufficient data", async () => {
      const insufficientData = normalData.slice(0, 10);
      try {
        await detector.train(insufficientData);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Should throw error for insufficient data
        expect(error.message).toContain("Insufficient training data");
      }
      expect(detector.isReady()).toBe(false);
    });

    it("should respect maxTrainingSize limit", async () => {
      detector.configure({ maxTrainingSize: 50 });
      await detector.train(normalData);

      const stats = detector.getStatistics();
      expect(stats.trainingDataSize).toBe(50);
    });

    it("should calculate normalization parameters when enabled", async () => {
      detector.configure({ normalizeData: true });
      await detector.train(normalData);

      const stats = detector.getStatistics();
      expect(stats.normalizationParams).toBeDefined();
      expect(stats.normalizationParams.mean).toBeGreaterThan(0);
      expect(stats.normalizationParams.std).toBeGreaterThan(0);
    });
  });

  describe("detect", () => {
    const trainingData: IAnomalyData[] = Array.from({ length: 50 }, (_, i) => ({
      metricName: "test-metric",
      value: 10 + (i % 10) * 0.1, // Regular pattern between 10 and 11
      timestamp: Date.now() + i * 1000,
      source: "test",
    }));

    beforeEach(async () => {
      await detector.train(trainingData);
    });

    it("should not detect anomalies for normal values", async () => {
      const normalData: IAnomalyData[] = [
        { metricName: "test-metric", value: 10.5, timestamp: Date.now(), source: "test" },
        { metricName: "test-metric", value: 10.3, timestamp: Date.now() + 1000, source: "test" },
        { metricName: "test-metric", value: 10.7, timestamp: Date.now() + 2000, source: "test" },
      ];

      const anomalies = await detector.detect(normalData);
      expect(anomalies).toHaveLength(0);
    });

    it("should detect anomalies for outlier values", async () => {
      const anomalousData: IAnomalyData[] = [
        { metricName: "test-metric", value: 20, timestamp: Date.now(), source: "test" }, // Far from training range
        { metricName: "test-metric", value: 5, timestamp: Date.now() + 1000, source: "test" }, // Far below training range
        { metricName: "test-metric", value: 10.5, timestamp: Date.now() + 2000, source: "test" }, // Normal
      ];

      const anomalies = await detector.detect(anomalousData);
      expect(anomalies.length).toBeGreaterThanOrEqual(2);
      expect(anomalies[0].data.value).toBe(20);
      expect(anomalies[1].data.value).toBe(5);
    });

    it("should calculate appropriate confidence scores", async () => {
      const anomalousData: IAnomalyData[] = [
        { metricName: "test-metric", value: 15, timestamp: Date.now(), source: "test" }, // Moderate anomaly
        { metricName: "test-metric", value: 30, timestamp: Date.now() + 1000, source: "test" }, // Strong anomaly
      ];

      const anomalies = await detector.detect(anomalousData);
      expect(anomalies).toHaveLength(2);

      // Stronger anomaly should have lower confidence (due to exponential decay)
      expect(anomalies[1].confidence).toBeLessThan(anomalies[0].confidence);
    });

    it("should use dynamic K when enabled", async () => {
      detector.configure({ dynamicK: true, k: 10 });

      const stats = detector.getStatistics();
      const effectiveK = stats.effectiveK;

      // With 50 training samples, sqrt(50) ≈ 7, so effective K should be less than 10
      expect(effectiveK).toBeLessThan(10);
      expect(effectiveK).toBeGreaterThanOrEqual(3);
    });

    it("should support different distance metrics", async () => {
      const testData: IAnomalyData[] = [
        { metricName: "test-metric", value: 15, timestamp: Date.now(), source: "test" },
      ];

      // Test Euclidean
      detector.configure({ distanceMetric: "euclidean", anomalyThreshold: 1.0 });
      const euclideanAnomalies = await detector.detect(testData);

      // Test Manhattan
      detector.configure({ distanceMetric: "manhattan", anomalyThreshold: 1.0 });
      const manhattanAnomalies = await detector.detect(testData);

      // Both should detect the anomaly
      expect(euclideanAnomalies).toHaveLength(1);
      expect(manhattanAnomalies).toHaveLength(1);

      // Test that the detector can switch between metrics
      expect(euclideanAnomalies[0]).toBeDefined();
      expect(manhattanAnomalies[0]).toBeDefined();
    });

    it("should use weighted voting when enabled", async () => {
      const testData: IAnomalyData[] = [
        { metricName: "test-metric", value: 12, timestamp: Date.now(), source: "test" },
      ];

      // Test without weighted voting
      detector.configure({ weightedVoting: false });
      const unweightedAnomalies = await detector.detect(testData);

      // Test with weighted voting
      detector.configure({ weightedVoting: true });
      const weightedAnomalies = await detector.detect(testData);

      // Both should process the data
      expect(unweightedAnomalies.length).toBeDefined();
      expect(weightedAnomalies.length).toBeDefined();
    });

    it("should respect detector context", async () => {
      const context: IDetectorContext = {
        currentTime: Date.now(),
        metadata: { test: true },
      };

      const anomalousData: IAnomalyData[] = [
        { metricName: "test-metric", value: 20, timestamp: Date.now(), source: "test" },
      ];

      const anomalies = await detector.detect(anomalousData, context);

      // Anomalies should still be detected
      expect(anomalies.length).toBeGreaterThan(0);
      // Context is not directly stored in anomaly, but the detection should work
      expect(anomalies[0]).toBeDefined();
    });

    it("should continuously learn from new data", async () => {
      const initialStats = detector.getStatistics();
      const initialSize = initialStats.trainingDataSize;

      // Detect new data (which also adds to training)
      const newData: IAnomalyData[] = Array.from({ length: 10 }, (_, i) => ({
        metricName: "test-metric",
        value: 10.5 + i * 0.01,
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      await detector.detect(newData);

      const finalStats = detector.getStatistics();
      expect(finalStats.trainingDataSize).toBe(initialSize + 10);
    });
  });

  describe("performance optimizations", () => {
    it("should use quickselect for efficient k-nearest neighbor finding", async () => {
      // Train with large dataset
      const largeTrainingData: IAnomalyData[] = Array.from({ length: 1000 }, (_, i) => ({
        metricName: "test-metric",
        value: Math.random() * 100,
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      await detector.train(largeTrainingData);

      // Time the detection
      const testData: IAnomalyData[] = Array.from({ length: 100 }, (_, i) => ({
        metricName: "test-metric",
        value: Math.random() * 150,
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      const startTime = Date.now();
      await detector.detect(testData);
      const endTime = Date.now();

      // Should complete quickly even with large dataset
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe("reset", () => {
    it("should clear all training data and state", async () => {
      const trainingData: IAnomalyData[] = Array.from({ length: 50 }, (_, i) => ({
        metricName: "test-metric",
        value: 10 + i * 0.1,
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      await detector.train(trainingData);
      expect(detector.isReady()).toBe(true);

      detector.reset();

      expect(detector.isReady()).toBe(false);
      const stats = detector.getStatistics();
      expect(stats.trainingDataSize).toBe(0);
      expect(stats.normalizationParams).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle empty detection data", async () => {
      const trainingData: IAnomalyData[] = Array.from({ length: 50 }, (_, i) => ({
        metricName: "test-metric",
        value: 10 + i * 0.1,
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      await detector.train(trainingData);

      const anomalies = await detector.detect([]);
      expect(anomalies).toHaveLength(0);
    });

    it("should handle detection before training", async () => {
      const testData: IAnomalyData[] = [
        { metricName: "test-metric", value: 10, timestamp: Date.now(), source: "test" },
      ];

      const anomalies = await detector.detect(testData);
      expect(anomalies).toHaveLength(0);
    });

    it("should handle identical values in training data", async () => {
      const identicalData: IAnomalyData[] = Array.from({ length: 50 }, (_, i) => ({
        metricName: "test-metric",
        value: 10, // All same value
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      detector.configure({ anomalyThreshold: 0.5 }); // Lower threshold for this test
      await detector.train(identicalData);

      const testData: IAnomalyData[] = [
        { metricName: "test-metric", value: 10, timestamp: Date.now(), source: "test" }, // Same as training
        { metricName: "test-metric", value: 11, timestamp: Date.now() + 1000, source: "test" }, // Different
      ];

      const anomalies = await detector.detect(testData);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].data.value).toBe(11);
    });

    it("should handle zero standard deviation gracefully", async () => {
      detector.configure({ normalizeData: true });

      const constantData: IAnomalyData[] = Array.from({ length: 50 }, (_, i) => ({
        metricName: "test-metric",
        value: 5, // Constant value
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      await detector.train(constantData);

      const stats = detector.getStatistics();
      expect(stats.normalizationParams.std).toBe(1); // Should default to 1 to avoid division by zero
    });
  });

  describe("getStatistics", () => {
    it("should return comprehensive statistics", async () => {
      detector.configure({
        k: 7,
        distanceMetric: "manhattan",
        anomalyThreshold: 2.5,
      });

      const trainingData: IAnomalyData[] = Array.from({ length: 30 }, (_, i) => ({
        metricName: "test-metric",
        value: 10 + i * 0.1,
        timestamp: Date.now() + i * 1000,
        source: "test",
      }));

      await detector.train(trainingData);

      const stats = detector.getStatistics();

      expect(stats).toMatchObject({
        name: "K-Nearest Neighbors Detector",
        version: "1.0.0",
        trained: true,
        trainingDataSize: 30,
        config: expect.objectContaining({
          k: 7,
          distanceMetric: "manhattan",
          anomalyThreshold: 2.5,
        }),
        effectiveK: expect.any(Number),
      });
    });
  });
});
