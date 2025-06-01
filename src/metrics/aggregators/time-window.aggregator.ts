import { Injectable } from "@nestjs/common";
import { IMetric, MetricType } from "../interfaces/metrics.interface";

interface TimeWindow {
  start: number;
  end: number;
  metrics: IMetric[];
}

@Injectable()
export class TimeWindowAggregator {
  private windows: Map<string, TimeWindow[]> = new Map();
  private windowSize: number;
  private maxWindows: number;

  constructor(windowSize: number = 60000, maxWindows: number = 60) {
    this.windowSize = windowSize; // 1 minute default
    this.maxWindows = maxWindows; // Keep 60 windows (1 hour) default
  }

  addMetric(metric: IMetric): void {
    const key = this.getMetricKey(metric);
    const windows = this.getOrCreateWindows(key);
    const currentWindow = this.getCurrentWindow(windows, metric.timestamp);

    currentWindow.metrics.push(metric);
    this.cleanup(windows);
  }

  getAggregatedMetrics(
    metricName: string,
    labels?: Record<string, string>,
    windowCount: number = 1,
  ): IMetric[] {
    const key = this.getMetricKeyFromName(metricName, labels);
    const windows = this.windows.get(key);

    if (!windows || windows.length === 0) {
      return [];
    }

    const recentWindows = windows.slice(-windowCount);
    const aggregated: IMetric[] = [];

    recentWindows.forEach((window) => {
      const windowMetrics = this.aggregateWindow(window.metrics);
      aggregated.push(...windowMetrics);
    });

    return aggregated;
  }

  getTimeSeriesData(
    metricName: string,
    labels?: Record<string, string>,
    windowCount: number = 60,
  ): Array<{ timestamp: number; value: number; count: number }> {
    const key = this.getMetricKeyFromName(metricName, labels);
    const windows = this.windows.get(key);

    if (!windows || windows.length === 0) {
      return [];
    }

    const recentWindows = windows.slice(-windowCount);

    return recentWindows.map((window) => {
      const aggregated = this.aggregateWindow(window.metrics);
      const totalValue = aggregated.reduce((sum, metric) => sum + metric.value, 0);

      return {
        timestamp: window.start,
        value: totalValue,
        count: window.metrics.length,
      };
    });
  }

  private getMetricKey(metric: IMetric): string {
    return this.getMetricKeyFromName(metric.name, metric.labels);
  }

  private getMetricKeyFromName(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const sortedLabels = Object.keys(labels)
      .sort()
      .map((key) => `${key}="${labels[key]}"`)
      .join(",");

    return `${name}{${sortedLabels}}`;
  }

  private getOrCreateWindows(key: string): TimeWindow[] {
    if (!this.windows.has(key)) {
      this.windows.set(key, []);
    }
    return this.windows.get(key)!;
  }

  private getCurrentWindow(windows: TimeWindow[], timestamp: number): TimeWindow {
    const windowStart = Math.floor(timestamp / this.windowSize) * this.windowSize;
    const windowEnd = windowStart + this.windowSize;

    let currentWindow = windows.find((w) => w.start === windowStart);

    if (!currentWindow) {
      currentWindow = {
        start: windowStart,
        end: windowEnd,
        metrics: [],
      };
      windows.push(currentWindow);
      windows.sort((a, b) => a.start - b.start);
    }

    return currentWindow;
  }

  private cleanup(windows: TimeWindow[]): void {
    if (windows.length > this.maxWindows) {
      windows.splice(0, windows.length - this.maxWindows);
    }
  }

  private aggregateWindow(metrics: IMetric[]): IMetric[] {
    const grouped = new Map<string, IMetric[]>();

    // Group metrics by name and labels
    metrics.forEach((metric) => {
      const key = this.getMetricKey(metric);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    const aggregated: IMetric[] = [];

    grouped.forEach((metricGroup, key) => {
      const first = metricGroup[0];

      switch (first.type) {
        case MetricType.COUNTER:
          aggregated.push(this.aggregateCounter(metricGroup));
          break;
        case MetricType.GAUGE:
          aggregated.push(this.aggregateGauge(metricGroup));
          break;
        case MetricType.HISTOGRAM:
        case MetricType.SUMMARY:
          aggregated.push(this.aggregateDistribution(metricGroup));
          break;
      }
    });

    return aggregated;
  }

  private aggregateCounter(metrics: IMetric[]): IMetric {
    const first = metrics[0];
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);

    return {
      ...first,
      value: sum,
      timestamp: Math.max(...metrics.map((m) => m.timestamp)),
    };
  }

  private aggregateGauge(metrics: IMetric[]): IMetric {
    const first = metrics[0];
    // For gauges, use the most recent value
    const latest = metrics.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest,
    );

    return {
      ...first,
      value: latest.value,
      timestamp: latest.timestamp,
    };
  }

  private aggregateDistribution(metrics: IMetric[]): IMetric {
    const first = metrics[0];
    const allValues: number[] = [];
    let totalSum = 0;
    let totalCount = 0;

    metrics.forEach((metric) => {
      const metricAny = metric as any;
      if (metricAny.values) {
        allValues.push(...metricAny.values);
        totalSum += metricAny.sum || 0;
        totalCount += metricAny.count || 0;
      } else {
        allValues.push(metric.value);
        totalSum += metric.value;
        totalCount += 1;
      }
    });

    return {
      ...first,
      value: totalCount,
      timestamp: Math.max(...metrics.map((m) => m.timestamp)),
      ...(first.type === MetricType.HISTOGRAM || first.type === MetricType.SUMMARY
        ? {
            values: allValues,
            sum: totalSum,
            count: totalCount,
          }
        : {}),
    } as any;
  }
}
