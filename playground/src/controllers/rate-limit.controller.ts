import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { RateLimit, QuickRateLimit, ShieldContext, RateLimitInfo } from "nest-shield";
import type { IProtectionContext } from "nest-shield";
import type { IRateLimitInfo } from "../interfaces/shield-info.interface";

@Controller("rate-limit")
export class RateLimitController {
  @Get("strict")
  @RateLimit({ points: 3, duration: 60, blockDuration: 120 })
  strictRateLimit(@RateLimitInfo() rateLimitInfo: IRateLimitInfo) {
    return {
      message: "Strict rate limiting: 3 requests per minute",
      rateLimitInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("generous")
  @RateLimit({ points: 100, duration: 60 })
  generousRateLimit() {
    return {
      message: "Generous rate limiting: 100 requests per minute",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("burst")
  @RateLimit({ points: 10, duration: 1 }) // 10 requests per second
  burstRateLimit() {
    return {
      message: "Burst rate limiting: 10 requests per second",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-key")
  @RateLimit({
    points: 5,
    duration: 60,
    keyGenerator: (context: IProtectionContext) =>
      `user:${context.headers["x-user-id"] || "anonymous"}`,
  })
  customKeyRateLimit(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Custom key rate limiting based on X-User-ID header",
      userId: context.headers["x-user-id"] || "anonymous",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("skip-successful")
  @RateLimit({
    points: 3,
    duration: 60,
    skipSuccessfulRequests: true,
  })
  skipSuccessfulRequests(@Body() body: { shouldFail?: boolean }) {
    if (body.shouldFail) {
      throw new Error("Intentional error - this will count towards rate limit");
    }

    return {
      message: "Successful requests are not counted towards rate limit",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("skip-failed")
  @RateLimit({
    points: 3,
    duration: 60,
    skipFailedRequests: true,
  })
  skipFailedRequests(@Body() body: { shouldFail?: boolean }) {
    if (body.shouldFail) {
      throw new Error("Intentional error - this will NOT count towards rate limit");
    }

    return {
      message: "Failed requests are not counted towards rate limit",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("per-ip")
  @RateLimit({
    points: 5,
    duration: 60,
    keyGenerator: (context: IProtectionContext) => `ip:${context.ip}`,
  })
  perIpRateLimit(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Rate limiting per IP address",
      ip: context.ip,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("per-user-agent")
  @RateLimit({
    points: 10,
    duration: 60,
    keyGenerator: (context: IProtectionContext) => `ua:${context.userAgent}`,
  })
  perUserAgentRateLimit(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Rate limiting per User-Agent",
      userAgent: context.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("with-headers")
  @RateLimit({
    points: 5,
    duration: 60,
    customHeaders: {
      "X-Custom-Header": "rate-limited",
      "X-Warning": "Approaching limit",
    },
  })
  withCustomHeaders() {
    return {
      message: "Rate limiting with custom response headers",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("quick/:limit")
  @QuickRateLimit(5, 60)
  quickRateLimit(@Query("limit") limit: string = "5") {
    const limitNum = parseInt(limit, 10) || 5;

    return {
      message: `Quick rate limiting: ${limitNum} requests per minute`,
      limit: limitNum,
      timestamp: new Date().toISOString(),
    };
  }
}
