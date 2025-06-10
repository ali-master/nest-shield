import { Controller, Get } from "@nestjs/common";
import { Shield, QuickRateLimit, BypassShield } from "nest-shield/decorators";

@Controller("basic")
export class BasicController {
  @Get()
  @Shield({
    rateLimit: { points: 10, duration: 60 },
    throttle: { limit: 5, ttl: 30 },
  })
  basicProtection() {
    return {
      message: "This endpoint is protected with basic rate limiting and throttling",
      timestamp: new Date().toISOString(),
      protection: "Rate limit: 10 requests/minute, Throttle: 5 requests/30s",
    };
  }

  @Get("quick")
  @QuickRateLimit(5, 60)
  quickProtection() {
    return {
      message: "This endpoint uses quick rate limiting",
      timestamp: new Date().toISOString(),
      protection: "Quick rate limit: 5 requests/minute",
    };
  }

  @Get("bypass")
  @BypassShield()
  bypassedEndpoint() {
    return {
      message: "This endpoint bypasses all protection",
      timestamp: new Date().toISOString(),
      protection: "No protection - bypassed",
    };
  }

  @Get("health")
  healthCheck() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
