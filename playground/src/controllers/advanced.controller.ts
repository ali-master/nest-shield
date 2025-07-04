import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { Shield, ShieldContext, Priority, BypassShield } from "@usex/nest-shield/decorators";
import type { IProtectionContext } from "@usex/nest-shield/interfaces";
import {
  InjectGracefulShutdown,
  InjectDistributedSync,
  InjectPriorityManager,
  InjectAnomalyDetection,
} from "@usex/nest-shield/core";
import type {
  GracefulShutdownService,
  DistributedSyncService,
  PriorityManagerService,
  AnomalyDetectionService,
} from "@usex/nest-shield/services";

@Controller("advanced")
export class AdvancedController {
  constructor(
    @InjectGracefulShutdown()
    private readonly shutdownService: GracefulShutdownService,
    @InjectDistributedSync()
    private readonly syncService: DistributedSyncService,
    @InjectPriorityManager()
    private readonly priorityService: PriorityManagerService,
    @InjectAnomalyDetection()
    private readonly anomalyService: AnomalyDetectionService,
  ) {}

  @Get("graceful-shutdown-info")
  @BypassShield() // Allow during shutdown
  async getGracefulShutdownInfo() {
    const shutdownStatus = this.shutdownService.getShutdownStatus();
    const isShuttingDown = this.shutdownService.isShutdownInProgress();

    return {
      message: "Graceful shutdown service information - Live Data",
      injectionDecorator: "@InjectGracefulShutdown()",
      features: [
        "Drain existing requests during shutdown",
        "Configurable shutdown timeout",
        "Before/after shutdown hooks",
        "Health check integration",
      ],
      liveStatus: {
        isShuttingDown,
        activeRequests: shutdownStatus.activeRequests,
        queueLength: shutdownStatus.queueLength,
        uptime: process.uptime(),
        shutdownMode: process.env.SHIELD_SHUTDOWN_MODE === "true",
      },
      serviceCapabilities: {
        canGetShutdownStatus: typeof this.shutdownService.getShutdownStatus === "function",
        canCheckShutdownProgress: typeof this.shutdownService.isShutdownInProgress === "function",
        hasApplicationShutdownHook:
          typeof this.shutdownService.onApplicationShutdown === "function",
      },
      environmentVariables: {
        activeRequests: process.env.SHIELD_ACTIVE_REQUESTS || "0",
        queueLength: process.env.SHIELD_QUEUE_LENGTH || "0",
        shutdownMode: process.env.SHIELD_SHUTDOWN_MODE || "false",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("distributed-sync-status")
  async getDistributedSyncStatus() {
    const activeNodes = this.syncService.getActiveNodes();
    const nodeCount = this.syncService.getNodeCount();
    const nodeId = this.syncService.getNodeId();
    const isLeader = this.syncService.isLeader();

    return {
      message: "Distributed synchronization status - Live Data",
      injectionDecorator: "@InjectDistributedSync()",
      features: [
        "Multi-node coordination",
        "Shared state synchronization",
        "Node discovery and health",
        "Consistent rate limiting across nodes",
      ],
      liveNodeInfo: {
        currentNodeId: nodeId,
        nodeCount,
        isLeader,
        activeNodes: activeNodes.map((node) => ({
          id: node.id,
          lastHeartbeat: node.lastHeartbeat,
          timeSinceLastHeartbeat: Date.now() - node.lastHeartbeat,
          metadata: {
            hostname: node.metadata?.hostname,
            pid: node.metadata?.pid,
            uptime: node.metadata?.uptime,
            version: node.metadata?.version,
          },
        })),
        networkTopology: {
          totalNodes: nodeCount,
          healthyNodes: activeNodes.filter((n) => Date.now() - n.lastHeartbeat < 30000).length,
          staleNodes: activeNodes.filter((n) => Date.now() - n.lastHeartbeat >= 30000).length,
        },
      },
      serviceCapabilities: {
        canBroadcastCustomData: typeof this.syncService.broadcastCustomData === "function",
        canGetActiveNodes: typeof this.syncService.getActiveNodes === "function",
        canCheckLeadership: typeof this.syncService.isLeader === "function",
        canGetNodeId: typeof this.syncService.getNodeId === "function",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("priority-management")
  @Priority(6)
  async getPriorityManagement(@ShieldContext() context: IProtectionContext) {
    const extractedPriority = this.priorityService.extractPriority(context);
    const priorityLevel = this.priorityService.getPriorityLevel(extractedPriority);
    const stats = this.priorityService.getStats();
    const aggregateStats = this.priorityService.getAggregateStats();
    const timeout = this.priorityService.getTimeout(extractedPriority);
    const canAccept = this.priorityService.canAcceptRequest(extractedPriority);

    return {
      message: "Priority management system - Live Data",
      injectionDecorator: "@InjectPriorityManager()",
      features: [
        "Request prioritization",
        "Priority-based queuing",
        "Dynamic priority assignment",
        "Priority level configuration",
      ],
      currentRequestAnalysis: {
        decoratorPriority: 6,
        extractedPriority,
        finalPriorityLevel: priorityLevel,
        requestTimeout: timeout,
        canBeAccepted: canAccept,
        contextInfo: {
          method: context.method,
          path: context.path,
          ip: context.ip,
          userAgent: context.userAgent?.substring(0, 50),
          headers: Object.keys(context.headers).length,
        },
      },
      prioritySystemStats: {
        aggregate: aggregateStats,
        detailedStats: Array.from(stats.entries()).map(([priority, queue]) => ({
          priority,
          level: queue.level,
          current: queue.currentRequests,
          queued: queue.queuedRequests,
          processed: queue.processedRequests,
          rejected: queue.rejectedRequests,
          lastProcessed: new Date(queue.lastProcessedTime).toISOString(),
          utilization: queue.level.maxConcurrent
            ? ((queue.currentRequests / queue.level.maxConcurrent) * 100).toFixed(2) + "%"
            : "0%",
        })),
      },
      serviceCapabilities: {
        canExtractPriority: typeof this.priorityService.extractPriority === "function",
        canGetPriorityLevel: typeof this.priorityService.getPriorityLevel === "function",
        canGetStats: typeof this.priorityService.getStats === "function",
        canCheckAcceptance: typeof this.priorityService.canAcceptRequest === "function",
        canAcquireSlot: typeof this.priorityService.acquireSlot === "function",
        canAdjustLimits: typeof this.priorityService.adjustPriorityLimits === "function",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("adaptive-protection")
  @Shield({
    rateLimit: { points: 20, duration: 60 },
    overload: {
      maxConcurrentRequests: 5,
      adaptiveThreshold: {
        enabled: true,
        minThreshold: 2,
        maxThreshold: 10,
        adjustmentInterval: 30000,
        targetLatency: 1000,
      },
    },
  })
  async adaptiveProtection(@Body() body: { simulateLoad?: boolean }) {
    if (body.simulateLoad) {
      // Simulate varying load to trigger adaptive behavior
      const delay = Math.random() * 2000 + 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return {
      message: "Adaptive protection demonstration",
      features: [
        "Dynamic threshold adjustment",
        "Load-based adaptation",
        "Performance monitoring",
        "Automatic optimization",
      ],
      currentMetrics: {
        averageLatency: Math.floor(Math.random() * 1000 + 200),
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        activeConnections: Math.floor(Math.random() * 50),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("anomaly-detection-advanced")
  async getAdvancedAnomalyDetection() {
    const activeDetector = this.anomalyService.getActiveDetectorName();
    const availableDetectors = this.anomalyService.getAvailableDetectors();
    const detectorInfo = this.anomalyService.getDetectorInfo();
    const statistics = this.anomalyService.getAnomalyStatistics();
    const recentAnomalies = this.anomalyService.getRecentAnomalies(5);

    return {
      message: "Advanced anomaly detection capabilities - Live Data",
      injectionDecorator: "@InjectAnomalyDetection()",
      liveDetectionInfo: {
        activeDetector,
        availableDetectors,
        detectorInfo,
        statistics,
        recentAnomalies: recentAnomalies.map((anomaly) => ({
          ...anomaly,
          timeSinceDetection: Date.now() - anomaly.timestamp,
        })),
      },
      detectorCapabilities: availableDetectors.map((name) => {
        const info = detectorInfo[name] || {};
        return {
          name,
          isActive: name === activeDetector,
          description: this.getDetectorDescription(name),
          useCase: this.getDetectorUseCase(name),
          configuration: info,
        };
      }),
      systemFeatures: [
        "Real-time detection",
        "Adaptive learning",
        "Business rule integration",
        "Alert management",
        "Performance tracking",
        "Historical data analysis",
        "Multiple detector types",
      ],
      serviceCapabilities: {
        canSwitchDetector: typeof this.anomalyService.switchDetector === "function",
        canDetectAnomalies: typeof this.anomalyService.detectAnomalies === "function",
        canGetStatistics: typeof this.anomalyService.getAnomalyStatistics === "function",
        canGetHistoricalData: typeof this.anomalyService.getHistoricalData === "function",
        canResetDetector: typeof this.anomalyService.resetDetector === "function",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("business-rules")
  async applyBusinessRules(@Body() body: { ruleId: string; data: any }) {
    // Simulate business rule application
    const rules = {
      "high-value-customer": {
        condition: 'customer.tier === "platinum"',
        action: "increase_limits",
        description: "Higher limits for platinum customers",
      },
      "suspicious-activity": {
        condition: "requests.errorRate > 0.5",
        action: "apply_stricter_limits",
        description: "Stricter limits for suspicious activity",
      },
      "maintenance-window": {
        condition: "time.hour >= 2 && time.hour <= 4",
        action: "reduce_capacity",
        description: "Reduced capacity during maintenance",
      },
    };

    const rule = rules[body.ruleId];

    if (!rule) {
      return {
        message: "Rule not found",
        availableRules: Object.keys(rules),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      message: "Business rule applied",
      rule,
      appliedTo: body.data,
      result: {
        action: rule.action,
        applied: true,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-key-generators")
  @Shield({
    rateLimit: {
      points: 10,
      duration: 60,
      keyGenerator: (context) => {
        // Advanced key generation based on multiple factors
        const userId = context.headers["x-user-id"];
        const apiKey = context.headers["x-api-key"];
        const tier = context.headers["x-customer-tier"];

        if (apiKey) {
          return `api:${apiKey}:${tier || "standard"}`;
        } else if (userId) {
          return `user:${userId}:${context.ip}`;
        } else {
          return `anonymous:${context.ip}:${context.userAgent.substr(0, 50)}`;
        }
      },
    },
  })
  async customKeyGenerators(@ShieldContext() context: IProtectionContext) {
    return {
      message: "Custom key generator demonstration",
      keyGenerationStrategies: [
        "API key-based rate limiting",
        "User-based rate limiting",
        "IP + User Agent combination",
        "Customer tier-based limits",
        "Geographic-based limits",
        "Time-based limits",
      ],
      currentKey: "Generated based on request context",
      context: {
        hasApiKey: !!context.headers["x-api-key"],
        hasUserId: !!context.headers["x-user-id"],
        customerTier: context.headers["x-customer-tier"] || "standard",
        ip: context.ip,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("fallback-strategies")
  @Shield({
    circuitBreaker: {
      timeout: 1000,
      errorThresholdPercentage: 30,
      fallback: (_error, _args, context) => {
        // Advanced fallback logic
        const fallbackType = context.headers["x-fallback-type"] || "cache";

        switch (fallbackType) {
          case "cache":
            return {
              message: "Cached response (fallback)",
              data: "Cached data from previous successful request",
              fallback: true,
              type: "cache",
            };
          case "degraded":
            return {
              message: "Degraded service response (fallback)",
              data: "Limited functionality available",
              fallback: true,
              type: "degraded",
            };
          case "queue":
            return {
              message: "Request queued for later processing (fallback)",
              queueId: `queue_${Date.now()}`,
              fallback: true,
              type: "queue",
            };
          default:
            return {
              message: "Service temporarily unavailable",
              fallback: true,
              type: "default",
            };
        }
      },
    },
  })
  async fallbackStrategies(@Body() body: { shouldFail?: boolean; fallbackType?: string }) {
    if (body.shouldFail) {
      throw new Error("Simulated service failure");
    }

    return {
      message: "Normal service response",
      fallbackType: body.fallbackType || "none",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health-indicators")
  @Shield({
    overload: {
      maxConcurrentRequests: 5,
      healthIndicator: async () => {
        // Composite health check
        const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
        const cpuUsage = Math.random(); // Simulated CPU usage
        const responseTime = Math.random() * 1000; // Simulated response time

        // Return normalized health score (0-1, where 1 is healthiest)
        const healthScore = 1 - Math.max(memoryUsage, cpuUsage, responseTime / 1000);
        return Math.max(0, healthScore);
      },
    },
  })
  async healthIndicators() {
    const memUsage = process.memoryUsage();

    return {
      message: "System health indicators",
      indicators: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
        uptime: process.uptime(),
        eventLoop: {
          // These would be real metrics in production
          lag: Math.random() * 10,
          utilization: Math.random() * 100,
        },
        connections: {
          active: Math.floor(Math.random() * 100),
          total: Math.floor(Math.random() * 200),
        },
      },
      overallHealth: Math.random() * 100, // 0-100 health score
      timestamp: new Date().toISOString(),
    };
  }

  @Get("performance-monitoring")
  async getPerformanceMonitoring() {
    return {
      message: "Performance monitoring capabilities",
      metrics: [
        "Request latency distribution",
        "Throughput (requests per second)",
        "Error rate and error types",
        "Circuit breaker state changes",
        "Queue depth and wait times",
        "Resource utilization",
        "Cache hit/miss ratios",
      ],
      alerting: {
        channels: ["webhook", "email", "slack", "log"],
        thresholds: {
          responseTime: { warning: 1000, critical: 5000 },
          errorRate: { warning: 0.05, critical: 0.1 },
          queueDepth: { warning: 10, critical: 50 },
        },
      },
      currentMetrics: {
        avgResponseTime: Math.floor(Math.random() * 500 + 100),
        requestsPerSecond: Math.floor(Math.random() * 100 + 10),
        errorRate: Math.random() * 0.1,
        queueDepth: Math.floor(Math.random() * 5),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("custom-protection-logic")
  async customProtectionLogic(@Body() body: { userId?: string; action: string }) {
    // Simulate custom protection logic based on user behavior
    const protectionLevel = this.calculateProtectionLevel(body.userId, body.action);

    return {
      message: "Custom protection logic applied",
      input: body,
      protectionLevel,
      appliedRules: [
        `Base protection: ${protectionLevel.base}`,
        `User tier modifier: ${protectionLevel.userTier}`,
        `Action risk modifier: ${protectionLevel.actionRisk}`,
        `Time-based modifier: ${protectionLevel.timeBased}`,
      ],
      finalLimits: {
        rateLimit: protectionLevel.finalLimits.rateLimit,
        concurrency: protectionLevel.finalLimits.concurrency,
        timeout: protectionLevel.finalLimits.timeout,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("test-priority-system")
  async testPrioritySystem(@Body() body: { priority?: number; simulate?: boolean }) {
    const testPriority = body.priority || 5;
    const canAccept = this.priorityService.canAcceptRequest(testPriority);
    const acquired = this.priorityService.acquireSlot(testPriority);

    // Simulate some work if requested
    if (body.simulate) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Release the slot
    if (acquired) {
      this.priorityService.releaseSlot(testPriority);
    }

    const afterStats = this.priorityService.getAggregateStats();

    return {
      message: "Priority system test completed",
      injectionDecorator: "@InjectPriorityManager()",
      testResults: {
        requestedPriority: testPriority,
        wasAccepted: canAccept,
        slotAcquired: acquired,
        simulatedWork: !!body.simulate,
      },
      systemStateAfter: afterStats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("broadcast-sync-data")
  async broadcastSyncData(@Body() body: { data: any; type?: string }) {
    await this.syncService.broadcastCustomData({
      type: body.type || "playground_test",
      payload: body.data,
      timestamp: Date.now(),
      nodeId: this.syncService.getNodeId(),
    });

    return {
      message: "Data broadcasted to all nodes",
      injectionDecorator: "@InjectDistributedSync()",
      broadcastInfo: {
        type: body.type || "playground_test",
        dataSize: JSON.stringify(body.data).length,
        targetNodes: this.syncService.getNodeCount() - 1, // Excluding self
        fromNodeId: this.syncService.getNodeId(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("trigger-anomaly-detection")
  async triggerAnomalyDetection(
    @Body() body: { metricName: string; values: number[]; switchDetector?: string },
  ) {
    // Switch detector if requested
    if (body.switchDetector) {
      this.anomalyService.switchDetector(body.switchDetector);
    }

    // Create test data points
    const dataPoints = body.values.map((value, index) => ({
      metricName: body.metricName,
      value,
      timestamp: Date.now() - (body.values.length - index) * 1000,
      type: "gauge" as const,
      source: "advanced-controller-test",
    }));

    const detectionResults = await this.anomalyService.detectAnomalies(dataPoints);
    const statistics = this.anomalyService.getAnomalyStatistics();

    return {
      message: "Anomaly detection triggered",
      injectionDecorator: "@InjectAnomalyDetection()",
      input: {
        metricName: body.metricName,
        valueCount: body.values.length,
        detectorUsed: this.anomalyService.getActiveDetectorName(),
        switchedDetector: !!body.switchDetector,
      },
      results: {
        anomaliesDetected: detectionResults.length,
        detectionResults: detectionResults.slice(-5), // Last 5 results
        statistics,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("shutdown-simulation-info")
  async getShutdownSimulationInfo() {
    const shutdownStatus = this.shutdownService.getShutdownStatus();
    const isShuttingDown = this.shutdownService.isShutdownInProgress();

    return {
      message: "Shutdown simulation information (READ-ONLY)",
      injectionDecorator: "@InjectGracefulShutdown()",
      currentState: {
        ...shutdownStatus,
        isShuttingDown,
      },
      simulationNote:
        "This endpoint demonstrates live shutdown service data. Actual shutdown is not triggered.",
      environmentSignals: {
        shutdownMode: process.env.SHIELD_SHUTDOWN_MODE === "true",
        activeRequestsTracked: process.env.SHIELD_ACTIVE_REQUESTS || "not set",
        queueLengthTracked: process.env.SHIELD_QUEUE_LENGTH || "not set",
      },
      gracefulShutdownFeatures: [
        "Request draining with timeout",
        "Circuit breaker shutdown signaling",
        "Metrics flush before exit",
        "Signal handling (SIGTERM, SIGINT, SIGUSR2)",
        "Before/after shutdown hooks",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private getDetectorDescription(name: string): string {
    const descriptions = {
      "Z-Score Detector": "Statistical outlier detection using z-scores",
      "Isolation Forest Detector": "Machine learning-based anomaly detection",
      "Seasonal Anomaly Detector": "Time-series pattern analysis",
      "Threshold Anomaly Detector": "Static and dynamic threshold monitoring",
      "Statistical Anomaly Detector": "Advanced statistical methods",
      "Machine Learning Detector": "Deep learning and neural networks",
      "Composite Anomaly Detector": "Combines multiple detection methods",
    };
    return descriptions[name] || "Unknown detector type";
  }

  private getDetectorUseCase(name: string): string {
    const useCases = {
      "Z-Score Detector": "Simple threshold-based anomalies",
      "Isolation Forest Detector": "Complex multi-dimensional anomalies",
      "Seasonal Anomaly Detector": "Detecting deviations from expected patterns",
      "Threshold Anomaly Detector": "Known limit violations",
      "Statistical Anomaly Detector": "Comprehensive statistical analysis",
      "Machine Learning Detector": "Complex pattern recognition",
      "Composite Anomaly Detector": "Comprehensive anomaly coverage",
    };
    return useCases[name] || "General anomaly detection";
  }

  private calculateProtectionLevel(userId?: string, action?: string) {
    // Mock calculation of dynamic protection levels
    const baseProtection = 5;
    const userTierModifier = userId?.startsWith("premium_") ? 2 : 0;
    const actionRiskModifier = action === "delete" ? -2 : action === "read" ? 1 : 0;
    const timeBasedModifier = new Date().getHours() >= 9 && new Date().getHours() <= 17 ? 1 : -1;

    const finalLevel = Math.max(
      1,
      baseProtection + userTierModifier + actionRiskModifier + timeBasedModifier,
    );

    return {
      base: baseProtection,
      userTier: userTierModifier,
      actionRisk: actionRiskModifier,
      timeBased: timeBasedModifier,
      final: finalLevel,
      finalLimits: {
        rateLimit: finalLevel * 10,
        concurrency: finalLevel * 2,
        timeout: 5000 - finalLevel * 200,
      },
    };
  }
}
