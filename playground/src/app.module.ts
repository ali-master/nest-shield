import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ShieldModule, DI_TOKENS, AnomalyDetectionService } from "@usex/nest-shield";

// Controllers
import { BasicController } from "./controllers/basic.controller";
import { RateLimitController } from "./controllers/rate-limit.controller";
import { ThrottleController } from "./controllers/throttle.controller";
import { CircuitBreakerController } from "./controllers/circuit-breaker.controller";
import { OverloadController } from "./controllers/overload.controller";
import { MetricsController } from "./controllers/metrics.controller";
import { AnomalyDetectionController } from "./controllers/anomaly-detection.controller";
import { ConfigController } from "./controllers/config.controller";
import { CombinedProtectionController } from "./controllers/combined-protection.controller";
// import { AdvancedController } from "./controllers/advanced.controller";
// import { DIShowcaseController } from "./controllers/di-showcase.controller";
// import { AnomalyShowcaseController } from "./controllers/anomaly-showcase.controller";
import { MetricsShowcaseController } from "./controllers/metrics-showcase.controller";
import { KNNShowcaseController } from "./controllers/knn-showcase.controller";
import { MonitoringDemoController } from "./controllers/monitoring-demo.controller";

// Services
import { TestService } from "./services/test.service";
import { MockExternalService } from "./services/mock-external.service";
import { CustomMetricsService } from "./services/custom-metrics.service";

@Module({
  imports: [
    // Enable event emitter for real-time monitoring
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Enable scheduler for automated monitoring tasks
    ScheduleModule.forRoot(),

    // Main Shield Module with monitoring enabled
    ShieldModule.forRoot({
      global: {
        enabled: true,
        logging: {
          enabled: true,
          level: "info",
        },
      },
      storage: {
        type: "memory",
        options: {
          maxSize: 10000,
          ttl: 3600000, // 1 hour
        },
      },
      metrics: {
        enabled: true,
        type: "prometheus",
        prefix: "nest_shield_playground",
        exportInterval: 5000,
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        percentiles: [0.5, 0.9, 0.95, 0.99],
        labels: {
          application: "nest-shield-playground",
          version: "1.0.0",
          environment: "development",
        },
        flushInterval: 1000,
        maxBufferSize: 1000,
      },
      circuitBreaker: {
        enabled: true,
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 10000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 20,
        allowWarmUp: true,
        warmUpCallVolume: 10,
      },
      rateLimit: {
        enabled: true,
        points: 100,
        duration: 60,
        blockDuration: 60,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
      },
      throttle: {
        enabled: true,
        ttl: 60,
        limit: 100,
      },
      overload: {
        enabled: true,
        maxConcurrentRequests: 200, // Increased from 50
        maxQueueSize: 500, // Increased from 100
        queueTimeout: 60000, // Increased from 30000 (60 seconds)
        shedStrategy: "priority",
        adaptiveThreshold: {
          enabled: true,
          minThreshold: 100,
          maxThreshold: 500,
          adjustmentInterval: 5000,
        },
      },
      adapters: {
        type: "auto",
      },
      advanced: {
        gracefulShutdown: {
          enabled: true,
          timeout: 30000,
        },
        requestPriority: {
          enabled: true,
          defaultPriority: 5,
        },
        adaptiveProtection: {
          enabled: true,
          learningPeriod: 3600000, // 1 hour
          adjustmentInterval: 60000, // 1 minute
          sensitivityFactor: 1.5,
        },
        distributedSync: {
          enabled: false, // Disabled for playground as we're using memory storage
          syncInterval: 5000,
          channel: "nest-shield:playground:sync",
        },
      },
    }),
  ],
  controllers: [
    BasicController,
    RateLimitController,
    ThrottleController,
    CircuitBreakerController,
    OverloadController,
    MetricsController,
    AnomalyDetectionController,
    ConfigController,
    CombinedProtectionController,
    // AdvancedController,
    // DIShowcaseController,
    // AnomalyShowcaseController,
    MetricsShowcaseController,
    KNNShowcaseController,
    MonitoringDemoController,
  ],
  providers: [
    TestService,
    MockExternalService,
    CustomMetricsService,
    // Additional providers for demonstrating DI token usage
    {
      provide: "PLAYGROUND_CONFIG",
      useValue: {
        name: "NestShield Playground",
        version: "1.0.0",
        features: {
          metrics: true,
          anomalyDetection: true,
          circuitBreaker: true,
          rateLimit: true,
          throttle: true,
          overload: true,
        },
      },
    },
    // Explicit AnomalyDetectionService provider to ensure it's available
    {
      provide: DI_TOKENS.ANOMALY_DETECTION_SERVICE,
      useClass: AnomalyDetectionService,
    },
    // Simple detector factory for demonstration (not dependent on complex DI chain)
    {
      provide: "DETECTOR_FACTORY",
      useValue: {
        create: (type: string) => {
          // Create a simple mock detector for demonstration
          if (type === "knn") {
            return {
              name: "KNN Detector",
              version: "1.0.0",
              isReady: () => true,
              configure: (options: any) => console.log("KNN configured with:", options),
              train: (data: any[]) => console.log("KNN training with data points:", data.length),
              detect: (data: any) => ({
                isAnomaly: Math.random() > 0.7,
                score: Math.random(),
                confidence: Math.random(),
                metadata: { type: "knn", threshold: 0.7 },
              }),
              getMetrics: () => ({
                totalSamples: 1000,
                anomaliesDetected: 42,
                accuracy: 0.95,
                lastTrained: new Date(),
              }),
              getStatistics: () => ({
                config: { k: 5, anomalyThreshold: 2.0 },
                trainingDataSize: 100,
                effectiveK: 5,
                normalizationParams: { mean: 50, std: 10 },
              }),
            };
          }
          if (type === "zscore") {
            return {
              name: "Z-Score Detector",
              version: "1.0.0",
              isReady: () => true,
              configure: (options: any) => console.log("Z-Score configured with:", options),
              train: (data: any[]) =>
                console.log("Z-Score training with data points:", data.length),
              detect: (data: any) => [],
              getStatistics: () => ({ threshold: 2.5, windowSize: 50 }),
            };
          }
          if (type === "threshold") {
            return {
              name: "Threshold Detector",
              version: "1.0.0",
              isReady: () => true,
              configure: (options: any) => console.log("Threshold configured with:", options),
              train: (data: any[]) =>
                console.log("Threshold training with data points:", data.length),
              detect: (data: any) => [],
              getStatistics: () => ({ upperThreshold: 80, lowerThreshold: 20 }),
            };
          }
          throw new Error(`Unknown detector type: ${type}`);
        },
        getAvailableTypes: () => ["knn", "statistical", "threshold", "zscore"],
        hasType: (type: string) => ["knn", "statistical", "threshold", "zscore"].includes(type),
      },
    },
  ],
})
export class AppModule {}
