/**
 * Anomaly Detection Provider Factory
 *
 * Centralized factory for creating anomaly detection related providers
 * with proper dependency injection patterns for senior NestJS standards.
 */

import type { Provider } from "@nestjs/common";
import { DI_TOKENS } from "../core";
import type { IAnomalyDetector } from "./interfaces";

// Services
import {
  PerformanceMonitorService,
  DetectorManagementService,
  DataCollectorService,
  AnomalyDetectionService,
  AlertingService,
} from "./services";

// Detectors
import {
  ZScoreDetector,
  ThresholdAnomalyDetector,
  StatisticalAnomalyDetector,
  SeasonalAnomalyDetector,
  MachineLearningDetector,
  IsolationForestDetector,
  CompositeAnomalyDetector,
} from "./detectors";

/**
 * Factory interface for anomaly detection providers
 */
export interface IAnomalyDetectionProviderFactory {
  createServiceProviders: () => Provider[];
  createDetectorProviders: () => Provider[];
  createAllProviders: () => Provider[];
}

/**
 * Anomaly detection provider factory implementation
 */
export class AnomalyDetectionProviderFactory implements IAnomalyDetectionProviderFactory {
  /**
   * Creates all service providers with Symbol-based tokens
   */
  createServiceProviders(): Provider[] {
    return [
      // Core services with Symbol tokens
      {
        provide: DI_TOKENS.ANOMALY_DETECTION_SERVICE,
        useClass: AnomalyDetectionService,
      },
      {
        provide: DI_TOKENS.ALERTING_SERVICE,
        useClass: AlertingService,
      },
      {
        provide: DI_TOKENS.PERFORMANCE_MONITOR_SERVICE,
        useClass: PerformanceMonitorService,
      },
      {
        provide: DI_TOKENS.DATA_COLLECTOR_SERVICE,
        useClass: DataCollectorService,
      },
      {
        provide: DI_TOKENS.DETECTOR_MANAGEMENT_SERVICE,
        useClass: DetectorManagementService,
      },
    ];
  }

  /**
   * Creates all detector providers with Symbol-based tokens
   */
  createDetectorProviders(): Provider[] {
    return [
      // Detector providers with Symbol tokens
      {
        provide: DI_TOKENS.ZSCORE_DETECTOR,
        useClass: ZScoreDetector,
      },
      {
        provide: DI_TOKENS.THRESHOLD_DETECTOR,
        useClass: ThresholdAnomalyDetector,
      },
      {
        provide: DI_TOKENS.STATISTICAL_DETECTOR,
        useClass: StatisticalAnomalyDetector,
      },
      {
        provide: DI_TOKENS.SEASONAL_DETECTOR,
        useClass: SeasonalAnomalyDetector,
      },
      {
        provide: DI_TOKENS.MACHINE_LEARNING_DETECTOR,
        useClass: MachineLearningDetector,
      },
      {
        provide: DI_TOKENS.ISOLATION_FOREST_DETECTOR,
        useClass: IsolationForestDetector,
      },
      {
        provide: DI_TOKENS.COMPOSITE_DETECTOR,
        useClass: CompositeAnomalyDetector,
      },
    ];
  }

  /**
   * Creates detector registry provider for centralized detector management
   */
  createDetectorRegistryProvider(): Provider {
    return {
      provide: DI_TOKENS.DETECTOR_REGISTRY,
      useFactory: (
        zscoreDetector: ZScoreDetector,
        thresholdDetector: ThresholdAnomalyDetector,
        statisticalDetector: StatisticalAnomalyDetector,
        seasonalDetector: SeasonalAnomalyDetector,
        mlDetector: MachineLearningDetector,
        isolationForestDetector: IsolationForestDetector,
        compositeDetector: CompositeAnomalyDetector,
      ) => {
        return new Map<string, IAnomalyDetector>([
          ["zscore", zscoreDetector],
          ["threshold", thresholdDetector],
          ["statistical", statisticalDetector],
          ["seasonal", seasonalDetector],
          ["machine-learning", mlDetector],
          ["isolation-forest", isolationForestDetector],
          ["composite", compositeDetector],
        ]);
      },
      inject: [
        DI_TOKENS.ZSCORE_DETECTOR,
        DI_TOKENS.THRESHOLD_DETECTOR,
        DI_TOKENS.STATISTICAL_DETECTOR,
        DI_TOKENS.SEASONAL_DETECTOR,
        DI_TOKENS.MACHINE_LEARNING_DETECTOR,
        DI_TOKENS.ISOLATION_FOREST_DETECTOR,
        DI_TOKENS.COMPOSITE_DETECTOR,
      ],
    };
  }

  /**
   * Creates detector factory provider for dynamic detector creation
   */
  createDetectorFactoryProvider(): Provider {
    return {
      provide: DI_TOKENS.DETECTOR_FACTORY,
      useFactory: (detectorRegistry: Map<string, IAnomalyDetector>) => {
        return {
          create: (type: string) => {
            const detector = detectorRegistry.get(type);
            if (!detector) {
              throw new Error(`Unknown detector type: ${type}`);
            }
            return detector;
          },
          getAvailableTypes: () => Array.from(detectorRegistry.keys()),
          hasType: (type: string) => detectorRegistry.has(type),
        };
      },
      inject: [DI_TOKENS.DETECTOR_REGISTRY],
    };
  }

  /**
   * Creates all providers for the anomaly detection module
   */
  createAllProviders(): Provider[] {
    return [
      ...this.createServiceProviders(),
      ...this.createDetectorProviders(),
      this.createDetectorRegistryProvider(),
      this.createDetectorFactoryProvider(),
    ];
  }
}

/**
 * Singleton instance for the anomaly detection provider factory
 */
export const anomalyDetectionProviderFactory = new AnomalyDetectionProviderFactory();

/**
 * Utility functions for creating specialized anomaly detection providers
 */
export const createDetectorProvider = <T>(
  token: symbol,
  detectorClass: new (...args: unknown[]) => T,
): Provider => ({
  provide: token,
  useClass: detectorClass,
});

export const createServiceProvider = <T>(
  token: symbol,
  serviceClass: new (...args: unknown[]) => T,
): Provider => ({
  provide: token,
  useClass: serviceClass,
});

export const createConfigProvider = <T>(token: symbol, config: T): Provider => ({
  provide: token,
  useValue: config,
});

/**
 * Provider groups for easy exports
 */
export const ANOMALY_DETECTION_EXPORTS = [
  // Service tokens
  DI_TOKENS.ANOMALY_DETECTION_SERVICE,
  DI_TOKENS.ALERTING_SERVICE,
  DI_TOKENS.PERFORMANCE_MONITOR_SERVICE,
  DI_TOKENS.DATA_COLLECTOR_SERVICE,
  DI_TOKENS.DETECTOR_MANAGEMENT_SERVICE,

  // Detector tokens
  DI_TOKENS.ZSCORE_DETECTOR,
  DI_TOKENS.THRESHOLD_DETECTOR,
  DI_TOKENS.STATISTICAL_DETECTOR,
  DI_TOKENS.SEASONAL_DETECTOR,
  DI_TOKENS.MACHINE_LEARNING_DETECTOR,
  DI_TOKENS.ISOLATION_FOREST_DETECTOR,
  DI_TOKENS.COMPOSITE_DETECTOR,

  // Utility tokens
  DI_TOKENS.DETECTOR_REGISTRY,
  DI_TOKENS.DETECTOR_FACTORY,

  // Legacy exports handled by the actual class providers
];
