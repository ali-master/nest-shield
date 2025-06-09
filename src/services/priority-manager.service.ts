import { Injectable, Inject } from "@nestjs/common";
import { SHIELD_MODULE_OPTIONS } from "../core/constants";
import type {
  IRequestPriorityConfig,
  IProtectionContext,
  IPriorityLevel,
} from "../interfaces/shield-config.interface";
import type { MetricsService } from "./metrics.service";

interface PriorityQueue {
  level: IPriorityLevel;
  currentRequests: number;
  queuedRequests: number;
  processedRequests: number;
  rejectedRequests: number;
  lastProcessedTime: number;
}

@Injectable()
export class PriorityManagerService {
  private readonly config: IRequestPriorityConfig;
  private readonly priorityQueues: Map<number, PriorityQueue> = new Map();
  private readonly defaultPriorityLevel: IPriorityLevel;

  constructor(
    @Inject(SHIELD_MODULE_OPTIONS) private readonly options: any,
    private readonly metricsService: MetricsService,
  ) {
    this.config = this.options.advanced?.requestPriority || {
      enabled: false,
      defaultPriority: 5,
      priorityLevels: this.createDefaultPriorityLevels(),
    };

    this.defaultPriorityLevel = {
      name: "default",
      value: this.config.defaultPriority,
      maxConcurrent: 100,
      maxQueueSize: 1000,
      timeout: 30000,
    };

    this.initializePriorityQueues();
  }

  private createDefaultPriorityLevels(): IPriorityLevel[] {
    return [
      { name: "critical", value: 10, maxConcurrent: 200, maxQueueSize: 500, timeout: 60000 },
      { name: "high", value: 8, maxConcurrent: 150, maxQueueSize: 1000, timeout: 45000 },
      { name: "normal", value: 5, maxConcurrent: 100, maxQueueSize: 2000, timeout: 30000 },
      { name: "low", value: 3, maxConcurrent: 50, maxQueueSize: 3000, timeout: 20000 },
      { name: "background", value: 1, maxConcurrent: 20, maxQueueSize: 5000, timeout: 10000 },
    ];
  }

  private initializePriorityQueues(): void {
    const levels = this.config.priorityLevels || this.createDefaultPriorityLevels();

    for (const level of levels) {
      this.priorityQueues.set(level.value, {
        level,
        currentRequests: 0,
        queuedRequests: 0,
        processedRequests: 0,
        rejectedRequests: 0,
        lastProcessedTime: Date.now(),
      });
    }
  }

  extractPriority(context: IProtectionContext): number {
    if (!this.config.enabled) {
      return this.config.defaultPriority;
    }

    if (this.config.priorityExtractor) {
      const priority = this.config.priorityExtractor(context);
      return this.validatePriority(priority);
    }

    if (this.config.priorityHeader) {
      const headerValue = context.headers[this.config.priorityHeader.toLowerCase()];
      if (headerValue) {
        const priority = parseInt(headerValue, 10);
        if (!isNaN(priority)) {
          return this.validatePriority(priority);
        }
      }
    }

    if (context.metadata?.priority !== undefined) {
      return this.validatePriority(context.metadata.priority);
    }

    return this.config.defaultPriority;
  }

  private validatePriority(priority: number): number {
    const validPriorities = Array.from(this.priorityQueues.keys());

    if (validPriorities.includes(priority)) {
      return priority;
    }

    const closest = validPriorities.reduce((prev, curr) =>
      Math.abs(curr - priority) < Math.abs(prev - priority) ? curr : prev,
    );

    return closest;
  }

  canAcceptRequest(priority: number): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return true;
    }

    const { level, currentRequests, queuedRequests } = queue;

    if (currentRequests >= (level.maxConcurrent || 100)) {
      if (queuedRequests >= (level.maxQueueSize || 1000)) {
        this.metricsService.increment("priority_request_rejected", 1, {
          priority: String(priority),
          reason: "queue_full",
        });
        queue.rejectedRequests++;
        return false;
      }
    }

    return true;
  }

  acquireSlot(priority: number): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return true;
    }

    const { level, currentRequests } = queue;

    if (currentRequests < (level.maxConcurrent || 100)) {
      queue.currentRequests++;
      queue.lastProcessedTime = Date.now();

      this.metricsService.gauge("priority_current_requests", queue.currentRequests, {
        priority: String(priority),
      });

      return true;
    }

    return false;
  }

  releaseSlot(priority: number): void {
    if (!this.config.enabled) {
      return;
    }

    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return;
    }

    queue.currentRequests = Math.max(0, queue.currentRequests - 1);
    queue.processedRequests++;

    this.metricsService.gauge("priority_current_requests", queue.currentRequests, {
      priority: String(priority),
    });

    this.metricsService.increment("priority_requests_processed", 1, {
      priority: String(priority),
    });
  }

  enqueue(priority: number): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return true;
    }

    const { level, queuedRequests } = queue;

    if (queuedRequests < (level.maxQueueSize || 1000)) {
      queue.queuedRequests++;

      this.metricsService.gauge("priority_queued_requests", queue.queuedRequests, {
        priority: String(priority),
      });

      return true;
    }

    return false;
  }

  dequeue(priority: number): void {
    if (!this.config.enabled) {
      return;
    }

    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return;
    }

    queue.queuedRequests = Math.max(0, queue.queuedRequests - 1);

    this.metricsService.gauge("priority_queued_requests", queue.queuedRequests, {
      priority: String(priority),
    });
  }

  getTimeout(priority: number): number {
    if (!this.config.enabled) {
      return 30000;
    }

    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return this.defaultPriorityLevel.timeout || 30000;
    }

    return queue.level.timeout || 30000;
  }

  getPriorityLevel(priority: number): IPriorityLevel {
    const queue = this.priorityQueues.get(priority);
    return queue ? queue.level : this.defaultPriorityLevel;
  }

  getStats(): Map<number, PriorityQueue> {
    return new Map(this.priorityQueues);
  }

  getAggregateStats(): {
    totalCurrentRequests: number;
    totalQueuedRequests: number;
    totalProcessedRequests: number;
    totalRejectedRequests: number;
    priorityBreakdown: Array<{
      priority: number;
      name: string;
      current: number;
      queued: number;
      processed: number;
      rejected: number;
      utilization: number;
    }>;
  } {
    let totalCurrentRequests = 0;
    let totalQueuedRequests = 0;
    let totalProcessedRequests = 0;
    let totalRejectedRequests = 0;
    const priorityBreakdown: any[] = [];

    for (const [priority, queue] of this.priorityQueues) {
      totalCurrentRequests += queue.currentRequests;
      totalQueuedRequests += queue.queuedRequests;
      totalProcessedRequests += queue.processedRequests;
      totalRejectedRequests += queue.rejectedRequests;

      priorityBreakdown.push({
        priority,
        name: queue.level.name,
        current: queue.currentRequests,
        queued: queue.queuedRequests,
        processed: queue.processedRequests,
        rejected: queue.rejectedRequests,
        utilization: queue.level.maxConcurrent
          ? (queue.currentRequests / queue.level.maxConcurrent) * 100
          : 0,
      });
    }

    return {
      totalCurrentRequests,
      totalQueuedRequests,
      totalProcessedRequests,
      totalRejectedRequests,
      priorityBreakdown: priorityBreakdown.sort((a, b) => b.priority - a.priority),
    };
  }

  adjustPriorityLimits(
    priority: number,
    adjustment: {
      maxConcurrent?: number;
      maxQueueSize?: number;
      timeout?: number;
    },
  ): void {
    const queue = this.priorityQueues.get(priority);
    if (!queue) {
      return;
    }

    if (adjustment.maxConcurrent !== undefined) {
      queue.level.maxConcurrent = adjustment.maxConcurrent;
    }

    if (adjustment.maxQueueSize !== undefined) {
      queue.level.maxQueueSize = adjustment.maxQueueSize;
    }

    if (adjustment.timeout !== undefined) {
      queue.level.timeout = adjustment.timeout;
    }

    this.metricsService.increment("priority_limits_adjusted", 1, {
      priority: String(priority),
    });
  }

  resetStats(): void {
    for (const queue of this.priorityQueues.values()) {
      queue.processedRequests = 0;
      queue.rejectedRequests = 0;
    }
  }
}
