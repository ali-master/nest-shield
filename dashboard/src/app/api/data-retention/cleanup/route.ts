import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  activityLogs,
  alerts,
  dataRetentionPolicies,
  metrics,
  requestLogs,
  retentionCleanupJobs,
} from "@/lib/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";

const cleanupRequestSchema = z.object({
  policyId: z.number(),
  force: z.boolean().optional().default(false),
});

// POST /api/data-retention/cleanup - Trigger cleanup job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { policyId, force } = cleanupRequestSchema.parse(body);

    // Get the policy
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

    if (!policy.isActive && !force) {
      return NextResponse.json(
        {
          success: false,
          error: "Policy is not active",
        },
        { status: 400 },
      );
    }

    // Check if there's already a running job for this policy
    const [existingJob] = await db
      .select()
      .from(retentionCleanupJobs)
      .where(
        and(
          eq(retentionCleanupJobs.policyId, policyId),
          eq(retentionCleanupJobs.status, "running"),
        ),
      )
      .limit(1);

    if (existingJob && !force) {
      return NextResponse.json(
        {
          success: false,
          error: "A cleanup job is already running for this policy",
        },
        { status: 409 },
      );
    }

    // Create a new cleanup job
    const [newJob] = await db
      .insert(retentionCleanupJobs)
      .values({
        policyId,
        status: "pending",
        startedAt: null,
        completedAt: null,
        recordsProcessed: 0,
        recordsDeleted: 0,
      })
      .returning();

    // Start the cleanup process asynchronously
    // In a production environment, this would be queued in a job queue like Bull, Agenda, or similar
    processCleanupJob(newJob.id, policy).catch((error) => {
      console.error("Cleanup job failed:", error);
      // Update job status to failed
      db.update(retentionCleanupJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: error.message,
        })
        .where(eq(retentionCleanupJobs.id, newJob.id))
        .catch(console.error);
    });

    return NextResponse.json(
      {
        success: true,
        data: newJob,
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

    console.error("Error starting cleanup job:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start cleanup job",
      },
      { status: 500 },
    );
  }
}

// GET /api/data-retention/cleanup - List cleanup jobs
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const policyId = url.searchParams.get("policyId");
    const limit = Number.parseInt(url.searchParams.get("limit") || "50");
    const offset = Number.parseInt(url.searchParams.get("offset") || "0");

    let query = db
      .select()
      .from(retentionCleanupJobs)
      .orderBy(sql`${retentionCleanupJobs.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    if (policyId) {
      const parsedPolicyId = Number.parseInt(policyId);
      if (!isNaN(parsedPolicyId)) {
        query = query.where(eq(retentionCleanupJobs.policyId, parsedPolicyId));
      }
    }

    const jobs = await query;

    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error("Error fetching cleanup jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cleanup jobs",
      },
      { status: 500 },
    );
  }
}

async function processCleanupJob(jobId: number, policy: any) {
  const batchSize = 1000; // Process records in batches
  let totalRecordsDeleted = 0;
  let totalRecordsProcessed = 0;

  try {
    // Update job status to running
    await db
      .update(retentionCleanupJobs)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(retentionCleanupJobs.id, jobId));

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);

    // Get the appropriate table based on data type
    const { table, dateColumn } = getTableAndDateColumn(policy.dataType);

    if (!table || !dateColumn) {
      throw new Error(`Unsupported data type: ${policy.dataType}`);
    }

    // Process deletion in batches
    let hasMoreRecords = true;
    while (hasMoreRecords) {
      // Get batch of records to delete
      const recordsToDelete = await db
        .select({ id: table.id })
        .from(table)
        .where(lte(dateColumn, cutoffDate))
        .limit(batchSize);

      if (recordsToDelete.length === 0) {
        hasMoreRecords = false;
        break;
      }

      // Delete the batch
      const deleteResult = await db
        .delete(table)
        .where(
          and(
            sql`${table.id} IN (${recordsToDelete.map((r) => r.id).join(",")})`,
            lte(dateColumn, cutoffDate),
          ),
        );

      totalRecordsProcessed += recordsToDelete.length;
      totalRecordsDeleted += recordsToDelete.length; // Assuming all records are deleted

      // Update job progress
      await db
        .update(retentionCleanupJobs)
        .set({
          recordsProcessed: totalRecordsProcessed,
          recordsDeleted: totalRecordsDeleted,
        })
        .where(eq(retentionCleanupJobs.id, jobId));

      // Check if we processed fewer records than the batch size
      if (recordsToDelete.length < batchSize) {
        hasMoreRecords = false;
      }

      // Small delay to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update policy statistics
    await db
      .update(dataRetentionPolicies)
      .set({
        lastCleanupAt: new Date(),
        nextCleanupAt: calculateNextCleanupTime(policy.cleanupFrequency),
        totalRecordsDeleted: sql`${dataRetentionPolicies.totalRecordsDeleted} + ${totalRecordsDeleted}`,
        totalRecordsProcessed: sql`${dataRetentionPolicies.totalRecordsProcessed} + ${totalRecordsProcessed}`,
      })
      .where(eq(dataRetentionPolicies.id, policy.id));

    // Mark job as completed
    await db
      .update(retentionCleanupJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        recordsProcessed: totalRecordsProcessed,
        recordsDeleted: totalRecordsDeleted,
      })
      .where(eq(retentionCleanupJobs.id, jobId));

    console.log(`Cleanup job ${jobId} completed: ${totalRecordsDeleted} records deleted`);
  } catch (error) {
    console.error(`Cleanup job ${jobId} failed:`, error);

    // Mark job as failed
    await db
      .update(retentionCleanupJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        recordsProcessed: totalRecordsProcessed,
        recordsDeleted: totalRecordsDeleted,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(retentionCleanupJobs.id, jobId));

    throw error;
  }
}

function getTableAndDateColumn(dataType: string) {
  switch (dataType) {
    case "activity_logs":
      return { table: activityLogs, dateColumn: activityLogs.createdAt };
    case "metrics":
      return { table: metrics, dateColumn: metrics.createdAt };
    case "request_logs":
      return { table: requestLogs, dateColumn: requestLogs.createdAt };
    case "alerts":
      return { table: alerts, dateColumn: alerts.createdAt };
    default:
      return { table: null, dateColumn: null };
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
