import { Injectable } from "@nestjs/common";
import { IMetricsCollector } from "../interfaces/collector.interface";

/**
 * Custom metrics collector that delegates to a user-provided implementation
 */
@Injectable()
export class CustomMetricsCollector implements IMetricsCollector {
  constructor(private readonly delegate: IMetricsCollector) {}

  increment(metric: string, value?: number, labels?: Record<string, string>): void {
    this.delegate.increment(metric, value, labels);
  }

  decrement(metric: string, value?: number, labels?: Record<string, string>): void {
    this.delegate.decrement(metric, value, labels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    this.delegate.gauge(metric, value, labels);
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    this.delegate.histogram(metric, value, labels);
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    this.delegate.summary(metric, value, labels);
  }
}
