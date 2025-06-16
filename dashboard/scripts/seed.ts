#!/usr/bin/env ts-node
import { createInterface } from "readline";
import chalk from "chalk";
import ora from "ora";
import { db } from "../src/lib/db";
import {
  users,
  shieldConfigs,
  metrics,
  alerts,
  healthChecks,
  requestLogs,
  dashboardSettings,
} from "../src/lib/db/schema";
import { generateId } from "../src/lib/utils";

interface SeedOptions {
  users?: number;
  configs?: number;
  metrics?: number;
  alerts?: number;
  logs?: number;
  demoData?: boolean;
  interactive?: boolean;
  force?: boolean;
}

class DatabaseSeeder {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  constructor() {
    console.log(chalk.blue.bold("🌱 NestShield Dashboard Database Seeder"));
    console.log(chalk.gray("Interactive CLI for seeding your dashboard database\n"));
  }

  async run() {
    try {
      const options = await this.getSeederOptions();

      if (options.interactive) {
        await this.interactiveSeeding();
      } else {
        await this.batchSeeding(options);
      }

      console.log(chalk.green.bold("\n✅ Database seeding completed successfully!"));
      console.log(chalk.yellow("You can now start the dashboard with: npm run dev"));
    } catch (error) {
      console.error(chalk.red.bold("\n❌ Seeding failed:"), error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  private async getSeederOptions(): Promise<SeedOptions> {
    const args = process.argv.slice(2);

    if (args.includes("--help") || args.includes("-h")) {
      this.showHelp();
      process.exit(0);
    }

    const interactive = args.includes("--interactive") || args.includes("-i") || args.length === 0;
    const force = args.includes("--force") || args.includes("-f");
    const demoData = args.includes("--demo") || args.includes("-d");

    if (!interactive) {
      return {
        users: this.getArgValue(args, "--users", 10),
        configs: this.getArgValue(args, "--configs", 5),
        metrics: this.getArgValue(args, "--metrics", 1000),
        alerts: this.getArgValue(args, "--alerts", 20),
        logs: this.getArgValue(args, "--logs", 500),
        demoData,
        interactive: false,
        force,
      };
    }

    return { interactive: true, force, demoData };
  }

  private getArgValue(args: string[], flag: string, defaultValue: number): number {
    const index = args.indexOf(flag);
    if (index !== -1 && index + 1 < args.length) {
      const argValue = args[index + 1];
      return argValue ? parseInt(argValue) || defaultValue : defaultValue;
    }
    return defaultValue;
  }

  private async interactiveSeeding() {
    console.log(chalk.cyan("🎯 Interactive Seeding Mode\n"));

    // Check if database exists and has data
    const hasData = await this.checkExistingData();
    if (hasData) {
      const shouldContinue = await this.prompt(
        chalk.yellow("⚠️  Database already contains data. Continue? (y/N): "),
      );
      if (!shouldContinue.toLowerCase().startsWith("y")) {
        console.log(chalk.gray("Seeding cancelled."));
        return;
      }
    }

    // Seeding options
    const seedingType = await this.selectSeedingType();

    if (seedingType === "demo") {
      await this.seedDemoData();
    } else if (seedingType === "custom") {
      await this.customSeeding();
    } else if (seedingType === "production") {
      await this.productionSeeding();
    }
  }

  private async selectSeedingType(): Promise<string> {
    console.log(chalk.cyan("Select seeding type:"));
    console.log("1. 🎮 Demo Data (Quick setup with sample data)");
    console.log("2. ⚙️  Custom Setup (Configure each component)");
    console.log("3. 🏢 Production Setup (Minimal, secure setup)");
    console.log("4. 🧪 Development Setup (Full dataset for testing)");

    const choice = await this.prompt("Enter your choice (1-4): ");

    switch (choice.trim()) {
      case "1":
        return "demo";
      case "2":
        return "custom";
      case "3":
        return "production";
      case "4":
        return "development";
      default:
        console.log(chalk.yellow("Invalid choice, using demo data..."));
        return "demo";
    }
  }

  private async customSeeding() {
    console.log(chalk.cyan("\n⚙️  Custom Seeding Configuration\n"));

    const userCount = await this.promptNumber("Number of users to create", 5, 1, 100);
    const configCount = await this.promptNumber("Number of shield configurations", 3, 1, 20);
    const metricCount = await this.promptNumber("Number of metric entries", 1000, 100, 10000);
    const alertCount = await this.promptNumber("Number of alerts", 15, 5, 100);
    const logCount = await this.promptNumber("Number of request logs", 500, 100, 5000);

    const includeDemo = await this.promptBoolean("Include demo admin user?", true);

    const spinner = ora("Seeding database...").start();

    try {
      if (includeDemo) await this.seedDemoAdmin();
      await this.seedUsers(userCount);
      await this.seedConfigurations(configCount);
      await this.seedMetrics(metricCount);
      await this.seedAlerts(alertCount);
      await this.seedRequestLogs(logCount);
      await this.seedHealthChecks();

      spinner.succeed(chalk.green("Custom seeding completed!"));
    } catch (error) {
      spinner.fail(chalk.red("Custom seeding failed!"));
      throw error;
    }
  }

  private async seedDemoData() {
    const spinner = ora("Setting up demo environment...").start();

    try {
      // Demo admin user
      await this.seedDemoAdmin();

      // Demo users
      await this.seedUsers(8);

      // Demo configurations
      await this.seedConfigurations(6);

      // Demo metrics (last 7 days)
      await this.seedMetrics(2000);

      // Demo alerts
      await this.seedAlerts(25);

      // Demo request logs
      await this.seedRequestLogs(1500);

      // Health checks
      await this.seedHealthChecks();

      // Dashboard settings
      await this.seedDashboardSettings();

      spinner.succeed(chalk.green("Demo data setup completed!"));

      console.log(chalk.cyan("\n📋 Demo Credentials:"));
      console.log(chalk.white("Admin: admin@nestshield.com / password123"));
      console.log(chalk.white("User: demo@nestshield.com / password123"));
    } catch (error) {
      spinner.fail(chalk.red("Demo seeding failed!"));
      throw error;
    }
  }

  private async productionSeeding() {
    const spinner = ora("Setting up production environment...").start();

    try {
      // Create admin user
      const adminEmail = await this.prompt("Admin email: ");
      const adminPassword = await this.prompt("Admin password: ", true);

      await this.createUser({
        email: adminEmail,
        password: adminPassword,
        name: "Administrator",
        role: "admin",
        status: "active",
      });

      // Basic configurations
      await this.seedConfigurations(3);

      // Minimal health checks
      await this.seedHealthChecks();

      spinner.succeed(chalk.green("Production setup completed!"));

      console.log(chalk.cyan(`\n📋 Admin created: ${adminEmail}`));
    } catch (error) {
      spinner.fail(chalk.red("Production seeding failed!"));
      throw error;
    }
  }

  private async batchSeeding(options: SeedOptions) {
    const spinner = ora("Batch seeding database...").start();

    try {
      if (options.demoData) {
        await this.seedDemoAdmin();
      }

      if (options.users) await this.seedUsers(options.users);
      if (options.configs) await this.seedConfigurations(options.configs);
      if (options.metrics) await this.seedMetrics(options.metrics);
      if (options.alerts) await this.seedAlerts(options.alerts);
      if (options.logs) await this.seedRequestLogs(options.logs);

      await this.seedHealthChecks();

      spinner.succeed(chalk.green("Batch seeding completed!"));
    } catch (error) {
      spinner.fail(chalk.red("Batch seeding failed!"));
      throw error;
    }
  }

  private async seedDemoAdmin() {
    await this.createUser({
      email: "admin@nestshield.com",
      password: "password123",
      name: "Admin User",
      role: "admin",
      status: "active",
    });

    await this.createUser({
      email: "demo@nestshield.com",
      password: "password123",
      name: "Demo User",
      role: "user",
      status: "active",
    });
  }

  private async seedUsers(count: number) {
    const users_data = [];

    for (let i = 0; i < count; i++) {
      users_data.push({
        id: generateId(),
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        emailVerified: new Date(),
        role: Math.random() > 0.8 ? "admin" : "user",
        status: Math.random() > 0.9 ? "suspended" : "active",
        twoFactorEnabled: Math.random() > 0.7,
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    }

    await db.insert(users).values(users_data);
  }

  private async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    status: string;
  }) {
    // For demo purposes, we'll skip password hashing
    // const hashedPassword = await hashPassword(userData.password);

    await db.insert(users).values({
      id: generateId(),
      name: userData.name,
      email: userData.email,
      emailVerified: new Date(),
      role: userData.role,
      status: userData.status,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async seedConfigurations(count: number) {
    const configs = [
      {
        name: "Production API Protection",
        description: "High-security configuration for production APIs",
        config: {
          rateLimit: { enabled: true, requests: 100, window: "1m" },
          circuitBreaker: { enabled: true, threshold: 5, timeout: 30000 },
          throttle: { enabled: true, ttl: 60, limit: 10 },
          anomalyDetection: { enabled: true, sensitivity: "high" },
        },
        isActive: true,
      },
      {
        name: "Development Environment",
        description: "Relaxed settings for development",
        config: {
          rateLimit: { enabled: true, requests: 1000, window: "1m" },
          circuitBreaker: { enabled: false },
          throttle: { enabled: false },
          anomalyDetection: { enabled: true, sensitivity: "low" },
        },
        isActive: false,
      },
      {
        name: "Public API Gateway",
        description: "Configuration for public-facing APIs",
        config: {
          rateLimit: { enabled: true, requests: 50, window: "1m" },
          circuitBreaker: { enabled: true, threshold: 3, timeout: 60000 },
          throttle: { enabled: true, ttl: 120, limit: 5 },
          anomalyDetection: { enabled: true, sensitivity: "medium" },
        },
        isActive: true,
      },
    ];

    for (let i = 0; i < Math.min(count, configs.length); i++) {
      await db.insert(shieldConfigs).values({
        name: configs[i]!.name,
        description: configs[i]!.description,
        config: configs[i]!.config,
        isActive: configs[i]!.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Add additional random configs if needed
    for (let i = configs.length; i < count; i++) {
      await db.insert(shieldConfigs).values({
        name: `Config ${i + 1}`,
        description: `Auto-generated configuration ${i + 1}`,
        config: {
          rateLimit: {
            enabled: Math.random() > 0.5,
            requests: 50 + Math.floor(Math.random() * 200),
          },
          circuitBreaker: {
            enabled: Math.random() > 0.3,
            threshold: 3 + Math.floor(Math.random() * 7),
          },
          throttle: { enabled: Math.random() > 0.4, ttl: 60 + Math.floor(Math.random() * 120) },
        },
        isActive: Math.random() > 0.3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  private async seedMetrics(count: number) {
    const metricTypes = [
      "request_count",
      "response_time",
      "error_rate",
      "cpu_usage",
      "memory_usage",
      "active_connections",
      "blocked_requests",
      "circuit_breaker_trips",
      "rate_limit_hits",
      "anomaly_score",
    ];

    const metrics_data = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const metricType = metricTypes[Math.floor(Math.random() * metricTypes.length)]!;

      let value;
      switch (metricType) {
        case "request_count":
          value = Math.floor(Math.random() * 1000);
          break;
        case "response_time":
          value = Math.random() * 500 + 50;
          break;
        case "error_rate":
          value = Math.random() * 5;
          break;
        case "cpu_usage":
        case "memory_usage":
          value = Math.random() * 100;
          break;
        default:
          value = Math.random() * 100;
      }

      metrics_data.push({
        timestamp,
        metricType,
        value: value.toString(),
        tags: {
          service: ["api", "dashboard", "auth"][Math.floor(Math.random() * 3)]!,
          environment: ["production", "staging", "development"][Math.floor(Math.random() * 3)]!,
        },
        source: `service-${Math.floor(Math.random() * 5) + 1}`,
        createdAt: timestamp,
      });
    }

    // Insert metrics in batches to avoid large transaction
    const batchSize = 100;
    for (let i = 0; i < metrics_data.length; i += batchSize) {
      const batch = metrics_data.slice(i, i + batchSize);
      await db.insert(metrics).values(batch);
    }
  }

  private async seedAlerts(count: number) {
    const alertTypes = ["anomaly", "circuit_breaker", "rate_limit", "system", "security"];
    const severities = ["low", "medium", "high", "critical"];

    const alerts_data = [];

    for (let i = 0; i < count; i++) {
      const type = alertTypes[Math.floor(Math.random() * alertTypes.length)]!;
      const severity = severities[Math.floor(Math.random() * severities.length)]!;
      const isResolved = Math.random() > 0.3;
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

      alerts_data.push({
        type,
        severity,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Alert #${i + 1}`,
        message: `Alert message for ${type} with ${severity} severity`,
        metadata: {
          service: "api-gateway",
          endpoint: "/api/v1/users",
          threshold: severity === "critical" ? 95 : 85,
        },
        isResolved,
        resolvedAt: isResolved
          ? new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000)
          : null,
        createdAt,
      });
    }

    await db.insert(alerts).values(alerts_data);
  }

  private async seedRequestLogs(count: number) {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const paths = [
      "/api/v1/users",
      "/api/v1/auth/login",
      "/api/v1/products",
      "/api/v1/orders",
      "/api/v1/analytics",
      "/api/v1/settings",
      "/api/v1/health",
      "/api/v1/metrics",
    ];
    const statusCodes = [200, 201, 400, 401, 403, 404, 500, 502, 503];

    const logs_data = [];

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const method = methods[Math.floor(Math.random() * methods.length)]!;
      const path = paths[Math.floor(Math.random() * paths.length)]!;
      const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)]!;
      const responseTime = Math.floor(Math.random() * 1000 + 10);
      const blocked = statusCode >= 400 && Math.random() > 0.8;

      logs_data.push({
        timestamp,
        method,
        path,
        statusCode,
        responseTime,
        userAgent: "Mozilla/5.0 (Compatible User Agent)",
        ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        size: Math.floor(Math.random() * 10000),
        blocked,
        blockReason: blocked ? "Rate limit exceeded" : null,
        createdAt: timestamp,
      });
    }

    await db.insert(requestLogs).values(logs_data);
  }

  private async seedHealthChecks() {
    const services = ["database", "redis", "api-gateway", "auth-service", "file-storage"];
    const statuses = ["healthy", "degraded", "unhealthy"];

    const healthChecks_data = [];

    for (const service of services) {
      const status = statuses[Math.floor(Math.random() * statuses.length)]!;
      const responseTime =
        status === "healthy" ? Math.random() * 50 + 10 : Math.random() * 200 + 50;

      healthChecks_data.push({
        service,
        status,
        responseTime: Math.floor(responseTime),
        details: {
          version: "1.0.0",
          uptime: Math.floor(Math.random() * 86400),
          connections: Math.floor(Math.random() * 100),
        },
        checkedAt: new Date(),
      });
    }

    await db.insert(healthChecks).values(healthChecks_data);
  }

  private async seedDashboardSettings() {
    // This would seed settings for demo users
    const demoUsers = await db.select().from(users).limit(5);

    for (const user of demoUsers) {
      await db.insert(dashboardSettings).values({
        userId: user.id,
        theme: Math.random() > 0.5 ? "dark" : "light",
        language: Math.random() > 0.8 ? "fa" : "en",
        dashboardLayout: {
          widgets: ["metrics", "alerts", "health"],
          columns: 3,
          refreshRate: 30,
        },
        notifications: {
          email: true,
          browser: true,
          severity: "medium",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  private async checkExistingData(): Promise<boolean> {
    try {
      const userCount = await db.select().from(users).limit(1);
      return userCount.length > 0;
    } catch {
      return false;
    }
  }

  private async prompt(question: string, isPassword = false): Promise<string> {
    return new Promise((resolve) => {
      if (isPassword) {
        // Hide password input
        process.stdout.write(question);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        let password = "";
        process.stdin.on("data", (charBuffer) => {
          const char = charBuffer.toString();
          if (char === "\u0003") {
            // Ctrl+C
            process.exit();
          } else if (char === "\r" || char === "\n") {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write("\n");
            resolve(password);
          } else if (char === "\u007f") {
            // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else {
            password += char;
            process.stdout.write("*");
          }
        });
      } else {
        this.rl.question(question, resolve);
      }
    });
  }

  private async promptNumber(
    question: string,
    defaultValue: number,
    min: number,
    max: number,
  ): Promise<number> {
    const answer = await this.prompt(`${question} (${min}-${max}, default: ${defaultValue}): `);
    const num = parseInt(answer) || defaultValue;
    return Math.max(min, Math.min(max, num));
  }

  private async promptBoolean(question: string, defaultValue: boolean): Promise<boolean> {
    const answer = await this.prompt(`${question} (y/N, default: ${defaultValue ? "y" : "n"}): `);
    if (!answer.trim()) return defaultValue;
    return answer.toLowerCase().startsWith("y");
  }

  private showHelp() {
    console.log(chalk.blue.bold("🌱 NestShield Dashboard Database Seeder\n"));
    console.log(chalk.white("Usage:"));
    console.log("  npm run seed                    # Interactive mode");
    console.log("  npm run seed --help             # Show this help");
    console.log("  npm run seed --demo             # Quick demo setup");
    console.log("  npm run seed --interactive      # Interactive mode");
    console.log("\nBatch mode options:");
    console.log("  --users <number>               # Number of users to create");
    console.log("  --configs <number>             # Number of configurations");
    console.log("  --metrics <number>             # Number of metric entries");
    console.log("  --alerts <number>              # Number of alerts");
    console.log("  --logs <number>                # Number of request logs");
    console.log("  --force                        # Skip confirmation prompts");
    console.log("\nExamples:");
    console.log("  npm run seed --demo");
    console.log("  npm run seed --users 20 --metrics 5000 --force");
    console.log("  npm run seed --interactive");
  }
}

// Run the seeder
const seeder = new DatabaseSeeder();
seeder.run().catch(console.error);
