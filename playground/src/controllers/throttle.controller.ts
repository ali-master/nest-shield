import { Controller, Get, Post, Body, Headers } from "@nestjs/common";
import { Throttle, ShieldContext, ThrottleInfo } from "nest-shield";
import type { IProtectionContext } from "nest-shield";
import type { IThrottleInfo } from "../interfaces/shield-info.interface";

@Controller("throttle")
export class ThrottleController {
  @Get("basic")
  @Throttle({ ttl: 60, limit: 5 })
  basicThrottle(@ThrottleInfo() throttleInfo: IThrottleInfo) {
    return {
      message: "Basic throttling: 5 requests per minute",
      throttleInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("strict")
  @Throttle({ ttl: 10, limit: 1 }) // 1 request per 10 seconds
  strictThrottle() {
    return {
      message: "Strict throttling: 1 request per 10 seconds",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("burst")
  @Throttle({ ttl: 1, limit: 10 }) // 10 requests per second
  burstThrottle() {
    return {
      message: "Burst throttling: 10 requests per second",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-key-user")
  @Throttle({
    ttl: 60,
    limit: 3,
    keyGenerator: (context: IProtectionContext) =>
      `throttle:user:${context.headers["x-user-id"] || "anonymous"}`,
  })
  customKeyUserThrottle(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Throttling per user ID: 3 requests per minute",
      userId: context.headers["x-user-id"] || "anonymous",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-key-endpoint")
  @Throttle({
    ttl: 30,
    limit: 2,
    keyGenerator: (context: IProtectionContext) =>
      `throttle:endpoint:${context.path}:${context.ip}`,
  })
  customKeyEndpointThrottle(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Throttling per endpoint and IP: 2 requests per 30 seconds",
      path: context.path,
      ip: context.ip,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ignore-user-agents")
  @Throttle({
    ttl: 60,
    limit: 5,
    ignoreUserAgents: [/bot/i, /crawler/i, /spider/i],
  })
  ignoreUserAgentsThrottle(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Throttling that ignores bots/crawlers/spiders",
      userAgent: context.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("with-headers")
  @Throttle({
    ttl: 60,
    limit: 3,
    customHeaders: {
      "X-Throttle-Limit": "3",
      "X-Throttle-Window": "60",
    },
  })
  withCustomHeaders() {
    return {
      message: "Throttling with custom response headers",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("method-specific")
  @Throttle({
    ttl: 60,
    limit: 2,
    keyGenerator: (context: IProtectionContext) =>
      `throttle:${context.method}:${context.path}:${context.ip}`,
  })
  methodSpecificThrottle(
    @Body() body: Record<string, any>,
    @ShieldContext() context: IProtectionContext,
  ) {
    return {
      message: "Throttling specific to HTTP method",
      method: context.method,
      body,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("quick/:limit/:ttl")
  quickThrottleDemo(@Headers("x-limit") limit: string = "5", @Headers("x-ttl") ttl: string = "60") {
    const limitNum = parseInt(limit, 10) || 5;
    const ttlNum = parseInt(ttl, 10) || 60;

    return {
      message: `Quick throttling: ${limitNum} requests per ${ttlNum} seconds`,
      config: { limit: limitNum, ttl: ttlNum },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("per-session")
  @Throttle({
    ttl: 300, // 5 minutes
    limit: 10,
    keyGenerator: (context: IProtectionContext) => {
      const sessionId = context.headers["x-session-id"] || context.headers["authorization"];
      return `throttle:session:${sessionId || "anonymous"}`;
    },
  })
  perSessionThrottle(@ShieldContext() context: IProtectionContext) {
    const sessionId = context.headers["x-session-id"] || context.headers["authorization"];

    return {
      message: "Throttling per session: 10 requests per 5 minutes",
      sessionId: sessionId || "anonymous",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("adaptive")
  @Throttle({
    ttl: 60,
    limit: 5,
    customResponseMessage: (context: IProtectionContext) => {
      const remaining = (context as any).throttleInfo?.remaining || 0;
      const resetTime = (context as any).throttleInfo?.resetTime || 0;
      return `Throttle limit exceeded. ${remaining} requests remaining. Reset in ${resetTime}s`;
    },
  })
  adaptiveThrottle() {
    return {
      message: "Adaptive throttling with custom response messages",
      timestamp: new Date().toISOString(),
    };
  }
}
