import { Injectable } from "@nestjs/common";

interface MetricData {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<
    string,
    {
      buckets: Record<string, number>;
      sum: number;
      count: number;
    }
  >;
  summaries: Record<
    string,
    {
      quantiles: Record<string, number>;
      sum: number;
      count: number;
    }
  >;
}

@Injectable()
export class CustomMetricsService {
  private metrics: MetricData = {
    counters: {},
    gauges: {},
    histograms: {},
    summaries: {},
  };

  private labels: Record<string, Record<string, string>> = {};

  async incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
  ): Promise<void> {
    const key = this.getMetricKey(name, labels);
    this.metrics.counters[key] = (this.metrics.counters[key] || 0) + value;

    if (labels) {
      this.labels[key] = labels;
    }
  }

  async decrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
  ): Promise<void> {
    const key = this.getMetricKey(name, labels);
    this.metrics.counters[key] = Math.max(0, (this.metrics.counters[key] || 0) - value);

    if (labels) {
      this.labels[key] = labels;
    }
  }

  async setGauge(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const key = this.getMetricKey(name, labels);
    this.metrics.gauges[key] = value;

    if (labels) {
      this.labels[key] = labels;
    }
  }

  async recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): Promise<void> {
    const key = this.getMetricKey(name, labels);

    if (!this.metrics.histograms[key]) {
      this.metrics.histograms[key] = {
        buckets: {},
        sum: 0,
        count: 0,
      };
    }

    const histogram = this.metrics.histograms[key];
    histogram.sum += value;
    histogram.count += 1;

    // Define bucket boundaries
    const buckets = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

    for (const bucket of buckets) {
      const bucketKey = `${bucket}`;
      if (value <= bucket) {
        histogram.buckets[bucketKey] = (histogram.buckets[bucketKey] || 0) + 1;
      }
    }

    // +Inf bucket
    histogram.buckets["+Inf"] = histogram.count;

    if (labels) {
      this.labels[key] = labels;
    }
  }

  async recordSummary(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const key = this.getMetricKey(name, labels);

    if (!this.metrics.summaries[key]) {
      this.metrics.summaries[key] = {
        quantiles: {},
        sum: 0,
        count: 0,
      };
    }

    const summary = this.metrics.summaries[key];
    summary.sum += value;
    summary.count += 1;

    // For simplicity, we'll just approximate quantiles
    // In a real implementation, you'd use a more sophisticated algorithm
    summary.quantiles["0.5"] = value; // Median approximation
    summary.quantiles["0.9"] = value * 1.2;
    summary.quantiles["0.95"] = value * 1.3;
    summary.quantiles["0.99"] = value * 1.5;

    if (labels) {
      this.labels[key] = labels;
    }
  }

  async getFormattedMetrics(
    format: string = "json",
    filters?: Record<string, string>,
  ): Promise<any> {
    let filteredMetrics = this.metrics;

    if (filters) {
      filteredMetrics = this.applyFilters(this.metrics, filters);
    }

    switch (format.toLowerCase()) {
      case "prometheus":
        return this.formatPrometheus(filteredMetrics);
      case "openmetrics":
        return this.formatOpenMetrics(filteredMetrics);
      case "statsd":
        return this.formatStatsd(filteredMetrics);
      case "json":
      default:
        return this.formatJson(filteredMetrics);
    }
  }

  async getAggregatedStats(window: string): Promise<any> {
    const windowMs = this.parseWindow(window);
    const now = Date.now();

    // This is a simplified implementation
    // In a real scenario, you'd track time-series data
    return {
      window,
      windowMs,
      timestamp: now,
      counters: {
        total: Object.values(this.metrics.counters).reduce((sum, val) => sum + val, 0),
        count: Object.keys(this.metrics.counters).length,
      },
      gauges: {
        average:
          Object.values(this.metrics.gauges).reduce((sum, val) => sum + val, 0) /
          Math.max(1, Object.keys(this.metrics.gauges).length),
        min: Math.min(...Object.values(this.metrics.gauges)),
        max: Math.max(...Object.values(this.metrics.gauges)),
        count: Object.keys(this.metrics.gauges).length,
      },
      histograms: {
        totalObservations: Object.values(this.metrics.histograms).reduce(
          (sum, hist) => sum + hist.count,
          0,
        ),
        totalSum: Object.values(this.metrics.histograms).reduce((sum, hist) => sum + hist.sum, 0),
        count: Object.keys(this.metrics.histograms).length,
      },
    };
  }

  async exportMetrics(): Promise<string> {
    return this.formatPrometheus(this.metrics);
  }

  async resetMetrics(): Promise<void> {
    this.metrics = {
      counters: {},
      gauges: {},
      histograms: {},
      summaries: {},
    };
    this.labels = {};
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(",");

    return `${name}{${labelPairs}}`;
  }

  private formatJson(metrics: MetricData): any {
    return {
      ...metrics,
      metadata: {
        timestamp: new Date().toISOString(),
        totalMetrics:
          Object.keys(metrics.counters).length +
          Object.keys(metrics.gauges).length +
          Object.keys(metrics.histograms).length +
          Object.keys(metrics.summaries).length,
      },
    };
  }

  private formatPrometheus(metrics: MetricData): string {
    let output = "";

    // Counters
    for (const [key, value] of Object.entries(metrics.counters)) {
      output += `${key} ${value}\n`;
    }

    // Gauges
    for (const [key, value] of Object.entries(metrics.gauges)) {
      output += `${key} ${value}\n`;
    }

    // Histograms
    for (const [key, histogram] of Object.entries(metrics.histograms)) {
      for (const [bucket, count] of Object.entries(histogram.buckets)) {
        const bucketKey =
          bucket === "+Inf" ? key + '_bucket{le="+Inf"}' : key + `_bucket{le="${bucket}"}`;
        output += `${bucketKey} ${count}\n`;
      }
      output += `${key}_sum ${histogram.sum}\n`;
      output += `${key}_count ${histogram.count}\n`;
    }

    // Summaries
    for (const [key, summary] of Object.entries(metrics.summaries)) {
      for (const [quantile, value] of Object.entries(summary.quantiles)) {
        output += `${key}{quantile="${quantile}"} ${value}\n`;
      }
      output += `${key}_sum ${summary.sum}\n`;
      output += `${key}_count ${summary.count}\n`;
    }

    return output;
  }

  private formatOpenMetrics(metrics: MetricData): string {
    let output = "# OpenMetrics format\n";
    output += "# TYPE counter counter\n";
    output += "# TYPE gauge gauge\n";
    output += "# TYPE histogram histogram\n";
    output += "# TYPE summary summary\n";

    return output + this.formatPrometheus(metrics) + "# EOF\n";
  }

  private formatStatsd(metrics: MetricData): string[] {
    const output: string[] = [];

    // Counters
    for (const [key, value] of Object.entries(metrics.counters)) {
      output.push(`${key}:${value}|c`);
    }

    // Gauges
    for (const [key, value] of Object.entries(metrics.gauges)) {
      output.push(`${key}:${value}|g`);
    }

    // Histograms (as timing metrics)
    for (const [key, histogram] of Object.entries(metrics.histograms)) {
      const avg = histogram.count > 0 ? histogram.sum / histogram.count : 0;
      output.push(`${key}:${avg}|ms`);
    }

    return output;
  }

  private applyFilters(metrics: MetricData, filters: Record<string, string>): MetricData {
    const filtered: MetricData = {
      counters: {},
      gauges: {},
      histograms: {},
      summaries: {},
    };

    const matchesFilter = (key: string): boolean => {
      return Object.entries(filters).every(([filterKey, filterValue]) => {
        return key.includes(`${filterKey}="${filterValue}"`);
      });
    };

    // Filter each metric type
    for (const [key, value] of Object.entries(metrics.counters)) {
      if (matchesFilter(key)) {
        filtered.counters[key] = value;
      }
    }

    for (const [key, value] of Object.entries(metrics.gauges)) {
      if (matchesFilter(key)) {
        filtered.gauges[key] = value;
      }
    }

    for (const [key, value] of Object.entries(metrics.histograms)) {
      if (matchesFilter(key)) {
        filtered.histograms[key] = value;
      }
    }

    for (const [key, value] of Object.entries(metrics.summaries)) {
      if (matchesFilter(key)) {
        filtered.summaries[key] = value;
      }
    }

    return filtered;
  }

  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 5 * 60 * 1000; // Default 5 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 5 * 60 * 1000;
    }
  }
}
