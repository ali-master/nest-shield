import { IMetric } from "./metrics.interface";

export interface IMetricsExporter {
  export(): Promise<string>;
  exportJson(): Promise<any>;
  contentType: string;
}

export interface IExporterConfig {
  format: "prometheus" | "json" | "openmetrics" | "statsd";
  includeTimestamp?: boolean;
  includeHelp?: boolean;
  groupByName?: boolean;
}
