#!/usr/bin/env ts-node
import { createInterface } from "readline";
import chalk from "chalk";
import ora from "ora";
import { db } from "../src/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  authenticators,
  activityLogs,
  magicLinkTokens,
  twoFactorBackupCodes,
  shieldConfigs,
  metrics,
  rateLimitRules,
  circuitBreakerRules,
  throttleRules,
  anomalyDetectionSettings,
  alerts,
  healthChecks,
  dashboardSettings,
  requestLogs,
} from "../src/lib/db/schema";

class DatabaseResetter {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  constructor() {
    console.log(chalk.red.bold("🗑️  NestShield Database Reset Tool"));
    console.log(chalk.yellow("⚠️  This will permanently delete all data from your database!\n"));
  }

  async run() {
    try {
      const args = process.argv.slice(2);
      const force = args.includes("--force") || args.includes("-f");

      if (!force) {
        const confirmation = await this.confirm();
        if (!confirmation) {
          console.log(chalk.gray("Reset cancelled."));
          return;
        }
      }

      await this.resetDatabase();
      console.log(chalk.green.bold("\n✅ Database reset completed successfully!"));
      console.log(chalk.cyan("Run `npm run db:seed` to populate with new data."));
    } catch (error) {
      console.error(chalk.red.bold("\n❌ Reset failed:"), error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  private async confirm(): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(
        chalk.yellow('Are you sure you want to delete ALL data? Type "yes" to confirm: '),
        (answer) => {
          resolve(answer.toLowerCase() === "yes");
        },
      );
    });
  }

  private async resetDatabase() {
    const spinner = ora("Resetting database...").start();

    try {
      // Delete data in correct order to respect foreign key constraints
      const tables = [
        { name: "Activity Logs", table: activityLogs },
        { name: "Two-Factor Backup Codes", table: twoFactorBackupCodes },
        { name: "Magic Link Tokens", table: magicLinkTokens },
        { name: "Authenticators", table: authenticators },
        { name: "Verification Tokens", table: verificationTokens },
        { name: "Sessions", table: sessions },
        { name: "Accounts", table: accounts },
        { name: "Dashboard Settings", table: dashboardSettings },
        { name: "Request Logs", table: requestLogs },
        { name: "Health Checks", table: healthChecks },
        { name: "Alerts", table: alerts },
        { name: "Anomaly Detection Settings", table: anomalyDetectionSettings },
        { name: "Throttle Rules", table: throttleRules },
        { name: "Circuit Breaker Rules", table: circuitBreakerRules },
        { name: "Rate Limit Rules", table: rateLimitRules },
        { name: "Metrics", table: metrics },
        { name: "Shield Configs", table: shieldConfigs },
        { name: "Users", table: users },
      ];

      for (const { name, table } of tables) {
        spinner.text = `Clearing ${name}...`;
        try {
          await db.delete(table);
        } catch (error) {
          // Continue even if some tables don't exist or have constraints
          console.warn(chalk.yellow(`Warning: Could not clear ${name}`));
        }
      }

      spinner.succeed(chalk.green("Database reset completed!"));
    } catch (error) {
      spinner.fail(chalk.red("Database reset failed!"));
      throw error;
    }
  }
}

// Run the resetter
const resetter = new DatabaseResetter();
resetter.run().catch(console.error);
