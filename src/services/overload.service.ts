import { Optional, Injectable, Inject } from "@nestjs/common";
import type {
  IProtectionResult,
  IProtectionContext,
  IOverloadConfig,
} from "../interfaces/shield-config.interface";
import { SHIELD_MODULE_OPTIONS, ShedStrategy } from "../core/constants";
import { OverloadException } from "../core/exceptions";
import type { MetricsService } from "./metrics.service";

interface QueueItem {
  context: IProtectionContext;
  priority: number;
  timestamp: number;
  resolve: (value: IProtectionResult) => void;
  reject: (error: any) => void;
  timeoutId?: NodeJS.Timeout;
}

@Injectable()
export class OverloadService {
  private globalConfig: IOverloadConfig;
  private currentRequests = 0;
  private queue: QueueItem[] = [];
  private adaptiveThreshold: number;
  private lastHealthCheck = 0;
  private healthScore = 1;

  constructor(
    @Inject(SHIELD_MODULE_OPTIONS) private readonly options: any,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    this.globalConfig = this.options.overload || {};
    this.adaptiveThreshold = this.globalConfig.maxConcurrentRequests || 1000;

    if (this.globalConfig.adaptiveThreshold?.enabled) {
      this.startAdaptiveThresholdAdjustment();
    }
  }

  async acquire(
    context: IProtectionContext,
    config?: Partial<IOverloadConfig>,
  ): Promise<IProtectionResult> {
    const mergedConfig = { ...this.globalConfig, ...config };

    if (!mergedConfig.enabled) {
      return { allowed: true };
    }

    await this.updateHealthScore(mergedConfig);

    const maxConcurrent = this.getMaxConcurrentRequests(mergedConfig);

    if (this.currentRequests < maxConcurrent) {
      this.currentRequests++;
      this.metricsService?.gauge("overload_current_requests", this.currentRequests);
      this.metricsService?.increment("overload_requests_accepted");

      return {
        allowed: true,
        metadata: {
          queueLength: this.queue.length,
          currentRequests: this.currentRequests,
          maxConcurrent,
          healthScore: this.healthScore,
        },
      };
    }

    const maxQueueSize = mergedConfig.maxQueueSize || 1000;

    if (this.queue.length >= maxQueueSize) {
      this.metricsService?.increment("overload_queue_full");
      throw new OverloadException("Server is overloaded, queue is full", {
        queueLength: this.queue.length,
        maxQueueSize,
        currentRequests: this.currentRequests,
        maxConcurrent,
      });
    }

    return this.enqueue(context, mergedConfig);
  }

  release(): void {
    this.currentRequests = Math.max(0, this.currentRequests - 1);
    this.metricsService?.gauge("overload_current_requests", this.currentRequests);
    this.processQueue();
  }

  getStatus(): {
    currentRequests: number;
    queueLength: number;
    healthScore: number;
    adaptiveThreshold: number;
  } {
    return {
      currentRequests: this.currentRequests,
      queueLength: this.queue.length,
      healthScore: this.healthScore,
      adaptiveThreshold: this.adaptiveThreshold,
    };
  }

  private async enqueue(
    context: IProtectionContext,
    config: IOverloadConfig,
  ): Promise<IProtectionResult> {
    return new Promise((resolve, reject) => {
      const priority = this.calculatePriority(context, config);
      const queueItem: QueueItem = {
        context,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      if (config.queueTimeout) {
        queueItem.timeoutId = setTimeout(() => {
          this.removeFromQueue(queueItem);
          this.metricsService?.increment("overload_queue_timeout");
          reject(
            new OverloadException("Request timeout in queue", {
              queueTimeout: config.queueTimeout,
              waitTime: Date.now() - queueItem.timestamp,
            }),
          );
        }, config.queueTimeout);
      }

      this.queue.push(queueItem);
      this.sortQueue(config);

      this.metricsService?.gauge("overload_queue_length", this.queue.length);
      this.metricsService?.increment("overload_requests_queued");
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const maxConcurrent = this.getMaxConcurrentRequests(this.globalConfig);

    while (this.currentRequests < maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }

      this.currentRequests++;
      this.metricsService?.gauge("overload_current_requests", this.currentRequests);
      this.metricsService?.gauge("overload_queue_length", this.queue.length);
      this.metricsService?.histogram("overload_queue_wait_time", Date.now() - item.timestamp);

      item.resolve({
        allowed: true,
        metadata: {
          queueWaitTime: Date.now() - item.timestamp,
          queueLength: this.queue.length,
          currentRequests: this.currentRequests,
        },
      });
    }
  }

  private removeFromQueue(item: QueueItem): void {
    const index = this.queue.indexOf(item);
    if (index > -1) {
      this.queue.splice(index, 1);
      this.metricsService?.gauge("overload_queue_length", this.queue.length);
    }
  }

  private calculatePriority(context: IProtectionContext, config: IOverloadConfig): number {
    if (config.priorityFunction) {
      return config.priorityFunction(context);
    }

    const priorityHeader = context.headers["x-priority"] || context.headers["x-request-priority"];
    if (priorityHeader) {
      const priority = parseInt(priorityHeader, 10);
      if (!isNaN(priority)) {
        return priority;
      }
    }

    return context.metadata?.priority || 5;
  }

  private sortQueue(config: IOverloadConfig): void {
    switch (config.shedStrategy) {
      case ShedStrategy.PRIORITY:
        this.queue.sort((a, b) => b.priority - a.priority);
        break;

      case ShedStrategy.LIFO:
        this.queue.reverse();
        break;

      case ShedStrategy.RANDOM:
        for (let i = this.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        break;

      case ShedStrategy.CUSTOM:
        if (config.customShedFunction) {
          this.queue = config.customShedFunction(this.queue) as QueueItem[];
        }
        break;

      case ShedStrategy.FIFO:
      default:
        break;
    }
  }

  private getMaxConcurrentRequests(config: IOverloadConfig): number {
    if (config.adaptiveThreshold?.enabled) {
      return Math.floor(this.adaptiveThreshold * this.healthScore);
    }
    return config.maxConcurrentRequests || 1000;
  }

  private async updateHealthScore(config: IOverloadConfig): Promise<void> {
    const now = Date.now();
    const checkInterval = 5000;

    if (now - this.lastHealthCheck < checkInterval) {
      return;
    }

    this.lastHealthCheck = now;

    if (config.healthIndicator) {
      try {
        this.healthScore = await config.healthIndicator();
        this.healthScore = Math.max(0, Math.min(1, this.healthScore));
      } catch {
        this.healthScore = 0.5;
      }
    } else {
      const utilizationRate = this.currentRequests / (config.maxConcurrentRequests || 1000);
      const queuePressure = this.queue.length / (config.maxQueueSize || 1000);
      this.healthScore = 1 - Math.max(utilizationRate, queuePressure);
    }

    this.metricsService?.gauge("overload_health_score", this.healthScore);
  }

  private startAdaptiveThresholdAdjustment(): void {
    const config = this.globalConfig.adaptiveThreshold;
    if (!config) return;

    setInterval(() => {
      const targetUtilization = 0.8;
      const currentUtilization = this.currentRequests / this.adaptiveThreshold;

      if (currentUtilization > targetUtilization && this.queue.length > 0) {
        this.adaptiveThreshold = Math.max(config.minThreshold, this.adaptiveThreshold * 0.9);
      } else if (currentUtilization < targetUtilization * 0.5 && this.queue.length === 0) {
        this.adaptiveThreshold = Math.min(config.maxThreshold, this.adaptiveThreshold * 1.1);
      }

      this.metricsService?.gauge("overload_adaptive_threshold", this.adaptiveThreshold);
    }, config.adjustmentInterval);
  }

  async forceRelease(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      this.release();
    }
  }

  clearQueue(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        if (item.timeoutId) {
          clearTimeout(item.timeoutId);
        }
        item.reject(new OverloadException("Queue cleared"));
      }
    }
    this.metricsService?.gauge("overload_queue_length", 0);
  }
}
