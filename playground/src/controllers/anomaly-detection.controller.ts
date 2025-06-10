import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { InjectAnomalyDetection } from "nest-shield/core";
import type { AnomalyDetectionService, IAnomalyData } from "nest-shield";

@Controller("anomaly-detection")
export class AnomalyDetectionController {
  constructor(
    @InjectAnomalyDetection()
    private readonly anomalyService: AnomalyDetectionService,
  ) {}

  @Get("generate-normal-data")
  async generateNormalData(@Query("count") count: string = "100") {
    const dataCount = Math.min(parseInt(count, 10) || 100, 1000);
    const data: IAnomalyData[] = [];

    for (let i = 0; i < dataCount; i++) {
      // Generate normal response times (around 200ms ± 50ms)
      const responseTime = 150 + Math.random() * 100;
      data.push({
        metricName: "response_time",
        value: responseTime,
        timestamp: Date.now() - (dataCount - i) * 1000,
        type: "timing",
        metadata: { unit: "ms" },
        source: "playground",
      });

      data.push({
        metricName: "request_count",
        value: Math.floor(10 + Math.random() * 5),
        timestamp: Date.now() - (dataCount - i) * 1000,
        type: "counter",
        source: "playground",
      });

      data.push({
        metricName: "error_rate",
        value: Math.random() * 0.05, // 0-5% error rate
        timestamp: Date.now() - (dataCount - i) * 1000,
        type: "ratio",
        source: "playground",
      });
    }

    // Feed data to anomaly detection service
    const detectionResults = await this.anomalyService.detectAnomalies(data);

    return {
      message: `Generated ${dataCount} normal data points`,
      dataPoints: data.slice(-10), // Return last 10 points
      detectionResults: detectionResults.slice(-5), // Last 5 detection results
      timestamp: new Date().toISOString(),
    };
  }

  @Get("generate-anomaly")
  async generateAnomalyData(@Query("type") type: string = "spike") {
    let anomalyData: IAnomalyData[];

    switch (type) {
      case "spike":
        // Generate response time spike
        anomalyData = [
          {
            metricName: "response_time",
            value: 2000 + Math.random() * 1000, // 2-3 seconds
            timestamp: Date.now(),
            type: "timing",
            metadata: { anomaly_type: "spike" },
            source: "playground",
          },
        ];
        break;

      case "drop":
        // Generate request count drop
        anomalyData = [
          {
            metricName: "request_count",
            value: 1 + Math.random() * 2, // Very low request count
            timestamp: Date.now(),
            type: "counter",
            metadata: { anomaly_type: "drop" },
            source: "playground",
          },
        ];
        break;

      case "error-burst":
        // Generate error rate burst
        anomalyData = [
          {
            metricName: "error_rate",
            value: 0.8 + Math.random() * 0.2, // 80-100% error rate
            timestamp: Date.now(),
            type: "ratio",
            metadata: { anomaly_type: "error_burst" },
            source: "playground",
          },
        ];
        break;

      default:
        anomalyData = [
          {
            metricName: "response_time",
            value: 2500,
            timestamp: Date.now(),
            type: "timing",
            metadata: { anomaly_type: "default" },
            source: "playground",
          },
        ];
    }

    // Feed anomaly data to detection service
    const detectionResults = await this.anomalyService.detectAnomalies(anomalyData);

    return {
      message: `Generated ${type} anomaly`,
      anomalyData,
      detectionResults,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("zscore-detection")
  async zscoreDetection(@Query("threshold") threshold: string = "2.5") {
    const thresholdValue = parseFloat(threshold) || 2.5;

    // Generate test data with outliers
    const normalData = Array.from({ length: 50 }, (_, i) => ({
      metricName: "response_time",
      value: 200 + Math.random() * 50,
      timestamp: Date.now() - (50 - i) * 1000,
      type: "timing" as const,
      source: "playground",
    }));

    const outlierData: IAnomalyData[] = [
      {
        metricName: "response_time",
        value: 500,
        timestamp: Date.now() - 3000,
        type: "timing",
        metadata: { expected_outlier: true },
        source: "playground",
      },
      {
        metricName: "response_time",
        value: 1500,
        timestamp: Date.now() - 2000,
        type: "timing",
        metadata: { expected_outlier: true },
        source: "playground",
      },
      {
        metricName: "response_time",
        value: 2000,
        timestamp: Date.now() - 1000,
        type: "timing",
        metadata: { expected_outlier: true },
        source: "playground",
      },
    ];

    const allData = [...normalData, ...outlierData];
    const detectionResults = await this.anomalyService.detectAnomalies(allData);

    return {
      message: "Z-Score anomaly detection test",
      threshold: thresholdValue,
      totalDataPoints: allData.length,
      detectionResults: detectionResults,
      anomaliesDetected: detectionResults.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("isolation-forest")
  async isolationForestDetection() {
    // Generate multi-dimensional test data
    const testData: IAnomalyData[] = [];

    for (let i = 0; i < 100; i++) {
      const isAnomaly = Math.random() < 0.1; // 10% anomalies

      if (isAnomaly) {
        testData.push(
          {
            metricName: "response_time",
            value: 1000 + Math.random() * 2000,
            timestamp: Date.now() - (100 - i) * 1000,
            type: "timing",
            metadata: { expected_anomaly: true },
            source: "playground",
          },
          {
            metricName: "request_count",
            value: Math.random() < 0.5 ? 1 : 50,
            timestamp: Date.now() - (100 - i) * 1000,
            type: "counter",
            metadata: { expected_anomaly: true },
            source: "playground",
          },
          {
            metricName: "error_rate",
            value: 0.5 + Math.random() * 0.5,
            timestamp: Date.now() - (100 - i) * 1000,
            type: "ratio",
            metadata: { expected_anomaly: true },
            source: "playground",
          },
        );
      } else {
        testData.push(
          {
            metricName: "response_time",
            value: 150 + Math.random() * 100,
            timestamp: Date.now() - (100 - i) * 1000,
            type: "timing",
            source: "playground",
          },
          {
            metricName: "request_count",
            value: 8 + Math.random() * 4,
            timestamp: Date.now() - (100 - i) * 1000,
            type: "counter",
            source: "playground",
          },
          {
            metricName: "error_rate",
            value: Math.random() * 0.05,
            timestamp: Date.now() - (100 - i) * 1000,
            type: "ratio",
            source: "playground",
          },
        );
      }
    }

    // Switch to Isolation Forest detector if available
    this.anomalyService.switchDetector("Isolation Forest Detector");

    const detectionResults = await this.anomalyService.detectAnomalies(testData);

    return {
      message: "Isolation Forest anomaly detection test",
      totalDataPoints: testData.length,
      detectionResults: detectionResults.slice(-15), // Last 15 results
      totalAnomalies: detectionResults.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("seasonal-detection")
  async seasonalDetection() {
    const hourOfDay = new Date().getHours();

    // Simulate hourly pattern (lower traffic at night)
    const testData: IAnomalyData[] = [];

    for (let i = 0; i < 24; i++) {
      const hour = (hourOfDay + i) % 24;
      const expectedMultiplier = hour >= 9 && hour <= 17 ? 1.0 : 0.3;

      // Sometimes generate anomalous patterns
      const isAnomaly = Math.random() < 0.2;
      const actualMultiplier = isAnomaly
        ? expectedMultiplier > 0.5
          ? 0.2
          : 2.0 // Opposite of expected
        : expectedMultiplier + (Math.random() - 0.5) * 0.2;

      const requestCount = Math.floor(10 * actualMultiplier + Math.random() * 5);

      testData.push({
        metricName: "hourly_requests",
        value: requestCount,
        timestamp: Date.now() - (24 - i) * 3600000, // Hour intervals
        type: "counter",
        metadata: {
          hour,
          expected_pattern: expectedMultiplier,
          is_anomalous_pattern: isAnomaly,
        },
        source: "playground",
      });
    }

    // Switch to Seasonal detector
    this.anomalyService.switchDetector("Seasonal Anomaly Detector");

    const detectionResults = await this.anomalyService.detectAnomalies(testData);

    return {
      message: "Seasonal anomaly detection test (hourly patterns)",
      testData,
      detectionResults,
      anomaliesDetected: detectionResults.length,
      patternAnomalies: testData.filter((d) => d.metadata?.is_anomalous_pattern).length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("threshold-detection")
  async thresholdDetection(@Query("metric") metric: string = "response_time") {
    const thresholds = {
      response_time: { upper: 1000, lower: 50 },
      error_rate: { upper: 0.1, lower: 0 },
      request_count: { upper: 20, lower: 1 },
    };

    const threshold = thresholds[metric as keyof typeof thresholds] || thresholds.response_time;

    // Generate test data that crosses thresholds
    const testValues = [
      threshold.lower - 10, // Below lower threshold
      threshold.lower + 10, // Normal
      (threshold.upper + threshold.lower) / 2, // Normal
      threshold.upper + 10, // Above upper threshold
      threshold.upper * 2, // Way above upper threshold
    ];

    const testData: IAnomalyData[] = testValues.map((value, index) => ({
      metricName: metric,
      value,
      timestamp: Date.now() - (testValues.length - index) * 1000,
      type: metric === "error_rate" ? "ratio" : metric === "request_count" ? "counter" : "timing",
      metadata: {
        threshold_violation: value < threshold.lower || value > threshold.upper,
      },
      source: "playground",
    }));

    // Switch to Threshold detector
    this.anomalyService.switchDetector("Threshold Anomaly Detector");

    const detectionResults = await this.anomalyService.detectAnomalies(testData);

    return {
      message: `Threshold anomaly detection test for ${metric}`,
      metric,
      thresholds: threshold,
      testData,
      detectionResults,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("custom-metric")
  async collectCustomMetric(@Body() body: { metric: string; value: number; metadata?: any }) {
    const dataPoint: IAnomalyData = {
      metricName: body.metric,
      value: body.value,
      timestamp: Date.now(),
      type: "custom",
      metadata: body.metadata,
      source: "playground-custom",
    };

    const detectionResult = await this.anomalyService.detectSingleDataPoint(dataPoint);

    return {
      message: "Custom metric collected",
      dataPoint,
      detectionResult,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("detection-status")
  async getDetectionStatus() {
    const activeDetector = this.anomalyService.getActiveDetectorName();
    const availableDetectors = this.anomalyService.getAvailableDetectors();
    const detectorInfo = this.anomalyService.getDetectorInfo();
    const statistics = this.anomalyService.getAnomalyStatistics();

    return {
      message: "Anomaly detection system status",
      status: "active",
      activeDetector,
      availableDetectors,
      detectorInfo,
      statistics,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("simulate-attack")
  async simulateAttack(@Body() body: { attackType: string; duration?: number }) {
    const attackType = body.attackType || "ddos";

    const startTime = Date.now();
    const attackData: IAnomalyData[] = [];

    switch (attackType) {
      case "ddos":
        // Simulate DDoS attack with high request count
        for (let i = 0; i < 30; i++) {
          attackData.push({
            metricName: "request_count",
            value: 100 + Math.random() * 200, // Very high request count
            timestamp: startTime + i * 1000,
            type: "counter",
            metadata: { attack_type: "ddos" },
            source: "attack-simulation",
          });
        }
        break;

      case "slowloris":
        // Simulate Slowloris attack with high response times
        for (let i = 0; i < 20; i++) {
          attackData.push({
            metricName: "response_time",
            value: 5000 + Math.random() * 10000, // Very slow responses
            timestamp: startTime + i * 1500,
            type: "timing",
            metadata: { attack_type: "slowloris" },
            source: "attack-simulation",
          });
        }
        break;

      case "error-flood":
        // Simulate error flood attack
        for (let i = 0; i < 25; i++) {
          attackData.push({
            metricName: "error_rate",
            value: 0.8 + Math.random() * 0.2, // 80-100% error rate
            timestamp: startTime + i * 1200,
            type: "ratio",
            metadata: { attack_type: "error_flood" },
            source: "attack-simulation",
          });
        }
        break;
    }

    const detectionResults = await this.anomalyService.detectAnomalies(attackData);

    return {
      message: `Simulated ${attackType} attack`,
      duration:
        attackData.length > 0 ? Math.max(...attackData.map((d) => d.timestamp)) - startTime : 0,
      attackType,
      attackData: attackData.slice(-10), // Last 10 data points
      detectionResults: detectionResults.slice(-10), // Last 10 results
      totalDetections: detectionResults.length,
      detectionRate: (detectionResults.length / attackData.length) * 100,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("composite-detection")
  async compositeDetection() {
    // Test composite detector with multiple metrics
    const scenarios = [
      { name: "Normal Traffic", responseTime: 200, requestCount: 10, errorRate: 0.02 },
      { name: "Performance Issue", responseTime: 2000, requestCount: 8, errorRate: 0.05 },
      { name: "DDoS Attack", responseTime: 300, requestCount: 150, errorRate: 0.15 },
      { name: "Service Failure", responseTime: 5000, requestCount: 5, errorRate: 0.9 },
      { name: "Traffic Spike", responseTime: 800, requestCount: 50, errorRate: 0.08 },
    ];

    const scenarioResults: any[] = [];

    // Switch to Composite detector
    this.anomalyService.switchDetector("Composite Anomaly Detector");

    for (const [index, scenario] of scenarios.entries()) {
      const scenarioData: IAnomalyData[] = [
        {
          metricName: "response_time",
          value: scenario.responseTime,
          timestamp: Date.now() + index * 1000,
          type: "timing",
          metadata: { scenario: scenario.name },
          source: "composite-test",
        },
        {
          metricName: "request_count",
          value: scenario.requestCount,
          timestamp: Date.now() + index * 1000,
          type: "counter",
          metadata: { scenario: scenario.name },
          source: "composite-test",
        },
        {
          metricName: "error_rate",
          value: scenario.errorRate,
          timestamp: Date.now() + index * 1000,
          type: "ratio",
          metadata: { scenario: scenario.name },
          source: "composite-test",
        },
      ];

      const detectionResults = await this.anomalyService.detectAnomalies(scenarioData);

      scenarioResults.push({
        scenario: scenario.name,
        metrics: {
          responseTime: scenario.responseTime,
          requestCount: scenario.requestCount,
          errorRate: scenario.errorRate,
        },
        detectionResults,
        overallAnomaly: detectionResults.length > 0,
      });

      // Wait between scenarios
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      message: "Composite anomaly detection test",
      scenarios: scenarioResults,
      anomalousScenarios: scenarioResults.filter((r) => r.overallAnomaly).length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("recent-anomalies")
  async getRecentAnomalies(@Query("limit") limit: string = "50") {
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const recentAnomalies = this.anomalyService.getRecentAnomalies(limitNum);

    return {
      message: "Recent anomalies",
      anomalies: recentAnomalies,
      count: recentAnomalies.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("historical-data")
  async getHistoricalData(@Query("source") source?: string, @Query("limit") limit: string = "100") {
    const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);
    const historicalData = this.anomalyService.getHistoricalData(source, limitNum);

    return {
      message: "Historical data",
      data: historicalData,
      count: historicalData.length,
      source: source || "all",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("switch-detector")
  async switchDetector(@Body() body: { detectorName: string }) {
    const success = this.anomalyService.switchDetector(body.detectorName);

    return {
      message: success ? "Detector switched successfully" : "Failed to switch detector",
      success,
      newActiveDetector: this.anomalyService.getActiveDetectorName(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post("reset-detector")
  async resetDetector() {
    this.anomalyService.resetDetector();

    return {
      message: "Detector reset successfully",
      activeDetector: this.anomalyService.getActiveDetectorName(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post("clear-history")
  async clearHistory() {
    this.anomalyService.clearHistory();

    return {
      message: "Anomaly detection history cleared",
      timestamp: new Date().toISOString(),
    };
  }
}
