import { Controller, Get, Post, Body, Query, Headers } from "@nestjs/common";
import {
  Shield,
  Priority,
  CircuitBreakerService,
  RateLimitService,
  OverloadService,
  DistributedSyncService,
  GracefulShutdownService,
  PriorityManagerService,
  ShieldContext,
  CircuitBreakerInfo,
  OverloadInfo,
  IProtectionContext,
} from "../../src";

@Controller("api/v2")
export class AdvancedController {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly rateLimitService: RateLimitService,
    private readonly overloadService: OverloadService,
    private readonly distributedSyncService: DistributedSyncService,
    private readonly gracefulShutdownService: GracefulShutdownService,
    private readonly priorityManagerService: PriorityManagerService,
  ) {}

  @Get("analytics")
  @Shield({
    rateLimit: { points: 100, duration: 3600 }, // 100 requests per hour
    circuitBreaker: {
      enabled: true,
      timeout: 10000,
      fallback: async (error, args, context) => {
        // Return cached data on circuit breaker open
        return {
          cached: true,
          data: await this.getCachedAnalytics(),
          error: "Using cached data due to service issues",
        };
      },
    },
  })
  async getAnalytics(
    @Query("from") from: string,
    @Query("to") to: string,
    @CircuitBreakerInfo() cbInfo: any,
  ): Promise<any> {
    // Simulate analytics calculation
    const result = await this.circuitBreakerService.execute(
      "analytics-service",
      async () => {
        // Simulate external service call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (Math.random() > 0.9) {
          throw new Error("Analytics service error");
        }

        return {
          from,
          to,
          metrics: {
            users: Math.floor(Math.random() * 10000),
            sessions: Math.floor(Math.random() * 50000),
            pageviews: Math.floor(Math.random() * 100000),
          },
        };
      },
      {} as IProtectionContext,
    );

    return {
      ...result,
      circuitBreaker: cbInfo,
    };
  }

  @Post("process/batch")
  @Priority(7)
  @Shield({
    overload: {
      enabled: true,
      maxConcurrentRequests: 10,
      maxQueueSize: 50,
      shedStrategy: "priority",
    },
  })
  async processBatch(
    @Body() items: any[],
    @ShieldContext() context: IProtectionContext,
    @OverloadInfo() overloadInfo: any,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Process items in batches
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((item) => this.processItem(item)));
        results.push(...batchResults);
      }

      return {
        processed: results.length,
        duration: Date.now() - startTime,
        overload: overloadInfo,
        priority: context.metadata?.priority,
      };
    } finally {
      // Manual release if needed
      // this.overloadService.release();
    }
  }

  @Get("cluster/status")
  async getClusterStatus(): Promise<any> {
    const nodes = this.distributedSyncService.getActiveNodes();
    const isLeader = this.distributedSyncService.isLeader();
    const nodeId = this.distributedSyncService.getNodeId();
    const shutdownStatus = this.gracefulShutdownService.getShutdownStatus();

    return {
      cluster: {
        nodeId,
        isLeader,
        totalNodes: nodes.length,
        nodes: nodes.map((node) => ({
          id: node.id,
          lastHeartbeat: new Date(node.lastHeartbeat).toISOString(),
          metadata: node.metadata,
        })),
      },
      shutdown: shutdownStatus,
      overload: this.overloadService.getStatus(),
      circuitBreakers: this.circuitBreakerService.getAllStats(),
      priorities: this.priorityManagerService.getAggregateStats(),
    };
  }

  @Post("cluster/broadcast")
  @Priority(9)
  async broadcastMessage(@Body() message: any): Promise<any> {
    await this.distributedSyncService.broadcastCustomData({
      type: "custom-message",
      message,
      timestamp: Date.now(),
    });

    return {
      broadcasted: true,
      nodeId: this.distributedSyncService.getNodeId(),
    };
  }

  @Get("dynamic-rate-limit")
  async getDynamicResource(
    @Headers("x-user-tier") userTier: string,
    @ShieldContext() context: IProtectionContext,
  ): Promise<any> {
    // Apply different rate limits based on user tier
    const tierLimits = {
      premium: { points: 1000, duration: 60 },
      standard: { points: 100, duration: 60 },
      free: { points: 10, duration: 60 },
    };

    const limit = tierLimits[userTier] || tierLimits.free;

    // Manually check rate limit
    const result = await this.rateLimitService.consume(context, limit);

    if (!result.allowed) {
      throw new Error("Rate limit exceeded for your tier");
    }

    return {
      tier: userTier || "free",
      limit: result.metadata?.limit,
      remaining: result.metadata?.remaining,
      reset: new Date(result.metadata?.reset || 0).toISOString(),
    };
  }

  @Post("priority-queue")
  async priorityQueueExample(
    @Body() data: any,
    @Headers("x-priority") priority: string,
    @Headers("x-premium-user") isPremium: string,
  ): Promise<any> {
    const numericPriority = parseInt(priority || "5");
    const adjustedPriority =
      isPremium === "true" ? Math.min(numericPriority + 2, 10) : numericPriority;

    // Check if request can be accepted based on priority
    if (!this.priorityManagerService.canAcceptRequest(adjustedPriority)) {
      throw new Error("Queue full for your priority level");
    }

    // Acquire slot
    if (!this.priorityManagerService.acquireSlot(adjustedPriority)) {
      // Enqueue if no slot available
      this.priorityManagerService.enqueue(adjustedPriority);
    }

    try {
      // Process request
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        processed: true,
        priority: adjustedPriority,
        priorityLevel: this.priorityManagerService.getPriorityLevel(adjustedPriority),
        stats: this.priorityManagerService.getAggregateStats(),
      };
    } finally {
      this.priorityManagerService.releaseSlot(adjustedPriority);
    }
  }

  @Post("manual-circuit-breaker")
  async manualCircuitBreaker(@Body() config: any): Promise<any> {
    const key = `manual-${config.service}`;

    // Create custom circuit breaker
    const breaker = this.circuitBreakerService.createBreaker(
      key,
      async () => {
        // Simulate service call
        if (Math.random() > 0.7) {
          throw new Error("Service failure");
        }
        return { success: true, timestamp: Date.now() };
      },
      {
        enabled: true,
        timeout: config.timeout || 3000,
        errorThresholdPercentage: config.errorThreshold || 50,
      },
    );

    try {
      const result = await breaker.fire();
      return {
        result,
        state: this.circuitBreakerService.getState(key),
        stats: this.circuitBreakerService.getStats(key),
      };
    } catch (error) {
      return {
        error: error.message,
        state: this.circuitBreakerService.getState(key),
        stats: this.circuitBreakerService.getStats(key),
      };
    }
  }

  private async processItem(item: any): Promise<any> {
    // Simulate item processing
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { ...item, processed: true };
  }

  private async getCachedAnalytics(): Promise<any> {
    // Simulate cached data retrieval
    return {
      metrics: {
        users: 1000,
        sessions: 5000,
        pageviews: 10000,
      },
      cachedAt: new Date().toISOString(),
    };
  }
}
