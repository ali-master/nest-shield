import { Injectable } from "@nestjs/common";
import { IMetricsExporter, IExporterConfig } from "../interfaces/exporter.interface";
import { PrometheusCollector } from "../collectors/prometheus.collector";
import { MetricType } from "../interfaces/metrics.interface";

@Injectable()
export class OpenMetricsExporter implements IMetricsExporter {
  readonly contentType = "application/openmetrics-text; version=1.0.0; charset=utf-8";

  constructor(
    private readonly collector: PrometheusCollector,
    private readonly config: IExporterConfig = { format: "openmetrics" },
  ) {}

  async export(): Promise<string> {
    const lines: string[] = [];
    const groupedMetrics = new Map<string, any[]>();

    // Group metrics by name
    this.collector.getMetrics().forEach((metric, key) => {
      const baseName = metric.name;
      if (!groupedMetrics.has(baseName)) {
        groupedMetrics.set(baseName, []);
      }
      groupedMetrics.get(baseName)!.push({ ...metric, key });
    });

    // Format each metric group
    groupedMetrics.forEach((metrics, name) => {
      const firstMetric = metrics[0];

      // Add HELP and TYPE lines
      if (firstMetric.description) {
        lines.push(`# HELP ${name} ${firstMetric.description}`);
      }
      lines.push(`# TYPE ${name} ${this.mapMetricType(firstMetric.type)}`);

      // Add unit if specified
      if (firstMetric.unit) {
        lines.push(`# UNIT ${name} ${firstMetric.unit}`);
      }

      // Add metric values with timestamps
      metrics.forEach((metric) => {
        const labelStr = this.formatLabels(metric.labels);
        const value = this.formatValue(metric);
        const timestamp = this.config.includeTimestamp
          ? ` ${Math.floor(metric.timestamp / 1000)}`
          : "";

        if (metric.type === MetricType.HISTOGRAM) {
          this.formatHistogram(lines, name, metric, labelStr, timestamp);
        } else if (metric.type === MetricType.SUMMARY) {
          this.formatSummary(lines, name, metric, labelStr, timestamp);
        } else {
          lines.push(`${name}${labelStr} ${value}${timestamp}`);
        }
      });
    });

    // Add EOF marker for OpenMetrics
    lines.push("# EOF");

    return lines.join("\\n") + "\\n";
  }

  async exportJson(): Promise<any> {
    const metrics = Array.from(this.collector.getMetrics().values());

    return {
      timestamp: Date.now(),
      format: "openmetrics",
      metrics: metrics.map((metric) => ({
        name: metric.name,
        type: metric.type,
        value: metric.value,
        labels: metric.labels,
        timestamp: metric.timestamp,
        unit: (metric as any).unit,
      })),
    };
  }

  private mapMetricType(type: MetricType): string {
    switch (type) {
      case MetricType.COUNTER:
        return "counter";
      case MetricType.GAUGE:
        return "gauge";
      case MetricType.HISTOGRAM:
        return "histogram";
      case MetricType.SUMMARY:
        return "summary";
      default:
        return "unknown";
    }
  }

  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "";
    }

    const pairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${this.escapeLabel(value)}"`)
      .join(",");

    return `{${pairs}}`;
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\\\/g, "\\\\\\\\").replace(/"/g, '\\\\"').replace(/\\n/g, "\\\\n");
  }

  private formatValue(metric: any): string {
    if (metric.type === MetricType.HISTOGRAM || metric.type === MetricType.SUMMARY) {
      return metric.count || "0";
    }
    return metric.value.toString();
  }

  private formatHistogram(
    lines: string[],
    name: string,
    metric: any,
    labelStr: string,
    timestamp: string,
  ): void {
    const values = metric.values || [];
    const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

    buckets.forEach((bucket) => {
      const count = values.filter((v: number) => v <= bucket).length;
      const bucketLabels = labelStr
        ? labelStr.slice(0, -1) + `,le="${bucket}"}`
        : `{le="${bucket}"}`;
      lines.push(`${name}_bucket${bucketLabels} ${count}${timestamp}`);
    });

    // +Inf bucket
    const infLabels = labelStr ? labelStr.slice(0, -1) + ',le="+Inf"}' : '{le="+Inf"}';
    lines.push(`${name}_bucket${infLabels} ${values.length}${timestamp}`);

    // Sum and count
    lines.push(`${name}_sum${labelStr} ${metric.sum || 0}${timestamp}`);
    lines.push(`${name}_count${labelStr} ${metric.count || 0}${timestamp}`);
  }

  private formatSummary(
    lines: string[],
    name: string,
    metric: any,
    labelStr: string,
    timestamp: string,
  ): void {
    const percentiles = [0.5, 0.9, 0.95, 0.99];
    const values = (metric.values || []).sort((a: number, b: number) => a - b);

    if (values.length > 0) {
      percentiles.forEach((percentile) => {
        const index = Math.ceil(percentile * values.length) - 1;
        const value = values[Math.max(0, index)];
        const quantileLabels = labelStr
          ? labelStr.slice(0, -1) + `,quantile="${percentile}"}`
          : `{quantile="${percentile}"}`;
        lines.push(`${name}${quantileLabels} ${value}${timestamp}`);
      });
    }

    lines.push(`${name}_sum${labelStr} ${metric.sum || 0}${timestamp}`);
    lines.push(`${name}_count${labelStr} ${metric.count || 0}${timestamp}`);
  }
}
