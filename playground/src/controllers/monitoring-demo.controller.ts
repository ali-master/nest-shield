import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from "@nestjs/swagger";
import { Shield } from "@usex/nest-shield";
import { EventEmitter2 } from "@nestjs/event-emitter";

@ApiTags("Monitoring Demo")
@Controller("monitoring-demo")
@Shield()
export class MonitoringDemoController {
  private readonly logger = new Logger(MonitoringDemoController.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Get("system-load")
  @ApiOperation({
    summary: "Simulate system load",
    description: "Generate different types of system load to test monitoring capabilities",
  })
  @ApiQuery({ name: "type", enum: ["cpu", "memory", "io"], required: false })
  @Shield({
    rateLimit: { points: 10, duration: 60 },
    circuitBreaker: { timeout: 5000, errorThresholdPercentage: 50 },
  })
  async simulateSystemLoad(@Query("type") type: string = "cpu") {
    const startTime = Date.now();

    try {
      this.logger.log(`Simulating ${type} load...`);

      switch (type) {
        case "cpu":
          await this.simulateCpuLoad();
          break;
        case "memory":
          await this.simulateMemoryLoad();
          break;
        case "io":
          await this.simulateIoLoad();
          break;
        default:
          await this.simulateCpuLoad();
      }

      const duration = Date.now() - startTime;

      // Emit custom metric event
      this.eventEmitter.emit("metrics.custom.recorded", {
        name: `system_load_${type}`,
        value: duration,
        labels: { type, controller: "monitoring-demo" },
        timestamp: new Date(),
      });

      return {
        success: true,
        type,
        duration,
        message: `Successfully simulated ${type} load for ${duration}ms`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error simulating ${type} load:`, error);

      // Emit error metric
      this.eventEmitter.emit("metrics.error.recorded", {
        name: "system_load_error",
        error: error.message,
        type,
        duration,
        timestamp: new Date(),
      });

      throw new HttpException(
        `Failed to simulate ${type} load: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("trigger-alert/:severity")
  @ApiOperation({
    summary: "Trigger monitoring alert",
    description: "Manually trigger alerts of different severities for testing",
  })
  @ApiParam({ name: "severity", enum: ["low", "medium", "high", "critical"] })
  @Shield({
    rateLimit: { points: 5, duration: 60 },
    throttle: { ttl: 30, limit: 3 },
  })
  async triggerAlert(@Param("severity") severity: string) {
    const validSeverities = ["low", "medium", "high", "critical"];

    if (!validSeverities.includes(severity)) {
      throw new HttpException(
        `Invalid severity. Must be one of: ${validSeverities.join(", ")}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const alertData = {
      type: "manual" as const,
      severity,
      title: `Manual ${severity.toUpperCase()} Alert`,
      message: `This is a manually triggered ${severity} severity alert for testing purposes`,
      metadata: {
        controller: "monitoring-demo",
        endpoint: `/monitoring-demo/trigger-alert/${severity}`,
        triggeredAt: new Date().toISOString(),
        source: "playground",
      },
    };

    // Emit alert creation event
    this.eventEmitter.emit("alert.created", alertData);

    this.logger.warn(`Triggered ${severity} alert manually`, alertData);

    return {
      success: true,
      alert: alertData,
      message: `Successfully triggered ${severity} severity alert`,
    };
  }

  @Get("performance-test")
  @ApiOperation({
    summary: "Performance stress test",
    description: "Generate various response times and error rates for performance monitoring",
  })
  @ApiQuery({ name: "delay", description: "Response delay in milliseconds", required: false })
  @ApiQuery({ name: "error_rate", description: "Error rate percentage (0-100)", required: false })
  @Shield({
    rateLimit: { points: 20, duration: 60 },
    circuitBreaker: { timeout: 10000, errorThresholdPercentage: 30 },
  })
  async performanceTest(
    @Query("delay") delay: string = "0",
    @Query("error_rate") errorRate: string = "0",
  ) {
    const delayMs = Math.max(0, Math.min(10000, parseInt(delay) || 0));
    const errorRatePercent = Math.max(0, Math.min(100, parseInt(errorRate) || 0));

    // Simulate response delay
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Simulate errors based on error rate
    if (Math.random() * 100 < errorRatePercent) {
      throw new HttpException(
        `Simulated error (${errorRatePercent}% error rate)`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const responseData = {
      success: true,
      delay: delayMs,
      errorRate: errorRatePercent,
      timestamp: new Date().toISOString(),
      randomData: this.generateRandomData(),
    };

    // Emit performance metric
    this.eventEmitter.emit("metrics.performance.recorded", {
      name: "performance_test",
      responseTime: delayMs,
      errorRate: errorRatePercent,
      success: true,
      timestamp: new Date(),
    });

    return responseData;
  }

  @Get("websocket-test")
  @ApiOperation({
    summary: "Test WebSocket connectivity",
    description: "Generate events that will be broadcast via WebSocket to connected clients",
  })
  @Shield({
    rateLimit: { points: 15, duration: 60 },
  })
  async websocketTest() {
    const testEvents = [
      {
        type: "metrics.system.updated",
        data: {
          cpu: { usage: Math.random() * 100 },
          memory: { usage: Math.random() * 100 },
          timestamp: new Date(),
        },
      },
      {
        type: "health.service.updated",
        data: {
          service: "playground-api",
          status: Math.random() > 0.8 ? "degraded" : "healthy",
          responseTime: Math.random() * 200 + 50,
          lastCheck: new Date(),
        },
      },
      {
        type: "config.changed",
        data: {
          component: "rate-limit",
          changes: { points: 100, duration: 60 },
          changedBy: "monitoring-demo",
          timestamp: new Date(),
        },
      },
    ];

    // Emit random test event
    const randomEvent = testEvents[Math.floor(Math.random() * testEvents.length)];
    this.eventEmitter.emit(randomEvent.type, randomEvent.data);

    this.logger.log(`Emitted WebSocket test event: ${randomEvent.type}`);

    return {
      success: true,
      eventEmitted: randomEvent.type,
      message: "WebSocket test event emitted successfully",
      eventData: randomEvent.data,
    };
  }

  @Get("health-status")
  @ApiOperation({
    summary: "Get monitoring health status",
    description: "Check the health of monitoring components and WebSocket connections",
  })
  async getHealthStatus() {
    const status = {
      monitoring: {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      websocket: {
        status: "active",
        namespace: "/monitoring",
        port: 3002,
      },
      metrics: {
        collection: "enabled",
        interval: "5s",
        retention: "1000 points",
      },
      alerts: {
        status: "enabled",
        thresholds: {
          cpu: "80%",
          memory: "85%",
          responseTime: "1000ms",
          errorRate: "5%",
        },
      },
      events: {
        emitter: "active",
        maxListeners: 20,
      },
    };

    return status;
  }

  private async simulateCpuLoad(): Promise<void> {
    const duration = Math.random() * 2000 + 500; // 500-2500ms
    const end = Date.now() + duration;

    while (Date.now() < end) {
      // CPU intensive operation
      Math.sqrt(Math.random() * 1000000);
    }
  }

  private async simulateMemoryLoad(): Promise<void> {
    const arrays: number[][] = [];
    const iterations = Math.floor(Math.random() * 100) + 50;

    for (let i = 0; i < iterations; i++) {
      arrays.push(new Array(10000).fill(Math.random()));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Clean up to prevent actual memory leaks
    arrays.length = 0;
  }

  private async simulateIoLoad(): Promise<void> {
    const operations = Math.floor(Math.random() * 50) + 10;

    for (let i = 0; i < operations; i++) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    }
  }

  private generateRandomData() {
    return {
      id: Math.random().toString(36).substr(2, 9),
      value: Math.random() * 1000,
      status: Math.random() > 0.5 ? "active" : "inactive",
      metrics: {
        requests: Math.floor(Math.random() * 1000),
        errors: Math.floor(Math.random() * 50),
        latency: Math.random() * 500,
      },
    };
  }
}
