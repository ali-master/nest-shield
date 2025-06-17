import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { RateLimit, QuickRateLimit, ShieldContext, RateLimitInfo } from "@usex/nest-shield";
import type { IProtectionContext, IRateLimitInfo } from "@usex/nest-shield";

@ApiTags("Rate Limiting")
@Controller("rate-limit")
export class RateLimitController {
  @Get("strict")
  @RateLimit({ points: 3, duration: 60, blockDuration: 120 })
  @ApiOperation({
    summary: "Strict rate limiting (3 requests/minute)",
    description: `
Demonstrates strict rate limiting with extended block duration.

**Configuration:**
- Points: 3 requests
- Duration: 60 seconds (1 minute window)
- Block Duration: 120 seconds (2 minutes penalty)

**Testing:**
Send 4+ requests rapidly to trigger rate limiting and observe the 2-minute block period.
`,
  })
  @ApiResponse({
    status: 200,
    description: "Request successful with rate limit info",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        rateLimitInfo: {
          type: "object",
          properties: {
            limit: { type: "number" },
            remaining: { type: "number" },
            reset: { type: "number" },
            retryAfter: { type: "number" },
          },
        },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 429, description: "Rate limit exceeded - blocked for 2 minutes" })
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
  @ApiOperation({
    summary: "Custom key rate limiting",
    description: `
Demonstrates custom key generation for rate limiting based on user ID.

**Configuration:**
- Points: 5 requests per user
- Duration: 60 seconds
- Key: Based on X-User-ID header

**Testing:**
1. Send requests with different X-User-ID headers
2. Each user ID gets its own rate limit bucket
3. Test without header (uses "anonymous" key)
`,
  })
  @ApiHeader({
    name: "X-User-ID",
    description: "User identifier for rate limiting",
    required: false,
    schema: { type: "string", example: "user123" },
  })
  @ApiResponse({
    status: 200,
    description: "Request successful",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        userId: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 429, description: "Rate limit exceeded for this user ID" })
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
