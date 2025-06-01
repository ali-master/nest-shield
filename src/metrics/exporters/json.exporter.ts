import { Injectable } from "@nestjs/common";
import { IMetricsExporter, IExporterConfig } from "../interfaces/exporter.interface";
import { BaseMetricsCollector } from "../collectors/base.collector";

@Injectable()
export class JsonExporter implements IMetricsExporter {
  readonly contentType = "application/json";

  constructor(
    private readonly collector: BaseMetricsCollector,
    private readonly config: IExporterConfig = { format: "json" },
  ) {}

  async export(): Promise<string> {
    const data = await this.exportJson();
    return JSON.stringify(data, null, 2);
  }

  async exportJson(): Promise<any> {
    const metrics = Array.from(this.collector.getMetrics().values());

    const grouped = this.config.groupByName ? this.groupByName(metrics) : metrics;

    return {
      timestamp: Date.now(),
      format: "json",
      metrics: grouped,
    };
  }

  private groupByName(metrics: any[]): any {
    const grouped: any = {};

    metrics.forEach((metric) => {
      if (!grouped[metric.name]) {
        grouped[metric.name] = {
          type: metric.type,
          values: [],
        };
      }

      grouped[metric.name].values.push({
        value: metric.value,
        labels: metric.labels,
        timestamp: metric.timestamp,
      });
    });

    return grouped;
  }
}
