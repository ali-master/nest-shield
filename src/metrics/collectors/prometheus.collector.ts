import { Injectable } from "@nestjs/common";
import { BaseMetricsCollector } from "./base.collector";
import { ICollectorConfig } from "../interfaces/collector.interface";
import { MetricType } from "../interfaces/metrics.interface";

@Injectable()
export class PrometheusCollector extends BaseMetricsCollector {
  private registry: Map<string, any> = new Map();

  constructor(config: ICollectorConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    // Prometheus is pull-based, no connection needed
  }

  async disconnect(): Promise<void> {
    // No connection to close
  }

  async flush(): Promise<void> {
    // Prometheus is pull-based, no flush needed
  }

  getPrometheusFormat(): string {
    const lines: string[] = [];
    const groupedMetrics = new Map<string, any[]>();

    // Group metrics by name
    this.metrics.forEach((metric, key) => {
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

      // Add metric values
      metrics.forEach((metric) => {
        const labelStr = this.formatLabels(metric.labels);
        const value = this.formatValue(metric);

        if (metric.type === MetricType.HISTOGRAM) {
          this.formatHistogram(lines, name, metric, labelStr);
        } else if (metric.type === MetricType.SUMMARY) {
          this.formatSummary(lines, name, metric, labelStr);
        } else {
          lines.push(`${name}${labelStr} ${value}`);
        }
      });
    });

    return lines.join("\\n") + "\\n";
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
        return "untyped";
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

  private formatHistogram(lines: string[], name: string, metric: any, labelStr: string): void {
    const buckets = this.config.buckets || [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ];

    const values = metric.values || [];
    let cumulativeCount = 0;

    buckets.forEach((bucket) => {
      const count = values.filter((v: number) => v <= bucket).length;
      cumulativeCount = count;
      const bucketLabels = labelStr
        ? labelStr.slice(0, -1) + `,le="${bucket}"}`
        : `{le="${bucket}"}`;
      lines.push(`${name}_bucket${bucketLabels} ${count}`);
    });

    // +Inf bucket
    const infLabels = labelStr ? labelStr.slice(0, -1) + ',le="+Inf"}' : '{le="+Inf"}';
    lines.push(`${name}_bucket${infLabels} ${values.length}`);

    // Sum and count
    lines.push(`${name}_sum${labelStr} ${metric.sum || 0}`);
    lines.push(`${name}_count${labelStr} ${metric.count || 0}`);
  }

  private formatSummary(lines: string[], name: string, metric: any, labelStr: string): void {
    const percentiles = this.config.percentiles || [0.5, 0.9, 0.95, 0.99];
    const values = (metric.values || []).sort((a: number, b: number) => a - b);

    if (values.length > 0) {
      percentiles.forEach((percentile) => {
        const index = Math.ceil(percentile * values.length) - 1;
        const value = values[Math.max(0, index)];
        const quantileLabels = labelStr
          ? labelStr.slice(0, -1) + `,quantile="${percentile}"}`
          : `{quantile="${percentile}"}`;
        lines.push(`${name}${quantileLabels} ${value}`);
      });
    }

    lines.push(`${name}_sum${labelStr} ${metric.sum || 0}`);
    lines.push(`${name}_count${labelStr} ${metric.count || 0}`);
  }
}
