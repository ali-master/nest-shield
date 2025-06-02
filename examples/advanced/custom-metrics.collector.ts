import { IMetricsCollector } from "../../src";

export class CustomMetricsCollector implements IMetricsCollector {
  private metrics: Map<string, any> = new Map();
  private timers: Map<string, number> = new Map();

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.generateKey(metric, labels);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);

    // Log to console or send to external service
    console.log(`[METRIC] Increment: ${metric} +${value}`, labels);
  }

  decrement(metric: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.generateKey(metric, labels);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, Math.max(0, current - value));

    console.log(`[METRIC] Decrement: ${metric} -${value}`, labels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    const key = this.generateKey(metric, labels);
    this.metrics.set(key, value);

    console.log(`[METRIC] Gauge: ${metric} = ${value}`, labels);
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    const key = this.generateKey(metric, labels);
    const histogram = this.metrics.get(key) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      buckets: new Map(),
    };

    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);

    // Update buckets
    const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    for (const bucket of buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }

    this.metrics.set(key, histogram);
    console.log(`[METRIC] Histogram: ${metric} = ${value}`, labels);
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    const key = this.generateKey(metric, labels);
    const summary = this.metrics.get(key) || { values: [], sum: 0, count: 0 };

    summary.values.push(value);
    summary.sum += value;
    summary.count++;

    // Keep only last 1000 values
    if (summary.values.length > 1000) {
      summary.values.shift();
    }

    this.metrics.set(key, summary);
    console.log(`[METRIC] Summary: ${metric} = ${value}`, labels);
  }

  startTimer(metric: string, labels?: Record<string, string>): () => void {
    const key = this.generateKey(metric, labels);
    const startTime = Date.now();

    return () => {
      const duration = (Date.now() - startTime) / 1000;
      this.histogram(metric, duration, labels);
    };
  }

  private generateKey(metric: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return metric;
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `${metric}{${labelStr}}`;
  }

  // Export metrics in Prometheus format
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const [key, value] of this.metrics) {
      if (typeof value === "number") {
        lines.push(`${key} ${value}`);
      } else if (value.count !== undefined && value.sum !== undefined) {
        // Histogram or Summary
        const baseKey = key.replace(/{.*}/, "");
        const labels = key.match(/{.*}/)?.[0] || "";

        lines.push(`${baseKey}_count${labels} ${value.count}`);
        lines.push(`${baseKey}_sum${labels} ${value.sum}`);

        if (value.min !== undefined) {
          lines.push(`${baseKey}_min${labels} ${value.min}`);
          lines.push(`${baseKey}_max${labels} ${value.max}`);
        }

        if (value.buckets) {
          for (const [bucket, count] of value.buckets) {
            lines.push(
              `${baseKey}_bucket{le="${bucket}"${labels ? "," + labels.slice(1, -1) : ""}} ${count}`,
            );
          }
        }

        if (value.values) {
          // Calculate percentiles for summary
          const sorted = [...value.values].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)];
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const p99 = sorted[Math.floor(sorted.length * 0.99)];

          lines.push(`${baseKey}{quantile="0.5"${labels ? "," + labels.slice(1, -1) : ""}} ${p50}`);
          lines.push(
            `${baseKey}{quantile="0.95"${labels ? "," + labels.slice(1, -1) : ""}} ${p95}`,
          );
          lines.push(
            `${baseKey}{quantile="0.99"${labels ? "," + labels.slice(1, -1) : ""}} ${p99}`,
          );
        }
      }
    }

    return lines.join("\n");
  }

  // Get all metrics as JSON
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of this.metrics) {
      result[key] = value;
    }

    return result;
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.timers.clear();
  }
}
