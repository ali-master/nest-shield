import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataRetentionPolicies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const policyUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  dataType: z.enum(["activity_logs", "metrics", "request_logs", "alerts"]).optional(),
  retentionPeriodDays: z.number().min(1).max(3650).optional(),
  cleanupFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/data-retention/policies/[id] - Get specific policy
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const policyId = Number.parseInt(id);

    if (isNaN(policyId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid policy ID",
        },
        { status: 400 },
      );
    }

    const [policy] = await db
      .select()
      .from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.id, policyId))
      .limit(1);

    if (!policy) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    console.error("Error fetching retention policy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch retention policy",
      },
      { status: 500 },
    );
  }
}

// PUT /api/data-retention/policies/[id] - Update policy
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const policyId = Number.parseInt(id);

    if (isNaN(policyId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid policy ID",
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = policyUpdateSchema.parse(body);

    // Check if policy exists
    const [existingPolicy] = await db
      .select()
      .from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.id, policyId))
      .limit(1);

    if (!existingPolicy) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy not found",
        },
        { status: 404 },
      );
    }

    // Update next cleanup time if frequency changed
    const updateData = { ...validatedData };
    if (
      validatedData.cleanupFrequency &&
      validatedData.cleanupFrequency !== existingPolicy.cleanupFrequency
    ) {
      updateData.nextCleanupAt = calculateNextCleanupTime(validatedData.cleanupFrequency);
    }

    const [updatedPolicy] = await db
      .update(dataRetentionPolicies)
      .set(updateData)
      .where(eq(dataRetentionPolicies.id, policyId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedPolicy,
    });
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

    console.error("Error updating retention policy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update retention policy",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/data-retention/policies/[id] - Delete policy
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const policyId = Number.parseInt(id);

    if (isNaN(policyId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid policy ID",
        },
        { status: 400 },
      );
    }

    // Check if policy exists
    const [existingPolicy] = await db
      .select()
      .from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.id, policyId))
      .limit(1);

    if (!existingPolicy) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy not found",
        },
        { status: 404 },
      );
    }

    // Delete the policy
    await db.delete(dataRetentionPolicies).where(eq(dataRetentionPolicies.id, policyId));

    return NextResponse.json({
      success: true,
      message: "Policy deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting retention policy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete retention policy",
      },
      { status: 500 },
    );
  }
}

function calculateNextCleanupTime(frequency: string): Date {
  const now = new Date();

  switch (frequency) {
    case "daily":
      const daily = new Date(now);
      daily.setDate(daily.getDate() + 1);
      daily.setHours(2, 0, 0, 0);
      return daily;

    case "weekly":
      const weekly = new Date(now);
      const daysUntilSunday = (7 - weekly.getDay()) % 7 || 7;
      weekly.setDate(weekly.getDate() + daysUntilSunday);
      weekly.setHours(1, 0, 0, 0);
      return weekly;

    case "monthly":
      const monthly = new Date(now);
      monthly.setMonth(monthly.getMonth() + 1, 1);
      monthly.setHours(3, 0, 0, 0);
      return monthly;

    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}
