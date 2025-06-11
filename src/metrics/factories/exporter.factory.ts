import { OnModuleInit, Injectable } from "@nestjs/common";
import type {
  PrometheusExporterConstructor,
  OpenMetricsExporterConstructor,
  JsonExporterConstructor,
  IPrometheusExporter,
  IOpenMetricsExporter,
  IJsonExporter,
  IExporterFactory,
  IExporterConfig,
  IBaseMetricsCollector,
} from "../types";

@Injectable()
export class ExporterFactoryService implements IExporterFactory, OnModuleInit {
  private prometheusExporterClass: PrometheusExporterConstructor | null = null;
  private jsonExporterClass: JsonExporterConstructor | null = null;
  private openMetricsExporterClass: OpenMetricsExporterConstructor | null = null;
  private initialized = false;

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const exporters = await import("../exporters");
      // Use unknown first to safely cast
      this.prometheusExporterClass =
        exporters.PrometheusExporter as unknown as PrometheusExporterConstructor;
      this.jsonExporterClass = exporters.JsonExporter as unknown as JsonExporterConstructor;
      this.openMetricsExporterClass =
        exporters.OpenMetricsExporter as unknown as OpenMetricsExporterConstructor;
      this.initialized = true;
    } catch {
      // Enhanced exporters not available
      this.initialized = true; // Mark as initialized even if components aren't available
    }
  }

  createPrometheusExporter(
    collector: IBaseMetricsCollector,
    config: IExporterConfig,
  ): IPrometheusExporter | null {
    if (!this.prometheusExporterClass) {
      return null;
    }
    try {
      return new this.prometheusExporterClass(collector, config);
    } catch {
      return null;
    }
  }

  createJsonExporter(
    collector: IBaseMetricsCollector,
    config: IExporterConfig,
  ): IJsonExporter | null {
    if (!this.jsonExporterClass) {
      return null;
    }
    try {
      return new this.jsonExporterClass(collector, config);
    } catch {
      return null;
    }
  }

  createOpenMetricsExporter(
    collector: IBaseMetricsCollector,
    config: IExporterConfig,
  ): IOpenMetricsExporter | null {
    if (!this.openMetricsExporterClass) {
      return null;
    }
    try {
      return new this.openMetricsExporterClass(collector, config);
    } catch {
      return null;
    }
  }

  isAvailable(): boolean {
    return (
      this.initialized &&
      !!(this.prometheusExporterClass || this.jsonExporterClass || this.openMetricsExporterClass)
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
