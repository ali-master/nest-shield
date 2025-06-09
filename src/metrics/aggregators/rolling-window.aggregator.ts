import { Injectable } from "@nestjs/common";

interface DataPoint {
  value: number;
  timestamp: number;
}

@Injectable()
export class RollingWindowAggregator {
  private data: Map<string, DataPoint[]> = new Map();
  private windowSize: number;

  constructor(windowSize: number = 300000) {
    // 5 minutes default
    this.windowSize = windowSize;
  }

  addValue(key: string, value: number, timestamp: number = Date.now()): void {
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }

    const points = this.data.get(key)!;
    points.push({ value, timestamp });

    // Remove old data points
    this.cleanup(points, timestamp);
  }

  getAverage(key: string, timestamp: number = Date.now()): number {
    const points = this.getValidPoints(key, timestamp);
    if (points.length === 0) return 0;

    const sum = points.reduce((acc, point) => acc + point.value, 0);
    return sum / points.length;
  }

  getSum(key: string, timestamp: number = Date.now()): number {
    const points = this.getValidPoints(key, timestamp);
    return points.reduce((acc, point) => acc + point.value, 0);
  }

  getCount(key: string, timestamp: number = Date.now()): number {
    return this.getValidPoints(key, timestamp).length;
  }

  getMin(key: string, timestamp: number = Date.now()): number | null {
    const points = this.getValidPoints(key, timestamp);
    if (points.length === 0) return null;

    return Math.min(...points.map((p) => p.value));
  }

  getMax(key: string, timestamp: number = Date.now()): number | null {
    const points = this.getValidPoints(key, timestamp);
    if (points.length === 0) return null;

    return Math.max(...points.map((p) => p.value));
  }

  getPercentile(key: string, percentile: number, timestamp: number = Date.now()): number | null {
    const points = this.getValidPoints(key, timestamp);
    if (points.length === 0) return null;

    const values = points.map((p) => p.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  getRate(key: string, timestamp: number = Date.now()): number {
    const points = this.getValidPoints(key, timestamp);
    if (points.length === 0) return 0;

    const windowSizeInSeconds = this.windowSize / 1000;
    return points.length / windowSizeInSeconds;
  }

  getStandardDeviation(key: string, timestamp: number = Date.now()): number {
    const points = this.getValidPoints(key, timestamp);
    if (points.length === 0) return 0;

    const average = this.getAverage(key, timestamp);
    const squaredDifferences = points.map((p) => (p.value - average) ** 2);
    const variance = squaredDifferences.reduce((acc, diff) => acc + diff, 0) / points.length;

    return Math.sqrt(variance);
  }

  getTrend(key: string, timestamp: number = Date.now()): "increasing" | "decreasing" | "stable" {
    const points = this.getValidPoints(key, timestamp);
    if (points.length < 2) return "stable";

    // Simple linear regression to determine trend
    const n = points.length;
    const sumX = points.reduce((acc, _, index) => acc + index, 0);
    const sumY = points.reduce((acc, point) => acc + point.value, 0);
    const sumXY = points.reduce((acc, point, index) => acc + index * point.value, 0);
    const sumXX = points.reduce((acc, _, index) => acc + index * index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (slope > 0.01) return "increasing";
    if (slope < -0.01) return "decreasing";
    return "stable";
  }

  getStatistics(
    key: string,
    timestamp: number = Date.now(),
  ): {
    count: number;
    sum: number;
    average: number;
    min: number | null;
    max: number | null;
    stdDev: number;
    rate: number;
    trend: "increasing" | "decreasing" | "stable";
    percentiles: {
      p50: number | null;
      p90: number | null;
      p95: number | null;
      p99: number | null;
    };
  } {
    return {
      count: this.getCount(key, timestamp),
      sum: this.getSum(key, timestamp),
      average: this.getAverage(key, timestamp),
      min: this.getMin(key, timestamp),
      max: this.getMax(key, timestamp),
      stdDev: this.getStandardDeviation(key, timestamp),
      rate: this.getRate(key, timestamp),
      trend: this.getTrend(key, timestamp),
      percentiles: {
        p50: this.getPercentile(key, 50, timestamp),
        p90: this.getPercentile(key, 90, timestamp),
        p95: this.getPercentile(key, 95, timestamp),
        p99: this.getPercentile(key, 99, timestamp),
      },
    };
  }

  private getValidPoints(key: string, timestamp: number): DataPoint[] {
    const points = this.data.get(key);
    if (!points) return [];

    this.cleanup(points, timestamp);
    return points.filter((point) => timestamp - point.timestamp <= this.windowSize);
  }

  private cleanup(points: DataPoint[], currentTimestamp: number): void {
    const cutoff = currentTimestamp - this.windowSize;

    while (points.length > 0 && points[0].timestamp < cutoff) {
      points.shift();
    }
  }

  clear(): void {
    this.data.clear();
  }

  clearKey(key: string): void {
    this.data.delete(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.data.keys());
  }
}
