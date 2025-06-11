import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { IMetricsCollector } from "../interfaces";
import { InjectShieldLogger, InjectShieldConfig } from "../core/injection.decorators";
import type { ShieldLoggerService } from "./shield-logger.service";
import type {
  MetricValue,
  MetricLabels,
  IMetricsServiceOptions,
  IMetricsHealth,
  IEnhancedMetricsConfig,
} from "../metrics/types";
import { MetricsManagerService } from "../metrics/services";

@Injectable()
export class MetricsService implements IMetricsCollector, OnModuleInit, OnModuleDestroy {
  private readonly manager: MetricsManagerService;
  private readonly config: IEnhancedMetricsConfig;

  constructor(
    @InjectShieldConfig() private readonly options: IMetricsServiceOptions,
    @InjectShieldLogger() private readonly logger: ShieldLoggerService,
  ) {
    this.config = this.options.metrics || { enabled: false, type: "prometheus" };

    // Initialize the metrics manager with proper configuration
    this.manager = new MetricsManagerService(
      this.config,
      this.logger,
      this.options.advanced?.adaptiveProtection?.anomalyDetection,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.manager.initialize();
      this.logger.metrics("MetricsService initialized successfully", {
        operation: "module_init",
        metadata: {
          enhancedMode: this.manager.isEnhancedModeAvailable(),
          anomalyDetectionEnabled: this.manager.getAnomalyDetectionService().isEnabled(),
        },
      });
    } catch (error) {
      this.logger.metricsError("Failed to initialize MetricsService", error as Error, {
        operation: "module_init",
      });
      // Don't throw, allow graceful degradation
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.manager.destroy();
      this.logger.metrics("MetricsService destroyed successfully", {
        operation: "module_destroy",
      });
    } catch (error) {
      this.logger.metricsError("Failed to destroy MetricsService", error as Error, {
        operation: "module_destroy",
      });
    }
  }

  // Core metric methods - delegate to manager with safety checks
  increment(metric: string, value: MetricValue = 1, labels?: MetricLabels): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Metrics manager not initialized, skipping increment", {
        operation: "increment",
        metadata: { metric, value },
      });
      return;
    }
    this.manager.increment(metric, value, labels);
  }

  decrement(metric: string, value: MetricValue = 1, labels?: MetricLabels): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Metrics manager not initialized, skipping decrement", {
        operation: "decrement",
        metadata: { metric, value },
      });
      return;
    }
    this.manager.decrement(metric, value, labels);
  }

  gauge(metric: string, value: MetricValue, labels?: MetricLabels): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Metrics manager not initialized, skipping gauge", {
        operation: "gauge",
        metadata: { metric, value },
      });
      return;
    }
    this.manager.gauge(metric, value, labels);
  }

  histogram(metric: string, value: MetricValue, labels?: MetricLabels): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Metrics manager not initialized, skipping histogram", {
        operation: "histogram",
        metadata: { metric, value },
      });
      return;
    }
    this.manager.histogram(metric, value, labels);
  }

  summary(metric: string, value: MetricValue, labels?: MetricLabels): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Metrics manager not initialized, skipping summary", {
        operation: "summary",
        metadata: { metric, value },
      });
      return;
    }
    this.manager.summary(metric, value, labels);
  }

  startTimer(metric: string, labels?: MetricLabels): () => void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Metrics manager not initialized, returning no-op timer", {
        operation: "start_timer",
        metadata: { metric },
      });
      return () => {}; // Return no-op function
    }
    return this.manager.startTimer(metric, labels);
  }

  // Enhanced analytics methods
  getRollingStatistics(metric: string, labels?: MetricLabels) {
    if (!this.manager.isInitialized()) {
      return null;
    }
    return this.manager.getRollingStatistics(metric, labels);
  }

  getPercentiles(metric: string, labels?: MetricLabels, percentiles: number[] = [50, 90, 95, 99]) {
    if (!this.manager.isInitialized()) {
      return null;
    }
    return this.manager.getPercentiles(metric, labels, percentiles);
  }

  getTimeSeriesData(metric: string, labels?: MetricLabels, windowCount: number = 60) {
    if (!this.manager.isInitialized()) {
      return null;
    }
    return this.manager.getTimeSeriesData(metric, labels, windowCount);
  }

  // Export methods
  async exportPrometheus(): Promise<string> {
    if (!this.manager.isInitialized()) {
      throw new Error("Metrics manager not initialized");
    }
    const result = await this.manager.exportMetrics("prometheus");
    if (typeof result === "object" && result.error) {
      throw new Error(String(result.error));
    }
    return result as string;
  }

  async exportJson(): Promise<Record<string, unknown>> {
    if (!this.manager.isInitialized()) {
      return { error: "Metrics manager not initialized" };
    }
    return this.manager.exportMetrics("json") as Promise<Record<string, unknown>>;
  }

  async exportMetrics(
    format: "prometheus" | "json" | "openmetrics" = "json",
  ): Promise<string | Record<string, unknown>> {
    if (!this.manager.isInitialized()) {
      return { error: "Metrics manager not initialized" };
    }
    return this.manager.exportMetrics(format);
  }

  // Utility methods
  resetMetric(metric: string, labels?: MetricLabels): void {
    if (!this.manager.isInitialized()) {
      return;
    }
    this.manager.resetMetric(metric, labels);
  }

  resetAllMetrics(): void {
    if (!this.manager.isInitialized()) {
      return;
    }
    this.manager.resetAllMetrics();
  }

  // Health and status methods
  getHealth(): IMetricsHealth {
    if (!this.manager.isInitialized()) {
      return {
        status: "unhealthy",
        details: {
          error: "Metrics manager not initialized",
          enabled: this.config.enabled || false,
          enhancedMode: false,
          lastUpdate: Date.now(),
          anomalyDetectionEnabled: false,
        },
      };
    }
    return this.manager.getHealth();
  }

  // Anomaly detection methods
  setAnomalyDetectionEnabled(enabled: boolean): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Cannot set anomaly detection: manager not initialized", {
        operation: "set_anomaly_detection",
        metadata: { enabled },
      });
      return;
    }
    this.manager.getAnomalyDetectionService().setEnabled(enabled);
  }

  isAnomalyDetectionEnabled(): boolean {
    if (!this.manager.isInitialized()) {
      return false;
    }
    return this.manager.getAnomalyDetectionService().isEnabled();
  }

  // Status methods
  isEnhancedModeAvailable(): boolean {
    return this.manager.isInitialized() && this.manager.isEnhancedModeAvailable();
  }

  isInitialized(): boolean {
    return this.manager.isInitialized();
  }

  getCollector(): IMetricsCollector {
    if (!this.manager.isInitialized()) {
      // Return a no-op collector if not initialized
      return {
        increment: () => {},
        decrement: () => {},
        gauge: () => {},
        histogram: () => {},
        summary: () => {},
      };
    }
    return this.manager.getCollector();
  }

  // Configuration methods
  getConfiguration(): IEnhancedMetricsConfig {
    return { ...this.config };
  }

  updateAnomalyDetectionConfig(config: Record<string, unknown>): void {
    if (!this.manager.isInitialized()) {
      this.logger.metricsWarn("Cannot update anomaly config: manager not initialized", {
        operation: "update_anomaly_config",
      });
      return;
    }
    this.manager.getAnomalyDetectionService().updateConfig(config as any);
  }
}
