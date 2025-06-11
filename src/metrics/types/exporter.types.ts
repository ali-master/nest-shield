import type { IBaseMetricsCollector } from "./collector.types";

export interface IMetricsExporter {
  export: () => Promise<string>;
  exportJson?: () => Promise<Record<string, unknown>>;
}

export interface IPrometheusExporter extends IMetricsExporter {
  format: "prometheus";
}

export interface IJsonExporter extends IMetricsExporter {
  format: "json";
  exportJson: () => Promise<Record<string, unknown>>;
}

export interface IOpenMetricsExporter extends IMetricsExporter {
  format: "openmetrics";
}

export interface IExporterConfig {
  format: "prometheus" | "json" | "openmetrics";
  includeTimestamp?: boolean;
  includeHelp?: boolean;
  groupByName?: boolean;
  [key: string]: unknown;
}

export interface IExporterFactory {
  createPrometheusExporter: (
    collector: IBaseMetricsCollector,
    config: IExporterConfig,
  ) => IPrometheusExporter | null;

  createJsonExporter: (
    collector: IBaseMetricsCollector,
    config: IExporterConfig,
  ) => IJsonExporter | null;

  createOpenMetricsExporter: (
    collector: IBaseMetricsCollector,
    config: IExporterConfig,
  ) => IOpenMetricsExporter | null;
}

// Type-safe constructor interfaces
export interface PrometheusExporterConstructor {
  new (collector: IBaseMetricsCollector, config: IExporterConfig): IPrometheusExporter;
}

export interface JsonExporterConstructor {
  new (collector: IBaseMetricsCollector, config: IExporterConfig): IJsonExporter;
}

export interface OpenMetricsExporterConstructor {
  new (collector: IBaseMetricsCollector, config: IExporterConfig): IOpenMetricsExporter;
}

export type ExporterFormat = "prometheus" | "json" | "openmetrics";

export interface IExportResult {
  format: ExporterFormat;
  data: string | Record<string, unknown>;
  timestamp: number;
  error?: string;
}
