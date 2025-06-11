import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Shield, QuickRateLimit, BypassShield } from "@usex/nest-shield/decorators";

@ApiTags("Basic")
@Controller("basic")
export class BasicController {
  @Get()
  @Shield({
    rateLimit: { points: 10, duration: 60 },
    throttle: { limit: 5, ttl: 30 },
  })
  @ApiOperation({
    summary: "Basic protected endpoint",
    description: `
      Demonstrates basic NestShield protection with both rate limiting and throttling.
      
      **Protection Configuration:**
      - Rate Limit: 10 requests per minute (fixed window)
      - Throttle: 5 requests per 30 seconds (token bucket)
      
      **Test this endpoint by:**
      1. Send multiple rapid requests to see throttling in action
      2. Wait and send more requests to test rate limiting
      3. Observe different HTTP status codes (200, 429) based on protection triggers
    `,
  })
  @ApiResponse({
    status: 200,
    description: "Request successful",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "This endpoint is protected with basic rate limiting and throttling",
        },
        timestamp: { type: "string", format: "date-time" },
        protection: {
          type: "string",
          example: "Rate limit: 10 requests/minute, Throttle: 5 requests/30s",
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: "Rate limit or throttle limit exceeded",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 429 },
        message: { type: "string", example: "Rate limit exceeded" },
        error: { type: "string", example: "Too Many Requests" },
      },
    },
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
  @ApiOperation({
    summary: "Quick rate limit protection",
    description: `
      Demonstrates NestShield's @QuickRateLimit decorator for simple rate limiting.
      
      **Protection Configuration:**
      - Quick Rate Limit: 5 requests per minute
      - Simpler configuration than full @Shield decorator
      
      **Use case:** Perfect for simple endpoints that need basic rate limiting without complex configuration.
    `,
  })
  @ApiResponse({
    status: 200,
    description: "Request successful",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "This endpoint uses quick rate limiting" },
        timestamp: { type: "string", format: "date-time" },
        protection: { type: "string", example: "Quick rate limit: 5 requests/minute" },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: "Rate limit exceeded",
  })
  quickProtection() {
    return {
      message: "This endpoint uses quick rate limiting",
      timestamp: new Date().toISOString(),
      protection: "Quick rate limit: 5 requests/minute",
    };
  }

  @Get("bypass")
  @BypassShield()
  @ApiOperation({
    summary: "Bypassed endpoint (no protection)",
    description: `
      Demonstrates the @BypassShield decorator that completely disables NestShield protection.
      
      **Use case:** 
      - Health check endpoints
      - Public endpoints that don't need protection
      - Debugging and development endpoints
      
      **Note:** This endpoint will never trigger rate limits or other protections.
    `,
  })
  @ApiResponse({
    status: 200,
    description: "Request always successful (no protection)",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "This endpoint bypasses all protection" },
        timestamp: { type: "string", format: "date-time" },
        protection: { type: "string", example: "No protection - bypassed" },
      },
    },
  })
  bypassedEndpoint() {
    return {
      message: "This endpoint bypasses all protection",
      timestamp: new Date().toISOString(),
      protection: "No protection - bypassed",
    };
  }

  @Get("health")
  @ApiOperation({
    summary: "Health check endpoint",
    description: `
      Simple health check endpoint that shows server status and uptime.
      
      **Note:** This endpoint has no explicit protection configuration, 
      so it uses the global protection settings (if any).
    `,
  })
  @ApiResponse({
    status: 200,
    description: "Server health information",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "healthy" },
        timestamp: { type: "string", format: "date-time" },
        uptime: { type: "number", example: 3600.5 },
      },
    },
  })
  healthCheck() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
