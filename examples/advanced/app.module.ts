import { Module } from "@nestjs/common";
import { ShieldModule, StorageType } from "../../src";
import { AdvancedController } from "./advanced.controller";
import { CustomMetricsCollector } from "./custom-metrics.collector";

@Module({
  imports: [
    ShieldModule.forRootAsync({
      useFactory: async () => ({
        global: {
          enabled: true,
          excludePaths: ["/health", "/metrics"],
          bypassTokens: [process.env.ADMIN_TOKEN || ""],
          logging: {
            enabled: true,
            level: "debug",
          },
        },
        storage: {
          type: StorageType.REDIS,
          options: {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || "0"),
            keyPrefix: "shield:",
          },
        },
        rateLimit: {
          enabled: true,
          points: 1000,
          duration: 60,
          blockDuration: 300,
          keyGenerator: (context) => {
            // Custom key generation based on user ID or API key
            const apiKey = context.headers["x-api-key"];
            const userId = context.headers["x-user-id"];
            return userId || apiKey || context.ip;
          },
          customResponseMessage: (context) => {
            return `Rate limit exceeded for ${context.path}. Please try again later.`;
          },
        },
        throttle: {
          enabled: true,
          ttl: 60,
          limit: 100,
          ignoreUserAgents: [/googlebot/i, /bingbot/i],
        },
        circuitBreaker: {
          enabled: true,
          timeout: 5000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
          volumeThreshold: 20,
          allowWarmUp: true,
          warmUpCallVolume: 10,
          healthCheck: async () => {
            // Custom health check
            try {
              // Check database connection, external services, etc.
              return true;
            } catch {
              return false;
            }
          },
        },
        overload: {
          enabled: true,
          maxConcurrentRequests: 500,
          maxQueueSize: 2000,
          queueTimeout: 30000,
          shedStrategy: "priority",
          priorityFunction: (context) => {
            // Custom priority calculation
            const priority = parseInt(context.headers["x-priority"] || "5");
            const isPremium = context.headers["x-premium-user"] === "true";
            return isPremium ? Math.min(priority + 3, 10) : priority;
          },
          healthIndicator: async () => {
            // Return health score between 0 and 1
            const cpuUsage = process.cpuUsage();
            const memUsage = process.memoryUsage();
            const cpuScore = 1 - (cpuUsage.user + cpuUsage.system) / 1000000000;
            const memScore = 1 - memUsage.heapUsed / memUsage.heapTotal;
            return (cpuScore + memScore) / 2;
          },
          adaptiveThreshold: {
            enabled: true,
            minThreshold: 100,
            maxThreshold: 1000,
            adjustmentInterval: 10000,
          },
        },
        metrics: {
          enabled: true,
          type: "custom",
          customCollector: new CustomMetricsCollector(),
          prefix: "shield",
          labels: {
            app: "nest-shield-example",
            env: process.env.NODE_ENV || "development",
          },
          exportInterval: 30000,
        },
        advanced: {
          gracefulShutdown: {
            enabled: true,
            timeout: 30000,
            beforeShutdown: async () => {
              console.log("Preparing for shutdown...");
              // Save state, close connections, etc.
            },
            onShutdown: async () => {
              console.log("Shutdown complete");
            },
          },
          requestPriority: {
            enabled: true,
            defaultPriority: 5,
            priorityHeader: "x-priority",
            priorityLevels: [
              {
                name: "critical",
                value: 10,
                maxConcurrent: 100,
                maxQueueSize: 200,
                timeout: 60000,
              },
              { name: "high", value: 8, maxConcurrent: 80, maxQueueSize: 500, timeout: 45000 },
              { name: "normal", value: 5, maxConcurrent: 60, maxQueueSize: 1000, timeout: 30000 },
              { name: "low", value: 3, maxConcurrent: 40, maxQueueSize: 2000, timeout: 20000 },
              {
                name: "background",
                value: 1,
                maxConcurrent: 20,
                maxQueueSize: 5000,
                timeout: 10000,
              },
            ],
          },
          distributedSync: {
            enabled: true,
            nodeId: process.env.NODE_ID,
            syncInterval: 5000,
            channel: "shield:sync",
            onNodeJoin: (nodeId) => {
              console.log(`Node joined: ${nodeId}`);
            },
            onNodeLeave: (nodeId) => {
              console.log(`Node left: ${nodeId}`);
            },
            onSyncData: (data) => {
              console.log("Received sync data:", data);
            },
          },
          adaptiveProtection: {
            enabled: true,
            learningPeriod: 3600000, // 1 hour
            adjustmentInterval: 60000, // 1 minute
            sensitivityFactor: 1.5,
            anomalyDetection: {
              enabled: true,
              algorithm: "zscore",
              threshold: 3,
              windowSize: 100,
            },
          },
        },
      }),
    }),
  ],
  controllers: [AdvancedController],
})
export class AdvancedAppModule {}
