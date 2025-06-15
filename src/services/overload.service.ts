import { Injectable, Inject } from "@nestjs/common";
import type {
  IProtectionResult,
  IProtectionContext,
  IOverloadConfig,
} from "../interfaces/shield-config.interface";
import { ShedStrategy } from "../core/constants";
import { DI_TOKENS } from "../core/di-tokens";
import { OverloadException } from "../core/exceptions";
import type { IMetricsCollector } from "../interfaces";

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
  private processingStats = {
    totalProcessed: 0,
    averageProcessingTime: 0,
    lastProcessingTime: 0,
    queueWaitTimes: [] as number[],
  };

  constructor(
    @Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: any,
    @Inject(DI_TOKENS.METRICS_SERVICE) private readonly metricsService: IMetricsCollector,
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
      this.metricsService.gauge("overload_current_requests", this.currentRequests);
      this.metricsService.increment("overload_requests_accepted");

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
      this.metricsService.increment("overload_queue_full");
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
    this.metricsService.gauge("overload_current_requests", this.currentRequests);

    // Process queue immediately to handle waiting requests
    setImmediate(() => this.processQueue());
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

      // Calculate adaptive timeout based on current queue processing speed
      const adaptiveTimeout = this.calculateAdaptiveTimeout(config);

      if (adaptiveTimeout > 0) {
        queueItem.timeoutId = setTimeout(() => {
          this.removeFromQueue(queueItem);
          this.metricsService.increment("overload_queue_timeout");

          const waitTime = Date.now() - queueItem.timestamp;
          this.metricsService.histogram("overload_queue_timeout_duration", waitTime);

          reject(
            new OverloadException("Request timeout in queue", {
              queueTimeout: adaptiveTimeout,
              waitTime,
              queueLength: this.queue.length,
              currentRequests: this.currentRequests,
            }),
          );
        }, adaptiveTimeout);
      }

      this.queue.push(queueItem);
      this.sortQueue(config);

      this.metricsService.gauge("overload_queue_length", this.queue.length);
      this.metricsService.increment("overload_requests_queued");
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const maxConcurrent = this.getMaxConcurrentRequests(this.globalConfig);
    const processStartTime = Date.now();

    while (this.currentRequests < maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }

      const waitTime = Date.now() - item.timestamp;

      // Update processing statistics
      this.updateProcessingStats(waitTime);

      this.currentRequests++;
      this.metricsService.gauge("overload_current_requests", this.currentRequests);
      this.metricsService.gauge("overload_queue_length", this.queue.length);
      this.metricsService.histogram("overload_queue_wait_time", waitTime);

      item.resolve({
        allowed: true,
        metadata: {
          queueWaitTime: waitTime,
          queueLength: this.queue.length,
          currentRequests: this.currentRequests,
          processingTime: Date.now() - processStartTime,
        },
      });
    }
  }

  private removeFromQueue(item: QueueItem): void {
    const index = this.queue.indexOf(item);
    if (index > -1) {
      this.queue.splice(index, 1);
      this.metricsService.gauge("overload_queue_length", this.queue.length);
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

      // Factor in queue processing efficiency
      const processingEfficiency =
        this.processingStats.averageProcessingTime > 0
          ? Math.max(0, 1 - this.processingStats.averageProcessingTime / 30000) // Normalize against 30s
          : 1;

      this.healthScore = Math.max(
        0,
        (1 - Math.max(utilizationRate, queuePressure)) * processingEfficiency,
      );
    }

    this.metricsService.gauge("overload_health_score", this.healthScore);
    this.metricsService.gauge(
      "overload_processing_efficiency",
      this.processingStats.averageProcessingTime > 0
        ? this.processingStats.averageProcessingTime
        : 0,
    );
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

      this.metricsService.gauge("overload_adaptive_threshold", this.adaptiveThreshold);
    }, config.adjustmentInterval);
  }

  async forceRelease(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      this.release();
    }
  }

  private calculateAdaptiveTimeout(config: IOverloadConfig): number {
    const baseTimeout = config.queueTimeout || 30000;

    // If no processing history, use base timeout
    if (this.processingStats.totalProcessed === 0) {
      return baseTimeout;
    }

    // Calculate current queue processing efficiency
    const avgWaitTime =
      this.processingStats.queueWaitTimes.length > 0
        ? this.processingStats.queueWaitTimes.reduce((sum, time) => sum + time, 0) /
          this.processingStats.queueWaitTimes.length
        : 0;

    // If average wait time is very low, we can use shorter timeouts
    if (avgWaitTime < 1000) {
      // Less than 1 second average wait
      return Math.max(baseTimeout * 0.5, 5000); // At least 5 seconds
    }

    // If average wait time is high, increase timeout proportionally
    if (avgWaitTime > 10000) {
      // More than 10 seconds average wait
      const multiplier = Math.min(avgWaitTime / 10000, 3); // Cap at 3x multiplier
      return Math.min(baseTimeout * multiplier, 120000); // Cap at 2 minutes
    }

    // For normal processing times, use a timeout that's 2x the average wait time
    const adaptiveTimeout = Math.max(avgWaitTime * 2, baseTimeout * 0.5);
    return Math.min(adaptiveTimeout, baseTimeout * 2); // Don't exceed 2x base timeout
  }

  private updateProcessingStats(waitTime: number): void {
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessingTime = waitTime;

    // Keep rolling window of last 100 wait times for adaptive calculations
    this.processingStats.queueWaitTimes.push(waitTime);
    if (this.processingStats.queueWaitTimes.length > 100) {
      this.processingStats.queueWaitTimes.shift();
    }

    // Update average processing time with exponential smoothing
    const alpha = 0.1; // Smoothing factor
    this.processingStats.averageProcessingTime =
      this.processingStats.averageProcessingTime === 0
        ? waitTime
        : alpha * waitTime + (1 - alpha) * this.processingStats.averageProcessingTime;
  }

  clearQueue(): void {
    const clearedCount = this.queue.length;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        if (item.timeoutId) {
          clearTimeout(item.timeoutId);
        }
        item.reject(new OverloadException("Queue cleared"));
      }
    }
    this.metricsService.gauge("overload_queue_length", 0);
    this.metricsService.increment("overload_queue_cleared", clearedCount);
  }

  private assessQueueHealth(config: IOverloadConfig): {
    status: "healthy" | "degraded" | "unhealthy";
    metrics: {
      queueUtilization: number;
      avgWaitTime: number;
      processingRate: number;
      timeoutRate: number;
    };
  } {
    const maxQueueSize = config.maxQueueSize || 1000;
    const queueUtilization = this.queue.length / maxQueueSize;

    const avgWaitTime =
      this.processingStats.queueWaitTimes.length > 0
        ? this.processingStats.queueWaitTimes.reduce((sum, time) => sum + time, 0) /
          this.processingStats.queueWaitTimes.length
        : 0;

    // Calculate processing rate (requests per second)
    const processingRate =
      this.processingStats.totalProcessed > 0
        ? this.processingStats.totalProcessed /
          ((Date.now() - this.processingStats.totalProcessed * 1000) / 1000)
        : 0;

    // Estimate timeout rate based on current wait times vs timeout threshold
    const timeoutThreshold = this.calculateAdaptiveTimeout(config);
    const timeoutRate =
      this.processingStats.queueWaitTimes.filter((time) => time > timeoutThreshold).length /
      Math.max(this.processingStats.queueWaitTimes.length, 1);

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (queueUtilization > 0.9 || avgWaitTime > 20000 || timeoutRate > 0.5) {
      status = "unhealthy";
    } else if (queueUtilization > 0.7 || avgWaitTime > 10000 || timeoutRate > 0.2) {
      status = "degraded";
    }

    return {
      status,
      metrics: {
        queueUtilization,
        avgWaitTime,
        processingRate,
        timeoutRate,
      },
    };
  }

  // New method to help with load testing and recovery
  getProcessingStats() {
    return {
      ...this.processingStats,
      queueHealth: this.assessQueueHealth(this.globalConfig),
      adaptiveTimeout: this.calculateAdaptiveTimeout(this.globalConfig),
    };
  }

  // Emergency method to reset processing stats (useful during incidents)
  resetProcessingStats(): void {
    this.processingStats = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      queueWaitTimes: [],
    };
    this.metricsService.increment("overload_stats_reset");
  }
}
