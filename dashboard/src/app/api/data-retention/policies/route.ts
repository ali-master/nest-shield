import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataRetentionPolicies } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

// Validation schema for creating/updating policies
const policySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  dataType: z.enum(["activity_logs", "metrics", "request_logs", "alerts"]),
  retentionPeriodDays: z.number().min(1).max(3650),
  cleanupFrequency: z.enum(["daily", "weekly", "monthly"]),
});

// GET /api/data-retention/policies - List all policies
export async function GET() {
  try {
    const policies = await db
      .select()
      .from(dataRetentionPolicies)
      .orderBy(desc(dataRetentionPolicies.createdAt));

    return NextResponse.json({
      success: true,
      data: policies,
    });
  } catch (error) {
    console.error("Error fetching retention policies:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch retention policies",
      },
      { status: 500 },
    );
  }
}

// POST /api/data-retention/policies - Create new policy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = policySchema.parse(body);

    // Calculate next cleanup time based on frequency
    const nextCleanupAt = calculateNextCleanupTime(validatedData.cleanupFrequency);

    const [newPolicy] = await db
      .insert(dataRetentionPolicies)
      .values({
        ...validatedData,
        nextCleanupAt,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newPolicy,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error("Error creating retention policy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create retention policy",
      },
      { status: 500 },
    );
  }
}

function calculateNextCleanupTime(frequency: string): Date {
  const now = new Date();

  switch (frequency) {
    case "daily":
      // Schedule for next day at 2 AM
      const daily = new Date(now);
      daily.setDate(daily.getDate() + 1);
      daily.setHours(2, 0, 0, 0);
      return daily;

    case "weekly":
      // Schedule for next Sunday at 1 AM
      const weekly = new Date(now);
      const daysUntilSunday = (7 - weekly.getDay()) % 7 || 7;
      weekly.setDate(weekly.getDate() + daysUntilSunday);
      weekly.setHours(1, 0, 0, 0);
      return weekly;

    case "monthly":
      // Schedule for first day of next month at 3 AM
      const monthly = new Date(now);
      monthly.setMonth(monthly.getMonth() + 1, 1);
      monthly.setHours(3, 0, 0, 0);
      return monthly;

    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow
  }
}
