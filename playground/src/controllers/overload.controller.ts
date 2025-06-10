import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { Overload, Priority, ShieldContext, OverloadInfo } from "nest-shield/decorators";
import type { IProtectionContext } from "nest-shield/interfaces";
import { MockExternalService } from "../services/mock-external.service";

@Controller("overload")
export class OverloadController {
  constructor(private readonly mockService: MockExternalService) {}

  @Get("basic")
  @Overload({ maxConcurrentRequests: 3, maxQueueSize: 2 })
  async basicOverloadProtection(@OverloadInfo() overloadInfo: any) {
    await this.mockService.slowOperation(2000);
    return {
      message: "Basic overload protection (max 3 concurrent, queue 2)",
      overloadInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("strict")
  @Overload({ maxConcurrentRequests: 1, maxQueueSize: 1, queueTimeout: 3000 })
  async strictOverloadProtection() {
    await this.mockService.heavyComputationOperation();
    return {
      message: "Strict overload protection (max 1 concurrent, queue 1)",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("generous")
  @Overload({ maxConcurrentRequests: 10, maxQueueSize: 20 })
  async generousOverloadProtection() {
    await this.mockService.fastOperation();
    return {
      message: "Generous overload protection (max 10 concurrent, queue 20)",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("priority-high")
  @Priority(10) // High priority
  @Overload({ maxConcurrentRequests: 2, maxQueueSize: 3 })
  async highPriorityEndpoint(@ShieldContext() context: IProtectionContext) {
    await this.mockService.slowOperation(1500);
    return {
      message: "High priority endpoint (priority 10)",
      priority: 10,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("priority-medium")
  @Priority(5) // Medium priority
  @Overload({ maxConcurrentRequests: 2, maxQueueSize: 3 })
  async mediumPriorityEndpoint() {
    await this.mockService.slowOperation(1500);
    return {
      message: "Medium priority endpoint (priority 5)",
      priority: 5,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("priority-low")
  @Priority(1) // Low priority
  @Overload({ maxConcurrentRequests: 2, maxQueueSize: 3 })
  async lowPriorityEndpoint() {
    await this.mockService.slowOperation(1500);
    return {
      message: "Low priority endpoint (priority 1)",
      priority: 1,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("fifo-shedding")
  @Overload({
    maxConcurrentRequests: 2,
    maxQueueSize: 2,
    shedStrategy: "fifo", // First In, First Out
    queueTimeout: 5000,
  })
  async fifoSheddingEndpoint(@Body() body: { duration?: number }) {
    const duration = body.duration || 3000;
    await this.mockService.slowOperation(duration);
    return {
      message: `FIFO shedding strategy (${duration}ms operation)`,
      shedStrategy: "fifo",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("lifo-shedding")
  @Overload({
    maxConcurrentRequests: 2,
    maxQueueSize: 2,
    shedStrategy: "lifo", // Last In, First Out
    queueTimeout: 5000,
  })
  async lifoSheddingEndpoint(@Body() body: { duration?: number }) {
    const duration = body.duration || 3000;
    await this.mockService.slowOperation(duration);
    return {
      message: `LIFO shedding strategy (${duration}ms operation)`,
      shedStrategy: "lifo",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("priority-shedding")
  @Overload({
    maxConcurrentRequests: 2,
    maxQueueSize: 3,
    shedStrategy: "priority",
    priorityFunction: (context) => {
      // Priority based on custom header or default
      const headerPriority = context.headers["x-priority"];
      return headerPriority ? parseInt(headerPriority, 10) : 1;
    },
  })
  async prioritySheddingEndpoint(
    @Body() body: { duration?: number },
    @ShieldContext() context: IProtectionContext,
  ) {
    const duration = body.duration || 3000;
    const priority = context.headers["x-priority"] || "1";

    await this.mockService.slowOperation(duration);
    return {
      message: `Priority shedding strategy (${duration}ms operation)`,
      shedStrategy: "priority",
      requestPriority: priority,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("random-shedding")
  @Overload({
    maxConcurrentRequests: 2,
    maxQueueSize: 2,
    shedStrategy: "random",
    queueTimeout: 4000,
  })
  async randomSheddingEndpoint() {
    await this.mockService.slowOperation(2500);
    return {
      message: "Random shedding strategy",
      shedStrategy: "random",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-shedding")
  @Overload({
    maxConcurrentRequests: 2,
    maxQueueSize: 3,
    shedStrategy: "custom",
    customShedFunction: (queue) => {
      // Custom shedding: remove requests from users with 'bot' in user agent
      return queue.filter((item) => !item.context.userAgent.toLowerCase().includes("bot"));
    },
  })
  async customSheddingEndpoint(@ShieldContext() context: IProtectionContext) {
    await this.mockService.slowOperation(2000);
    return {
      message: "Custom shedding strategy (removes bot requests first)",
      shedStrategy: "custom",
      userAgent: context.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("adaptive-threshold")
  @Overload({
    maxConcurrentRequests: 5,
    adaptiveThreshold: {
      enabled: true,
      minThreshold: 2,
      maxThreshold: 10,
      adjustmentInterval: 10000, // 10 seconds
      targetLatency: 1000, // 1 second target
    },
  })
  async adaptiveThresholdEndpoint(@Query("delay") delay: string = "500") {
    const delayMs = parseInt(delay, 10) || 500;
    await this.mockService.slowOperation(delayMs);
    return {
      message: "Adaptive threshold overload protection",
      delay: delayMs,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health-indicator")
  @Overload({
    maxConcurrentRequests: 3,
    healthIndicator: async () => {
      // Simulate system health check
      const cpuUsage = Math.random();
      const memoryUsage = Math.random();
      return Math.max(cpuUsage, memoryUsage); // Return worse of CPU/memory usage
    },
  })
  async healthIndicatorEndpoint() {
    await this.mockService.slowOperation(1000);
    return {
      message: "Overload protection with health indicator",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("stress-test")
  @Overload({
    maxConcurrentRequests: 3,
    maxQueueSize: 5,
    queueTimeout: 2000,
  })
  async stressTestEndpoint(@Query("workers") workers: string = "1") {
    const workerCount = Math.min(parseInt(workers, 10) || 1, 10);

    // Simulate multiple concurrent operations
    const promises = Array.from({ length: workerCount }, (_, i) =>
      this.mockService.slowOperation(1000 + Math.random() * 1000),
    );

    const results = await Promise.allSettled(promises);

    return {
      message: `Stress test with ${workerCount} workers`,
      workers: workerCount,
      results: results.map((result, index) => ({
        worker: index + 1,
        status: result.status,
        ...(result.status === "fulfilled"
          ? { data: result.value }
          : { error: result.reason.message }),
      })),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("queue-info")
  async getQueueInfo(@OverloadInfo() overloadInfo: any) {
    return {
      message: "Current queue information",
      overloadInfo,
      timestamp: new Date().toISOString(),
    };
  }
}
