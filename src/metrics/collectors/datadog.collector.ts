import { Injectable } from "@nestjs/common";
import { StatsDCollector } from "./statsd.collector";
import { ICollectorConfig } from "../interfaces/collector.interface";

interface DatadogConfig extends ICollectorConfig {
  host?: string;
  port?: number;
  apiKey?: string;
  appKey?: string;
  site?: string;
  env?: string;
  service?: string;
  version?: string;
  globalTags?: string[];
}

@Injectable()
export class DatadogCollector extends StatsDCollector {
  private datadogConfig: DatadogConfig;

  constructor(config: DatadogConfig) {
    // Datadog uses StatsD protocol with extensions
    super({
      ...config,
      host: config.host || "localhost",
      port: config.port || 8125,
      globalTags: [
        ...(config.globalTags || []),
        config.env && `env:${config.env}`,
        config.service && `service:${config.service}`,
        config.version && `version:${config.version}`,
      ].filter(Boolean) as string[],
    });

    this.datadogConfig = config;
  }

  // Datadog-specific metric types
  distribution(metric: string, value: number, labels?: Record<string, string>): void {
    const tags = this.formatTags(labels);
    const message = `${this.config.prefix || ""}${metric}:${value}|d${tags}`;
    this.addToBuffer(message);
  }

  event(
    title: string,
    text: string,
    options?: {
      timestamp?: number;
      hostname?: string;
      aggregationKey?: string;
      priority?: "normal" | "low";
      sourceTypeName?: string;
      alertType?: "error" | "warning" | "info" | "success";
      tags?: string[];
    },
  ): void {
    const timestamp = options?.timestamp || Date.now();
    const priority = options?.priority || "normal";
    const alertType = options?.alertType || "info";
    const tags = options?.tags?.join(",") || "";

    let message = `_e{${title.length},${text.length}}:${title}|${text}`;

    if (options?.hostname) {
      message += `|h:${options.hostname}`;
    }
    if (options?.aggregationKey) {
      message += `|k:${options.aggregationKey}`;
    }
    if (options?.sourceTypeName) {
      message += `|s:${options.sourceTypeName}`;
    }

    message += `|t:${alertType}|p:${priority}|d:${Math.floor(timestamp / 1000)}`;

    if (tags) {
      message += `|#${tags}`;
    }

    this.addToBuffer(message);
  }

  serviceCheck(
    name: string,
    status: 0 | 1 | 2 | 3, // OK, WARNING, CRITICAL, UNKNOWN
    options?: {
      timestamp?: number;
      hostname?: string;
      message?: string;
      tags?: string[];
    },
  ): void {
    const timestamp = options?.timestamp || Date.now();
    let message = `_sc|${name}|${status}`;

    if (options?.timestamp) {
      message += `|d:${Math.floor(timestamp / 1000)}`;
    }
    if (options?.hostname) {
      message += `|h:${options.hostname}`;
    }
    if (options?.tags) {
      message += `|#${options.tags.join(",")}`;
    }
    if (options?.message) {
      message += `|m:${options.message}`;
    }

    this.addToBuffer(message);
  }

  // Datadog-specific methods use the inherited protected methods from StatsDCollector
}
