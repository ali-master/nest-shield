import { Injectable, Logger } from "@nestjs/common";
import * as dgram from "dgram";
import { BaseMetricsCollector } from "./base.collector";
import { ICollectorConfig } from "../interfaces/collector.interface";
import { MetricType } from "../interfaces/metrics.interface";

interface StatsDConfig extends ICollectorConfig {
  host?: string;
  port?: number;
  globalTags?: string[];
  errorHandler?: (error: Error) => void;
}

@Injectable()
export class StatsDCollector extends BaseMetricsCollector {
  private readonly logger = new Logger(StatsDCollector.name);
  private client?: dgram.Socket;
  private buffer: string[] = [];
  private flushTimer?: NodeJS.Timeout;
  private statsdConfig: StatsDConfig;

  constructor(config: StatsDConfig) {
    super(config);
    this.statsdConfig = {
      host: "localhost",
      port: 8125,
      flushInterval: 1000,
      maxBufferSize: 100,
      ...config,
    };
  }

  async connect(): Promise<void> {
    this.client = dgram.createSocket("udp4");

    this.client.on("error", (error) => {
      this.logger.error("StatsD client error:", error);
      if (this.statsdConfig.errorHandler) {
        this.statsdConfig.errorHandler(error);
      }
    });

    // Start flush timer
    this.startFlushTimer();
  }

  async disconnect(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();

    if (this.client) {
      this.client.close();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error("Failed to flush metrics:", error);
      });
    }, this.statsdConfig.flushInterval || 1000);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const messages = [...this.buffer];
    this.buffer = [];

    const packet = messages.join("\\n");
    await this.send(packet);
  }

  private async send(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("StatsD client not connected"));
        return;
      }

      const buffer = Buffer.from(message);
      this.client.send(
        buffer,
        0,
        buffer.length,
        this.statsdConfig.port,
        this.statsdConfig.host,
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  }

  protected addToBuffer(message: string): void {
    this.buffer.push(message);

    if (this.buffer.length >= (this.statsdConfig.maxBufferSize || 100)) {
      this.flush().catch((error) => {
        this.logger.error("Failed to flush buffer:", error);
      });
    }
  }

  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    super.increment(metric, value, labels);
    const tags = this.formatTags(labels);
    const message = `${this.config.prefix || ""}${metric}:${value}|c${tags}`;
    this.addToBuffer(message);
  }

  decrement(metric: string, value: number = 1, labels?: Record<string, string>): void {
    this.increment(metric, -value, labels);
  }

  gauge(metric: string, value: number, labels?: Record<string, string>): void {
    super.gauge(metric, value, labels);
    const tags = this.formatTags(labels);
    const message = `${this.config.prefix || ""}${metric}:${value}|g${tags}`;
    this.addToBuffer(message);
  }

  histogram(metric: string, value: number, labels?: Record<string, string>): void {
    super.histogram(metric, value, labels);
    const tags = this.formatTags(labels);
    const message = `${this.config.prefix || ""}${metric}:${value}|h${tags}`;
    this.addToBuffer(message);
  }

  summary(metric: string, value: number, labels?: Record<string, string>): void {
    super.summary(metric, value, labels);
    const tags = this.formatTags(labels);
    // StatsD typically uses timing for summary-like metrics
    const message = `${this.config.prefix || ""}${metric}:${value}|ms${tags}`;
    this.addToBuffer(message);
  }

  timing(metric: string, value: number, labels?: Record<string, string>): void {
    const tags = this.formatTags(labels);
    const message = `${this.config.prefix || ""}${metric}:${value}|ms${tags}`;
    this.addToBuffer(message);
  }

  set(metric: string, value: string | number, labels?: Record<string, string>): void {
    const tags = this.formatTags(labels);
    const message = `${this.config.prefix || ""}${metric}:${value}|s${tags}`;
    this.addToBuffer(message);
  }

  protected formatTags(labels?: Record<string, string>): string {
    const tags: string[] = [...(this.statsdConfig.globalTags || [])];

    if (labels) {
      Object.entries(labels).forEach(([key, value]) => {
        tags.push(`${key}:${value}`);
      });
    }

    if (this.config.labels) {
      Object.entries(this.config.labels).forEach(([key, value]) => {
        tags.push(`${key}:${value}`);
      });
    }

    return tags.length > 0 ? `|#${tags.join(",")}` : "";
  }
}
