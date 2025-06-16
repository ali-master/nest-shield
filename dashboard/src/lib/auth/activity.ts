import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import UAParser from "ua-parser-js";

export type ActivityLogData = {
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
};

export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    // Parse user agent for additional device info
    let deviceInfo: Record<string, any> = {};
    if (data.userAgent) {
      const parser = new UAParser(data.userAgent);
      const result = parser.getResult();
      deviceInfo = {
        browser: result.browser.name,
        browserVersion: result.browser.version,
        os: result.os.name,
        osVersion: result.os.version,
        device: result.device.type || "desktop",
        deviceModel: result.device.model,
      };
    }

    await db.insert(activityLogs).values({
      id: Number.parseInt(generateId()),
      userId: data.userId || null,
      sessionId: data.sessionId || null,
      action: data.action,
      resource: data.resource || null,
      resourceId: data.resourceId || null,
      details: data.details ? { ...data.details, deviceInfo } : deviceInfo,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      success: data.success ?? true,
      errorMessage: data.errorMessage || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Log to console if database logging fails
    console.error("Failed to log activity:", error);
  }
}

export async function getUserActivityLogs(userId: string, limit: number = 50, offset: number = 0) {
  return await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getRecentActivity(limit: number = 100) {
  return await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

export async function getFailedLoginAttempts(
  ipAddress?: string,
  timeWindowHours: number = 1,
): Promise<number> {
  const timeAgo = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.action, "login_failed"),
        eq(activityLogs.success, false),
        gte(activityLogs.createdAt, timeAgo),
        ipAddress ? eq(activityLogs.ipAddress, ipAddress) : undefined,
      ),
    );
  return result[0]?.count || 0;
}

export async function getSuspiciousActivities(limit: number = 50) {
  const suspiciousActions = [
    "login_failed",
    "login_blocked_ip",
    "login_blocked_banned",
    "multiple_failed_attempts",
    "unauthorized_access",
    "password_reset_suspicious",
  ];

  return await db
    .select()
    .from(activityLogs)
    .where(
      and(
        sql`${activityLogs.action} IN (${suspiciousActions.map(() => "?").join(",")})`,
        eq(activityLogs.success, false),
      ),
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export async function getActivityStats(
  startDate: Date,
  endDate: Date,
): Promise<{
  totalActivities: number;
  successfulActivities: number;
  failedActivities: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
}> {
  // Total activities
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(and(gte(activityLogs.createdAt, startDate), lte(activityLogs.createdAt, endDate)));

  // Successful activities
  const [successResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        gte(activityLogs.createdAt, startDate),
        lte(activityLogs.createdAt, endDate),
        eq(activityLogs.success, true),
      ),
    );

  // Failed activities
  const [failedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        gte(activityLogs.createdAt, startDate),
        lte(activityLogs.createdAt, endDate),
        eq(activityLogs.success, false),
      ),
    );

  // Unique users
  const [uniqueUsersResult] = await db
    .select({ count: sql<number>`count(distinct ${activityLogs.userId})` })
    .from(activityLogs)
    .where(
      and(
        gte(activityLogs.createdAt, startDate),
        lte(activityLogs.createdAt, endDate),
        isNotNull(activityLogs.userId),
      ),
    );

  // Top actions
  const topActions = await db
    .select({
      action: activityLogs.action,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(activityLogs)
    .where(and(gte(activityLogs.createdAt, startDate), lte(activityLogs.createdAt, endDate)))
    .groupBy(activityLogs.action)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    totalActivities: totalResult?.count || 0,
    successfulActivities: successResult?.count || 0,
    failedActivities: failedResult?.count || 0,
    uniqueUsers: uniqueUsersResult?.count || 0,
    topActions,
  };
}
