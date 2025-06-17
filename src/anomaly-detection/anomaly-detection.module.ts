import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

// Import controllers
import { AnomalyManagementController } from "./controllers/anomaly-management.controller";
import { DetectorManagementController } from "./controllers/detector-management.controller";

// Import provider factory and DI tokens
import { anomalyDetectionProviderFactory } from "./providers.factory";
import { DI_TOKENS } from "../core/di-tokens";

/**
 * Anomaly Detection Module with enterprise-grade DI patterns
 *
 * This module provides comprehensive anomaly detection capabilities using
 * Symbol-based dependency injection tokens for type safety and maintainability.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      global: true,
      ignoreErrors: true, // Ignore errors for robustness
      newListener: true, // Emit 'newListener' events for dynamic listener management
      wildcard: true, // Enable wildcard event matching for flexible event handling
      verboseMemoryLeak: true, // Enable verbose memory leak detection
      maxListeners: 200, // Set a reasonable limit for listeners to prevent memory leaks
    }),
    ScheduleModule.forRoot({
      cronJobs: true, // Enable cron jobs for scheduled tasks
      intervals: true, // Enable interval-based tasks
      timeouts: true, // Enable timeout-based tasks
    }),
  ],
  controllers: [AnomalyManagementController, DetectorManagementController],
  providers: [
    // All providers created through factory for consistency
    ...anomalyDetectionProviderFactory.createAllProviders(),
  ],
  exports: [
    // Core services needed for external usage
    DI_TOKENS.ANOMALY_DETECTION_SERVICE,
    DI_TOKENS.ALERTING_SERVICE,
    DI_TOKENS.DETECTOR_FACTORY,
    DI_TOKENS.DETECTOR_REGISTRY,
  ],
})
export class AnomalyDetectionModule {}
