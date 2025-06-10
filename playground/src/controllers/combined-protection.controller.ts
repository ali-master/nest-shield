import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import {
  Shield,
  ProtectEndpoint,
  Priority,
  ShieldContext,
  ShieldMetrics,
  RateLimitInfo,
  ThrottleInfo,
  CircuitBreakerInfo,
  OverloadInfo,
} from "nest-shield";
import type {
  IProtectionContext,
  IRateLimitInfo,
  IThrottleInfo,
  ICircuitBreakerInfo,
  IOverloadInfo,
  IShieldMetrics,
} from "nest-shield";
import { MockExternalService } from "../services/mock-external.service";
import { TestService } from "../services/test.service";

@Controller("combined")
export class CombinedProtectionController {
  constructor(
    private readonly mockService: MockExternalService,
    private readonly testService: TestService,
  ) {}

  @Get("full-protection")
  @Shield({
    rateLimit: { points: 10, duration: 60, blockDuration: 120 },
    throttle: { limit: 5, ttl: 30 },
    circuitBreaker: { timeout: 2000, errorThresholdPercentage: 40 },
    overload: { maxConcurrentRequests: 3, maxQueueSize: 2 },
    priority: 7,
  })
  async fullProtection(
    @ShieldContext() context: IProtectionContext,
    @ShieldMetrics() metrics: IShieldMetrics,
    @RateLimitInfo() rateLimitInfo: IRateLimitInfo,
    @ThrottleInfo() throttleInfo: IThrottleInfo,
    @CircuitBreakerInfo() circuitBreakerInfo: ICircuitBreakerInfo,
    @OverloadInfo() overloadInfo: IOverloadInfo,
  ) {
    const result = await this.testService.processRequest({ operation: "combined-protection" });

    return {
      message: "Full combined protection active",
      result,
      protectionInfo: {
        rateLimit: rateLimitInfo,
        throttle: throttleInfo,
        circuitBreaker: circuitBreakerInfo,
        overload: overloadInfo,
        metrics,
      },
      context: {
        ip: context.ip,
        userAgent: context.userAgent,
        path: context.path,
        method: context.method,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("selective-protection")
  @Shield({
    rateLimit: { points: 20, duration: 60 },
    circuitBreaker: { timeout: 3000, errorThresholdPercentage: 60 },
  })
  async selectiveProtection(
    @Body() body: { operation: string; shouldFail?: boolean },
    @RateLimitInfo() rateLimitInfo: IRateLimitInfo,
    @CircuitBreakerInfo() circuitBreakerInfo: ICircuitBreakerInfo,
  ) {
    if (body.shouldFail) {
      throw new Error("Simulated failure for testing");
    }

    const result = await this.testService.processRequest({
      operation: body.operation || "selective",
    });

    return {
      message: "Selective protection (rate limit + circuit breaker)",
      operation: body.operation,
      result,
      protectionInfo: {
        rateLimit: rateLimitInfo,
        circuitBreaker: circuitBreakerInfo,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("high-priority")
  @Priority(10)
  @Shield({
    rateLimit: { points: 50, duration: 60 },
    throttle: { limit: 20, ttl: 30 },
    overload: { maxConcurrentRequests: 10, maxQueueSize: 5 },
  })
  async highPriorityEndpoint(
    @ShieldContext() context: IProtectionContext,
    @OverloadInfo() overloadInfo: IOverloadInfo,
  ) {
    const result = await this.testService.processRequest({ operation: "high-priority" });

    return {
      message: "High priority endpoint with generous limits",
      priority: 10,
      result,
      overloadInfo,
      context: {
        ip: context.ip,
        path: context.path,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("quick-protect/:level")
  quickProtect(@Query("level") level: string = "medium") {
    const configs = {
      low: { points: 100, duration: 60, timeout: 5000 },
      medium: { points: 50, duration: 60, timeout: 3000 },
      high: { points: 10, duration: 60, timeout: 1000 },
    };

    const config = configs[level as keyof typeof configs] || configs.medium;

    return {
      message: `Quick protection level: ${level}`,
      config,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("adaptive-protection")
  @Shield({
    rateLimit: {
      points: 15,
      duration: 60,
      keyGenerator: (context: IProtectionContext) => {
        const priority = context.headers["x-priority"] || "normal";
        const multiplier = priority === "high" ? 2 : priority === "low" ? 0.5 : 1;
        return `adaptive:${context.ip}:${Math.floor(15 * multiplier)}`;
      },
    },
    throttle: {
      limit: 8,
      ttl: 30,
      keyGenerator: (context: IProtectionContext) => {
        const userType = context.headers["x-user-type"] || "standard";
        return `throttle:${userType}:${context.ip}`;
      },
    },
  })
  async adaptiveProtection(
    @Body() body: { userType?: string; priority?: string },
    @ShieldContext() context: IProtectionContext,
    @RateLimitInfo() rateLimitInfo: IRateLimitInfo,
    @ThrottleInfo() throttleInfo: IThrottleInfo,
  ) {
    const result = await this.testService.processRequest({ operation: "adaptive" });

    return {
      message: "Adaptive protection based on user context",
      userType: body.userType || "standard",
      priority: body.priority || "normal",
      result,
      protectionInfo: {
        rateLimit: rateLimitInfo,
        throttle: throttleInfo,
      },
      headers: {
        priority: context.headers["x-priority"],
        userType: context.headers["x-user-type"],
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health-check")
  async healthCheck(
    @ShieldMetrics() metrics: IShieldMetrics,
    @OverloadInfo() overloadInfo: IOverloadInfo,
  ) {
    const systemHealth = {
      status: "healthy",
      load: overloadInfo?.currentRequests || 0,
      queueLength: overloadInfo?.queueLength || 0,
      healthScore: overloadInfo?.healthScore || 1.0,
    };

    return {
      message: "System health check",
      health: systemHealth,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("stress-test")
  @Shield({
    rateLimit: { points: 5, duration: 10 },
    throttle: { limit: 3, ttl: 5 },
    circuitBreaker: { timeout: 1000, errorThresholdPercentage: 30 },
    overload: { maxConcurrentRequests: 2, maxQueueSize: 1 },
  })
  async stressTest(
    @Body() body: { intensity?: number; duration?: number },
    @ShieldContext() context: IProtectionContext,
    @RateLimitInfo() rateLimitInfo: IRateLimitInfo,
    @ThrottleInfo() throttleInfo: IThrottleInfo,
    @CircuitBreakerInfo() circuitBreakerInfo: ICircuitBreakerInfo,
    @OverloadInfo() overloadInfo: IOverloadInfo,
  ) {
    const intensity = body.intensity || 1;
    const duration = body.duration || 1000;

    const result = await this.mockService.heavyComputationOperation();

    return {
      message: "Stress test with tight protection limits",
      testParams: { intensity, duration },
      result,
      protectionInfo: {
        rateLimit: rateLimitInfo,
        throttle: throttleInfo,
        circuitBreaker: circuitBreakerInfo,
        overload: overloadInfo,
      },
      context: {
        ip: context.ip,
        path: context.path,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
