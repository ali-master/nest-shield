import { Injectable } from "@nestjs/common";
import { IMetricsExporter, IExporterConfig } from "../interfaces/exporter.interface";
import { PrometheusCollector } from "../collectors/prometheus.collector";

@Injectable()
export class PrometheusExporter implements IMetricsExporter {
  readonly contentType = "text/plain; version=0.0.4; charset=utf-8";

  constructor(
    private readonly collector: PrometheusCollector,
    private readonly config: IExporterConfig = { format: "prometheus" },
  ) {}

  async export(): Promise<string> {
    return this.collector.getPrometheusFormat();
  }

  async exportJson(): Promise<any> {
    const metrics = Array.from(this.collector.getMetrics().values());

    return {
      timestamp: Date.now(),
      metrics: metrics.map((metric) => ({
        name: metric.name,
        type: metric.type,
        value: metric.value,
        labels: metric.labels,
        timestamp: metric.timestamp,
      })),
    };
  }
}
