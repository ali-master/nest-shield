import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { healthChecks } from "@/lib/db/schema";
import RedisService from "@/lib/redis";

export async function GET() {
  const startTime = Date.now();
  const healthCheckResult = {
    status: "healthy" as "healthy" | "degraded" | "unhealthy",
    timestamp: new Date().toISOString(),
    services: {} as Record<string, any>,
    summary: {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
    },
  };

  try {
    // Database Health Check
    try {
      await db.select().from(healthChecks).limit(1);
      healthCheckResult.services.database = {
        status: "healthy",
        responseTime: Date.now() - startTime,
        details: {
          connection: "established",
          poolSize: process.env.MAX_CONNECTIONS || "10",
        },
      };
      healthCheckResult.summary.healthy++;
    } catch (error: any) {
      healthCheckResult.services.database = {
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: error.message,
      };
      healthCheckResult.summary.unhealthy++;
      healthCheckResult.status = "degraded";
    }

    // Redis Health Check
    try {
      const redisStart = Date.now();
      const isRedisHealthy = await RedisService.ping();

      if (isRedisHealthy) {
        const redisInfo = await RedisService.getInfo();
        healthCheckResult.services.redis = {
          status: "healthy",
          responseTime: Date.now() - redisStart,
          details: {
            memory: redisInfo.Memory?.used_memory_human || "unknown",
            clients: redisInfo.Clients?.connected_clients || "unknown",
            uptime: redisInfo.Server?.uptime_in_seconds || "unknown",
          },
        };
        healthCheckResult.summary.healthy++;
      } else {
        throw new Error("Redis ping failed");
      }
    } catch (error: any) {
      healthCheckResult.services.redis = {
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: error.message,
      };
      healthCheckResult.summary.unhealthy++;
      healthCheckResult.status = "degraded";
    }

    // NestShield API Health Check
    try {
      const nestShieldStart = Date.now();
      const nestShieldUrl = process.env.NEST_SHIELD_API_URL || "http://localhost:3000";

      const response = await fetch(`${nestShieldUrl}/health`, {
        method: "GET",
      });

      if (response.ok) {
        healthCheckResult.services.nestshield_api = {
          status: "healthy",
          responseTime: Date.now() - nestShieldStart,
          details: {
            url: nestShieldUrl,
            statusCode: response.status,
          },
        };
        healthCheckResult.summary.healthy++;
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error: any) {
      healthCheckResult.services.nestshield_api = {
        status: "degraded",
        responseTime: Date.now() - startTime,
        error: error.message,
      };
      healthCheckResult.summary.degraded++;
      if (healthCheckResult.status === "healthy") {
        healthCheckResult.status = "degraded";
      }
    }

    // System Metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    };

    healthCheckResult.services.system = {
      status: "healthy",
      responseTime: Date.now() - startTime,
      details: systemMetrics,
    };
    healthCheckResult.summary.healthy++;

    // Overall health determination
    if (healthCheckResult.summary.unhealthy > 0) {
      healthCheckResult.status = "unhealthy";
    } else if (healthCheckResult.summary.degraded > 0) {
      healthCheckResult.status = "degraded";
    }

    // Store health check in database
    try {
      await db.insert(healthChecks).values({
        service: "dashboard",
        status: healthCheckResult.status,
        responseTime: Date.now() - startTime,
        details: healthCheckResult,
      });
    } catch (error) {
      console.error("Failed to store health check:", error);
    }

    // Return appropriate HTTP status
    const httpStatus =
      healthCheckResult.status === "healthy"
        ? 200
        : healthCheckResult.status === "degraded"
          ? 206
          : 503;

    return NextResponse.json(healthCheckResult, { status: httpStatus });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime,
      },
      { status: 503 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { message: "Health check endpoint only supports GET requests" },
    { status: 405 },
  );
}
