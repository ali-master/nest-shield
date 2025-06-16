import { db } from "@/lib/db";
import {
  activityLogs,
  alerts,
  dataRetentionPolicies,
  metrics,
  requestLogs,
  retentionCleanupJobs,
  retentionConfiguration,
} from "@/lib/db/schema";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { logActivity } from "@/lib/auth/activity";

export type CleanupJobResult = {
  success: boolean;
  recordsDeleted: number;
  recordsProcessed: number;
  duration: number;
  error?: string;
};

export type PolicyExecutionResult = {
  policyId: number;
  policyName: string;
  success: boolean;
  recordsDeleted: number;
  error?: string;
};

export class DataRetentionService {
  private maxConcurrentJobs = 3;
  private batchSize = 1000;
  private jobTimeout = 3600; // seconds

  async initialize() {
    // Load configuration from database
    const [config] = await db.select().from(retentionConfiguration).limit(1);

    if (config) {
      this.maxConcurrentJobs = config.maxConcurrentJobs || 3;
      this.batchSize = config.batchSize || 1000;
      this.jobTimeout = config.jobTimeout || 3600;
    }
  }

  /**
   * Execute scheduled cleanup jobs
   * This method should be called by a cron job or scheduler
   */
  async executeScheduledCleanups(): Promise<PolicyExecutionResult[]> {
    await this.initialize();

    const results: PolicyExecutionResult[] = [];

    try {
      // Get global configuration
      const [globalConfig] = await db.select().from(retentionConfiguration).limit(1);

      if (globalConfig && !globalConfig.globalEnabled) {
        console.log("Data retention is globally disabled");
        return results;
      }

      // Find policies that need to run
      const policiesToRun = await this.findPoliciesToRun();

      if (policiesToRun.length === 0) {
        console.log("No policies scheduled to run");
        return results;
      }

      console.log(`Found ${policiesToRun.length} policies to execute`);

      // Check current running jobs
      const runningJobs = await this.getRunningJobsCount();
      const availableSlots = this.maxConcurrentJobs - runningJobs;

      if (availableSlots <= 0) {
        console.log("Maximum concurrent jobs reached, skipping execution");
        return results;
      }

      // Execute policies up to the available slots
      const policiesToExecute = policiesToRun.slice(0, availableSlots);

      for (const policy of policiesToExecute) {
        try {
          const result = await this.executePolicyCleanup(policy);
          results.push({
            policyId: policy.id,
            policyName: policy.name,
            success: result.success,
            recordsDeleted: result.recordsDeleted,
            error: result.error,
          });

          // Log the execution
          await logActivity({
            action: "data_retention_cleanup",
            resource: "retention_policy",
            resourceId: policy.id.toString(),
            details: {
              policyName: policy.name,
              dataType: policy.dataType,
              recordsDeleted: result.recordsDeleted,
              success: result.success,
            },
            success: result.success,
            errorMessage: result.error,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.push({
            policyId: policy.id,
            policyName: policy.name,
            success: false,
            recordsDeleted: 0,
            error: errorMessage,
          });

          console.error(`Failed to execute policy ${policy.name}:`, error);
        }
      }

      console.log(`Executed ${results.length} cleanup policies`);
      return results;
    } catch (error) {
      console.error("Error executing scheduled cleanups:", error);
      throw error;
    }
  }

  /**
   * Find policies that are due for execution
   */
  private async findPoliciesToRun() {
    const now = new Date();

    return await db
      .select()
      .from(dataRetentionPolicies)
      .where(
        and(
          eq(dataRetentionPolicies.isActive, true),
          or(
            lte(dataRetentionPolicies.nextCleanupAt, now),
            isNull(dataRetentionPolicies.nextCleanupAt),
          ),
        ),
      );
  }

  /**
   * Get the count of currently running cleanup jobs
   */
  private async getRunningJobsCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(retentionCleanupJobs)
      .where(eq(retentionCleanupJobs.status, "running"));

    return result?.count || 0;
  }

  /**
   * Execute cleanup for a specific policy
   */
  async executePolicyCleanup(policy: any): Promise<CleanupJobResult> {
    const startTime = Date.now();
    let totalRecordsDeleted = 0;
    let totalRecordsProcessed = 0;

    try {
      // Create a new cleanup job record
      await db.insert(retentionCleanupJobs).values({
        policyId: policy.id,
        status: "running",
        startedAt: new Date(),
      });

      // Get the latest job for this policy
      const [job] = await db
        .select()
        .from(retentionCleanupJobs)
        .where(eq(retentionCleanupJobs.policyId, policy.id))
        .orderBy(sql`${retentionCleanupJobs.createdAt} DESC`)
        .limit(1);

      if (!job) {
        throw new Error("Failed to create cleanup job");
      }

      console.log(`Starting cleanup job ${job.id} for policy ${policy.name}`);

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);

      // Get the appropriate table and date column
      const { table, dateColumn } = this.getTableAndDateColumn(policy.dataType);

      if (!table || !dateColumn) {
        throw new Error(`Unsupported data type: ${policy.dataType}`);
      }

      // Process deletion in batches
      let hasMoreRecords = true;
      while (hasMoreRecords) {
        // Check for timeout
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > this.jobTimeout) {
          throw new Error(`Job timeout exceeded (${this.jobTimeout}s)`);
        }

        // Get batch of records to delete
        const recordsToDelete = await db
          .select({ id: table.id })
          .from(table)
          .where(lte(dateColumn, cutoffDate))
          .limit(this.batchSize);

        if (recordsToDelete.length === 0) {
          hasMoreRecords = false;
          break;
        }

        // Delete the batch
        const recordIds = recordsToDelete.map((r) => r.id);
        await this.deleteBatch(table, recordIds, dateColumn, cutoffDate);

        totalRecordsProcessed += recordsToDelete.length;
        totalRecordsDeleted += recordsToDelete.length;

        // Update job progress
        await db
          .update(retentionCleanupJobs)
          .set({
            recordsProcessed: totalRecordsProcessed,
            recordsDeleted: totalRecordsDeleted,
          })
          .where(eq(retentionCleanupJobs.id, job.id));

        // Check if we processed fewer records than the batch size
        if (recordsToDelete.length < this.batchSize) {
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
          nextCleanupAt: this.calculateNextCleanupTime(policy.cleanupFrequency),
          totalRecordsDeleted: sql`${dataRetentionPolicies.totalRecordsDeleted} + ${totalRecordsDeleted}`,
          totalRecordsProcessed: sql`${dataRetentionPolicies.totalRecordsProcessed} + ${totalRecordsProcessed}`,
        })
        .where(eq(dataRetentionPolicies.id, policy.id));

      // Mark job as completed
      const duration = (Date.now() - startTime) / 1000;
      await db
        .update(retentionCleanupJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          recordsProcessed: totalRecordsProcessed,
          recordsDeleted: totalRecordsDeleted,
        })
        .where(eq(retentionCleanupJobs.id, job.id));

      console.log(
        `Cleanup job ${job.id} completed: ${totalRecordsDeleted} records deleted in ${duration}s`,
      );

      return {
        success: true,
        recordsDeleted: totalRecordsDeleted,
        recordsProcessed: totalRecordsProcessed,
        duration,
      };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error(`Cleanup job failed for policy ${policy.name}:`, error);

      return {
        success: false,
        recordsDeleted: totalRecordsDeleted,
        recordsProcessed: totalRecordsProcessed,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete a batch of records from the specified table
   */
  private async deleteBatch(table: any, recordIds: any[], dateColumn: any, cutoffDate: Date) {
    return await db.execute(
      sql`DELETE FROM ${sql.identifier(table._.name)} WHERE id IN (${sql.join(
        recordIds.map(() => sql.placeholder("id")),
        sql`, `,
      )}) AND ${sql.identifier(dateColumn.name)} <= ${cutoffDate}`,
    );
  }

  /**
   * Get the appropriate table and date column for a data type
   */
  private getTableAndDateColumn(dataType: string) {
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

  /**
   * Calculate the next cleanup time based on frequency
   */
  private calculateNextCleanupTime(frequency: string): Date {
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

  /**
   * Get cleanup statistics
   */
  async getCleanupStatistics() {
    const [totalPolicies] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dataRetentionPolicies);

    const [activePolicies] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.isActive, true));

    const [totalRecordsDeleted] = await db
      .select({ sum: sql<number>`sum(total_records_deleted)` })
      .from(dataRetentionPolicies);

    const [runningJobs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(retentionCleanupJobs)
      .where(eq(retentionCleanupJobs.status, "running"));

    const [completedJobs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(retentionCleanupJobs)
      .where(eq(retentionCleanupJobs.status, "completed"));

    const [failedJobs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(retentionCleanupJobs)
      .where(eq(retentionCleanupJobs.status, "failed"));

    return {
      totalPolicies: totalPolicies?.count || 0,
      activePolicies: activePolicies?.count || 0,
      totalRecordsDeleted: totalRecordsDeleted?.sum || 0,
      runningJobs: runningJobs?.count || 0,
      completedJobs: completedJobs?.count || 0,
      failedJobs: failedJobs?.count || 0,
    };
  }

  /**
   * Health check for the data retention system
   */
  async healthCheck() {
    try {
      const stats = await this.getCleanupStatistics();
      const runningJobsCount = stats.runningJobs;

      // Check if there are any stuck jobs (running for more than timeout period)
      const stuckJobThreshold = new Date(Date.now() - this.jobTimeout * 1000);
      const [stuckJobs] = await db
        .select({ count: sql<number>`count(*)` })
        .from(retentionCleanupJobs)
        .where(
          and(
            eq(retentionCleanupJobs.status, "running"),
            lte(retentionCleanupJobs.startedAt, stuckJobThreshold),
          ),
        );

      return {
        healthy: stuckJobs?.count === 0 && runningJobsCount <= this.maxConcurrentJobs,
        stats,
        issues: {
          stuckJobs: stuckJobs?.count || 0,
          overMaxConcurrent: runningJobsCount > this.maxConcurrentJobs,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
