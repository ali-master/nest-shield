import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

// Import services
import {
  PerformanceMonitorService,
  DetectorManagementService,
  DataCollectorService,
  AnomalyDetectionService,
  AlertingService,
} from "./services";

// Import controllers
import { AnomalyManagementController } from "./controllers/anomaly-management.controller";
import { DetectorManagementController } from "./controllers/detector-management.controller";

// Import all detectors
import {
  ZScoreDetector,
  ThresholdAnomalyDetector,
  StatisticalAnomalyDetector,
  SeasonalAnomalyDetector,
  MachineLearningDetector,
  IsolationForestDetector,
  CompositeAnomalyDetector,
} from "./detectors";

@Module({
  imports: [EventEmitterModule.forRoot(), ScheduleModule.forRoot()],
  controllers: [AnomalyManagementController, DetectorManagementController],
  providers: [
    // Services
    AnomalyDetectionService,
    AlertingService,
    PerformanceMonitorService,
    DataCollectorService,
    DetectorManagementService,

    // Detectors
    ZScoreDetector,
    IsolationForestDetector,
    SeasonalAnomalyDetector,
    ThresholdAnomalyDetector,
    StatisticalAnomalyDetector,
    MachineLearningDetector,
    CompositeAnomalyDetector,
  ],
  exports: [
    // Services
    AnomalyDetectionService,
    AlertingService,
    PerformanceMonitorService,
    DataCollectorService,
    DetectorManagementService,

    // Detectors
    ZScoreDetector,
    IsolationForestDetector,
    SeasonalAnomalyDetector,
    ThresholdAnomalyDetector,
    StatisticalAnomalyDetector,
    MachineLearningDetector,
    CompositeAnomalyDetector,
  ],
})
export class AnomalyDetectionModule {}
