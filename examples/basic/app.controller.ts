import { Controller, Get, Post, Body } from "@nestjs/common";
import {
  Shield,
  RateLimit,
  Throttle,
  CircuitBreaker,
  Priority,
  BypassShield,
  QuickRateLimit,
  QuickThrottle,
  ProtectEndpoint,
  ShieldContext,
  RateLimitInfo,
  ThrottleInfo,
} from "@usex/nest-shield";

@Controller()
@Shield({
  rateLimit: { enabled: true, points: 1000, duration: 60 },
  throttle: { enabled: true, limit: 100, ttl: 60 },
})
export class AppController {
  @Get()
  @QuickRateLimit(10, 60) // 10 requests per 60 seconds
  getHello(): string {
    return "Hello World!";
  }

  @Get("status")
  @BypassShield() // Bypass all protection for health checks
  getStatus(): { status: string } {
    return { status: "ok" };
  }

  @Post("api/data")
  @Shield({
    rateLimit: { points: 50, duration: 60 },
    throttle: { limit: 20, ttl: 60 },
    circuitBreaker: {
      enabled: true,
      timeout: 5000,
      errorThresholdPercentage: 25,
    },
    priority: 8, // High priority
  })
  async processData(@Body() data: any): Promise<any> {
    // Simulate some processing
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { processed: true, data };
  }

  @Get("limited")
  @RateLimit({ points: 5, duration: 60, blockDuration: 120 })
  getLimitedResource(): string {
    return "This is a limited resource";
  }

  @Get("throttled")
  @Throttle({ limit: 3, ttl: 60 })
  getThrottledResource(): string {
    return "This is a throttled resource";
  }

  @Post("critical")
  @Priority(10) // Critical priority
  @CircuitBreaker({
    timeout: 1000,
    errorThresholdPercentage: 10,
    fallback: (error, args, context) => {
      return { error: "Service temporarily unavailable", fallback: true };
    },
  })
  async criticalOperation(@Body() data: any): Promise<any> {
    // Simulate critical operation
    if (Math.random() > 0.8) {
      throw new Error("Random failure");
    }
    return { success: true, data };
  }

  @Get("protected")
  @ProtectEndpoint({
    rateLimit: { points: 20, duration: 60 },
    throttle: { limit: 10, ttl: 60 },
    circuitBreaker: { timeout: 2000, errorThreshold: 30 },
    overload: true,
    priority: 7,
  })
  getProtectedResource(
    @ShieldContext() context: any,
    @RateLimitInfo() rateLimitInfo: any,
    @ThrottleInfo() throttleInfo: any,
  ): any {
    return {
      message: "Protected resource accessed",
      shield: {
        ip: context?.ip,
        path: context?.path,
        priority: context?.metadata?.priority,
      },
      rateLimit: rateLimitInfo,
      throttle: throttleInfo,
    };
  }

  @Post("batch")
  @Shield({
    overload: {
      enabled: true,
      maxConcurrentRequests: 5,
      maxQueueSize: 20,
      queueTimeout: 10000,
      shedStrategy: "priority",
    },
  })
  async batchProcess(@Body() items: any[]): Promise<any> {
    // Simulate batch processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      processed: items.length,
      timestamp: new Date().toISOString(),
    };
  }
}
