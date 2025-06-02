import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

// Import services
import { AnomalyDetectionService } from "../services/anomaly-detection.service";
import { 
  EnterpriseAnomalyDetectionService,
  EnterpriseAlertingService,
  EnterprisePerformanceMonitorService,
  EnterpriseDataCollectorService
} from "./services";

// Import all detectors
import {
  ZScoreDetector,
  IsolationForestDetector,
  SeasonalAnomalyDetector,
  ThresholdAnomalyDetector,
  StatisticalAnomalyDetector,
  MachineLearningDetector,
  CompositeAnomalyDetector,
} from "./detectors";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [
    // Core services
    AnomalyDetectionService,
    
    // Enterprise services
    EnterpriseAnomalyDetectionService,
    EnterpriseAlertingService,
    EnterprisePerformanceMonitorService,
    EnterpriseDataCollectorService,
    
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
    // Core services
    AnomalyDetectionService,
    
    // Enterprise services
    EnterpriseAnomalyDetectionService,
    EnterpriseAlertingService,
    EnterprisePerformanceMonitorService,
    EnterpriseDataCollectorService,
    
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
