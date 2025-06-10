import { Module } from "@nestjs/common";
import { ShieldModule } from "nest-shield";
import { BasicController } from "./controllers/basic.controller";
import { RateLimitController } from "./controllers/rate-limit.controller";
import { ThrottleController } from "./controllers/throttle.controller";
import { CircuitBreakerController } from "./controllers/circuit-breaker.controller";
import { OverloadController } from "./controllers/overload.controller";
import { MetricsController } from "./controllers/metrics.controller";
import { AnomalyDetectionController } from "./controllers/anomaly-detection.controller";
import { ConfigController } from "./controllers/config.controller";
import { CombinedProtectionController } from "./controllers/combined-protection.controller";
import { AdvancedController } from "./controllers/advanced.controller";
import { TestService } from "./services/test.service";
import { MockExternalService } from "./services/mock-external.service";
import { CustomMetricsService } from "./services/custom-metrics.service";

@Module({
  imports: [
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
      },
      metrics: {
        enabled: true,
        type: "prometheus",
        exportInterval: 5000,
      },
      circuitBreaker: {
        enabled: true,
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 10000,
      },
      rateLimit: {
        enabled: true,
        points: 100,
        duration: 60,
        blockDuration: 60,
      },
      throttle: {
        enabled: true,
        ttl: 60,
        limit: 100,
      },
      overload: {
        enabled: true,
        maxConcurrentRequests: 10,
        maxQueueSize: 5,
        queueTimeout: 5000,
      },
      advanced: {
        adaptiveProtection: {
          enabled: true,
          learningPeriod: 86400000,
          adjustmentInterval: 30000,
          sensitivityFactor: 0.8,
          anomalyDetection: {
            enabled: true,
            detectorType: "Z-Score Detector",
            sensitivity: 0.8,
            windowSize: 100,
            minDataPoints: 10,
          },
        },
        gracefulShutdown: {
          enabled: true,
          timeout: 30000,
        },
        requestPriority: {
          enabled: true,
          defaultPriority: 5,
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
    AdvancedController,
  ],
  providers: [TestService, MockExternalService, CustomMetricsService],
})
export class AppModule {}
