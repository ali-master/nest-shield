import { db } from "@/lib/db";
import { activityLogs, sessions, users } from "@/lib/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { logActivity } from "@/lib/auth/activity";

// IP Address restrictions and security checks
export type SecurityConfig = {
  allowedIPs?: string[];
  blockedIPs?: string[];
  allowedCountries?: string[];
  blockedCountries?: string[];
  maxFailedAttempts?: number;
  lockoutDurationMinutes?: number;
  requireTwoFactorForAdmin?: boolean;
  sessionTimeoutMinutes?: number;
  requireStrongPasswords?: boolean;
  allowPasswordReuse?: boolean;
  maxPasswordAge?: number;
};

// Default security configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedIPs: [],
  blockedIPs: [],
  allowedCountries: [],
  blockedCountries: [],
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  requireTwoFactorForAdmin: true,
  sessionTimeoutMinutes: 480, // 8 hours
  requireStrongPasswords: true,
  allowPasswordReuse: false,
  maxPasswordAge: 90, // days
};

// Get security configuration (you might want to store this in database)
export function getSecurityConfig(): SecurityConfig {
  // In production, this would come from environment variables or database
  return {
    ...DEFAULT_SECURITY_CONFIG,
    allowedIPs: process.env.ALLOWED_IPS?.split(",") || [],
    blockedIPs: process.env.BLOCKED_IPS?.split(",") || [],
    allowedCountries: process.env.ALLOWED_COUNTRIES?.split(",") || [],
    blockedCountries: process.env.BLOCKED_COUNTRIES?.split(",") || [],
    maxFailedAttempts: Number.parseInt(process.env.MAX_FAILED_ATTEMPTS || "5"),
    lockoutDurationMinutes: Number.parseInt(process.env.LOCKOUT_DURATION_MINUTES || "30"),
    requireTwoFactorForAdmin: process.env.REQUIRE_2FA_ADMIN === "true",
    sessionTimeoutMinutes: Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || "480"),
    requireStrongPasswords: process.env.REQUIRE_STRONG_PASSWORDS !== "false",
    allowPasswordReuse: process.env.ALLOW_PASSWORD_REUSE === "true",
    maxPasswordAge: Number.parseInt(process.env.MAX_PASSWORD_AGE || "90"),
  };
}

export function isIPAllowed(ipAddress: string): boolean {
  const config = getSecurityConfig();

  // Check if IP is explicitly blocked
  if (config.blockedIPs && config.blockedIPs.includes(ipAddress)) {
    return false;
  }

  // Check if there are allowed IPs configured and this IP is not in the list
  if (config.allowedIPs && config.allowedIPs.length > 0) {
    return config.allowedIPs.includes(ipAddress);
  }

  // If no specific IP restrictions, allow by default
  return true;
}

export async function isLocationAllowed(ipAddress: string, userAgent?: string): Promise<boolean> {
  const config = getSecurityConfig();

  // If no country restrictions are configured, allow
  if (
    (!config.allowedCountries || config.allowedCountries.length === 0) &&
    (!config.blockedCountries || config.blockedCountries.length === 0)
  ) {
    return true;
  }

  // In a real implementation, you would use a GeoIP service
  // For now, we'll just return true
  // You could integrate with services like MaxMind GeoIP2, IPinfo, etc.

  try {
    // Placeholder for GeoIP lookup
    // const geoData = await getGeoLocation(ipAddress);
    // const country = geoData.country;

    // Check blocked countries
    // if (config.blockedCountries && config.blockedCountries.includes(country)) {
    //   return false;
    // }

    // Check allowed countries
    // if (config.allowedCountries && config.allowedCountries.length > 0) {
    //   return config.allowedCountries.includes(country);
    // }

    return true;
  } catch (error) {
    console.error("GeoIP lookup failed:", error);
    // In case of error, allow access but log it
    await logActivity({
      action: "geolocation_check_failed",
      ipAddress,
      userAgent,
      success: false,
      errorMessage: "Failed to verify location",
    });
    return true;
  }
}

export async function isUserLockedOut(
  identifier: string,
  identifierType: "email" | "ip" = "email",
): Promise<{ isLocked: boolean; unlockTime?: Date }> {
  const config = getSecurityConfig();
  const timeAgo = new Date(Date.now() - config.lockoutDurationMinutes! * 60 * 1000);

  let whereCondition;
  if (identifierType === "email") {
    // Find user by email
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, identifier))
      .limit(1);

    if (!user) {
      return { isLocked: false };
    }

    whereCondition = and(
      eq(activityLogs.userId, user.id),
      eq(activityLogs.action, "login_failed"),
      eq(activityLogs.success, false),
      gte(activityLogs.createdAt, timeAgo),
    );
  } else {
    whereCondition = and(
      eq(activityLogs.ipAddress, identifier),
      eq(activityLogs.action, "login_failed"),
      eq(activityLogs.success, false),
      gte(activityLogs.createdAt, timeAgo),
    );
  }

  const failedAttempts = await db
    .select({ count: sql<number>`count(*)`, lastAttempt: sql<Date>`max(created_at)` })
    .from(activityLogs)
    .where(whereCondition);

  const count = failedAttempts[0]?.count || 0;
  const lastAttempt = failedAttempts[0]?.lastAttempt;

  if (count >= config.maxFailedAttempts!) {
    const unlockTime = lastAttempt
      ? new Date(lastAttempt.getTime() + config.lockoutDurationMinutes! * 60 * 1000)
      : new Date(Date.now() + config.lockoutDurationMinutes! * 60 * 1000);

    return {
      isLocked: unlockTime > new Date(),
      unlockTime,
    };
  }

  return { isLocked: false };
}

export async function revokeUserSessions(
  userId: string,
  excludeSessionId?: string,
): Promise<number> {
  let updateCondition = eq(sessions.userId, userId);

  if (excludeSessionId) {
    updateCondition = and(eq(sessions.userId, userId), sql`${sessions.id} != ${excludeSessionId}`);
  }

  const result = await db.update(sessions).set({ isActive: false }).where(updateCondition);

  // Log the session revocation
  await logActivity({
    userId,
    action: "sessions_revoked",
    details: {
      excludedSession: excludeSessionId,
      revokedCount: result.rowCount || 0,
    },
    success: true,
  });

  return result.rowCount || 0;
}

export async function revokeSpecificSession(sessionId: string): Promise<boolean> {
  const result = await db
    .update(sessions)
    .set({ isActive: false })
    .where(eq(sessions.id, sessionId));

  // Get session info for logging
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

  if (session) {
    await logActivity({
      userId: session.userId,
      sessionId,
      action: "session_revoked",
      details: {
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
      success: true,
    });
  }

  return (result.rowCount || 0) > 0;
}

export async function getActiveSessions(userId: string) {
  return await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.isActive, true),
        gte(sessions.expires, new Date()),
      ),
    )
    .orderBy(desc(sessions.createdAt));
}

export async function updateSessionInfo(
  sessionId: string,
  info: {
    ipAddress?: string;
    userAgent?: string;
    device?: string;
    location?: string;
  },
): Promise<void> {
  await db
    .update(sessions)
    .set({
      ipAddress: info.ipAddress,
      userAgent: info.userAgent,
      device: info.device,
      location: info.location,
    })
    .where(eq(sessions.id, sessionId));
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(and(sql`${sessions.expires} < ${new Date()}`, eq(sessions.isActive, false)));

  return result.rowCount || 0;
}

export async function detectSuspiciousActivity(
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<{
  isSuspicious: boolean;
  reasons: string[];
  riskScore: number;
}> {
  const reasons: string[] = [];
  let riskScore = 0;

  // Check for rapid login attempts
  const recentAttempts = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.userId, userId),
        eq(activityLogs.action, "login_success"),
        gte(activityLogs.createdAt, new Date(Date.now() - 5 * 60 * 1000)), // Last 5 minutes
      ),
    );

  if (recentAttempts[0]?.count > 3) {
    reasons.push("Multiple rapid login attempts");
    riskScore += 30;
  }

  // Check for new IP address
  const recentIPs = await db
    .select({ ipAddress: activityLogs.ipAddress })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.userId, userId),
        eq(activityLogs.action, "login_success"),
        gte(activityLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Last 30 days
      ),
    )
    .groupBy(activityLogs.ipAddress);

  const knownIPs = recentIPs.map((row) => row.ipAddress).filter(Boolean);
  if (!knownIPs.includes(ipAddress)) {
    reasons.push("Login from new IP address");
    riskScore += 20;
  }

  // Check for new device/user agent
  const recentUserAgents = await db
    .select({ userAgent: activityLogs.userAgent })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.userId, userId),
        eq(activityLogs.action, "login_success"),
        gte(activityLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Last 30 days
      ),
    )
    .groupBy(activityLogs.userAgent);

  const knownUserAgents = recentUserAgents.map((row) => row.userAgent).filter(Boolean);
  if (!knownUserAgents.includes(userAgent)) {
    reasons.push("Login from new device");
    riskScore += 15;
  }

  // Check for failed attempts before successful login
  const recentFailures = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.ipAddress, ipAddress),
        eq(activityLogs.action, "login_failed"),
        gte(activityLogs.createdAt, new Date(Date.now() - 10 * 60 * 1000)), // Last 10 minutes
      ),
    );

  if (recentFailures[0]?.count > 2) {
    reasons.push("Multiple failed attempts before success");
    riskScore += 25;
  }

  return {
    isSuspicious: riskScore >= 40,
    reasons,
    riskScore,
  };
}

export async function logSuspiciousActivity(
  userId: string,
  ipAddress: string,
  userAgent: string,
  reasons: string[],
  riskScore: number,
): Promise<void> {
  await logActivity({
    userId,
    action: "suspicious_activity_detected",
    details: {
      reasons,
      riskScore,
      autoDetected: true,
    },
    ipAddress,
    userAgent,
    success: false,
    errorMessage: `Suspicious activity detected: ${reasons.join(", ")}`,
  });
}
