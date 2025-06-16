import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DataRetentionService } from "@/lib/services/data-retention.service";
import { headers } from "next/headers";

// POST /api/data-retention/cron - Execute scheduled cleanup (called by cron/scheduler)
export async function POST(_request: NextRequest) {
  try {
    // Verify the request is from an authorized source
    // In production, you might want to use API keys, JWT tokens, or IP whitelisting
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET || "default-secret";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const service = new DataRetentionService();
    const results = await service.executeScheduledCleanups();

    // Calculate summary statistics
    const summary = {
      totalPoliciesExecuted: results.length,
      successfulPolicies: results.filter((r) => r.success).length,
      failedPolicies: results.filter((r) => !r.success).length,
      totalRecordsDeleted: results.reduce((sum, r) => sum + r.recordsDeleted, 0),
      errors: results
        .filter((r) => !r.success)
        .map((r) => ({
          policyId: r.policyId,
          policyName: r.policyName,
          error: r.error,
        })),
    };

    console.log("Scheduled cleanup execution completed:", summary);

    return NextResponse.json({
      success: true,
      summary,
      details: results,
    });
  } catch (error) {
    console.error("Error executing scheduled cleanup:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET /api/data-retention/cron - Health check endpoint
export async function GET() {
  try {
    const service = new DataRetentionService();
    const healthCheck = await service.healthCheck();

    return NextResponse.json({
      success: true,
      ...healthCheck,
    });
  } catch (error) {
    console.error("Error performing health check:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
