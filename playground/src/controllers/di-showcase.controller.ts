import { Controller, Get, Post, Body, Query, Inject } from "@nestjs/common";
import { Shield, ShieldContext, Priority, BypassShield } from "nest-shield/decorators";
import {
  InjectCircuitBreaker,
  InjectRateLimit,
  InjectThrottle,
  InjectOverload,
  InjectMetrics,
  InjectAnomalyDetection,
  InjectGracefulShutdown,
  InjectDistributedSync,
  InjectPriorityManager,
} from "nest-shield/core";
import type {
  IProtectionContext,
  CircuitBreakerService,
  RateLimitService,
  ThrottleService,
  OverloadService,
  MetricsService,
  AnomalyDetectionService,
  GracefulShutdownService,
  DistributedSyncService,
  PriorityManagerService,
} from "nest-shield";

/**
 * DI Showcase Controller
 *
 * Demonstrates the new dependency injection implementation with Symbol-based tokens.
 * Shows how to inject all NestShield services using the new DI patterns.
 */
@Controller("di-showcase")
export class DIShowcaseController {
  constructor(
    // Core protection services using new injection decorators
    @InjectCircuitBreaker()
    private readonly circuitBreakerService: CircuitBreakerService,

    @InjectRateLimit()
    private readonly rateLimitService: RateLimitService,

    @InjectThrottle()
    private readonly throttleService: ThrottleService,

    @InjectOverload()
    private readonly overloadService: OverloadService,

    @InjectMetrics()
    private readonly metricsService: MetricsService,

    // Advanced services using new injection decorators
    @InjectAnomalyDetection()
    private readonly anomalyDetectionService: AnomalyDetectionService,

    @InjectGracefulShutdown()
    private readonly gracefulShutdownService: GracefulShutdownService,

    @InjectDistributedSync()
    private readonly distributedSyncService: DistributedSyncService,

    @InjectPriorityManager()
    private readonly priorityManagerService: PriorityManagerService,

    // Custom playground configuration
    @Inject("PLAYGROUND_CONFIG")
    private readonly playgroundConfig: any,
  ) {}

  @Get("services-overview")
  @BypassShield()
  async getServicesOverview() {
    return {
      message: "NestShield Services Overview - New DI Implementation",
      diImplementation: {
        version: "2.0",
        features: [
          "Symbol-based dependency injection tokens",
          "Centralized provider factories",
          "Type-safe service injection",
          "Backward compatibility with legacy tokens",
          "Enterprise-grade architecture patterns",
        ],
      },
      injectedServices: {
        circuitBreaker: !!this.circuitBreakerService,
        rateLimit: !!this.rateLimitService,
        throttle: !!this.throttleService,
        overload: !!this.overloadService,
        metrics: !!this.metricsService,
        anomalyDetection: !!this.anomalyDetectionService,
        gracefulShutdown: !!this.gracefulShutdownService,
        distributedSync: !!this.distributedSyncService,
        priorityManager: !!this.priorityManagerService,
      },
      playgroundConfig: this.playgroundConfig,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("circuit-breaker-status")
  @Shield({
    circuitBreaker: {
      enabled: true,
      timeout: 2000,
      errorThresholdPercentage: 30,
    },
  })
  async getCircuitBreakerStatus(@ShieldContext() context: IProtectionContext) {
    // Demonstrate direct service usage through DI
    const circuitBreakerStates = [
      {
        name: "external-api",
        state: "closed", // Would come from actual service
        failureCount: 0,
        successCount: 42,
        lastFailureTime: null,
      },
      {
        name: "database",
        state: "half-open",
        failureCount: 3,
        successCount: 156,
        lastFailureTime: new Date(Date.now() - 30000).toISOString(),
      },
    ];

    return {
      message: "Circuit breaker status via DI injection",
      injectionDecorator: "@InjectCircuitBreaker()",
      serviceInjected: !!this.circuitBreakerService,
      circuitBreakers: circuitBreakerStates,
      currentRequest: {
        id: "mock-request-id",
        ip: context.ip,
        userAgent: context.userAgent?.substring(0, 50),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("rate-limit-test")
  @Shield({
    rateLimit: {
      points: 5,
      duration: 60,
      blockDuration: 30,
    },
  })
  async testRateLimit(@Body() body: { customKey?: string }) {
    // Demonstrate rate limit service usage
    const rateLimitInfo = {
      currentKey: body.customKey || "default",
      remaining: Math.floor(Math.random() * 5),
      resetTime: new Date(Date.now() + 60000).toISOString(),
      isBlocked: false,
    };

    return {
      message: "Rate limit test via DI injection",
      injectionDecorator: "@InjectRateLimit()",
      serviceInjected: !!this.rateLimitService,
      rateLimitInfo,
      configuration: {
        points: 5,
        duration: 60,
        blockDuration: 30,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("metrics-collection")
  @Shield({
    rateLimit: { points: 10, duration: 60 },
  })
  async getMetricsCollection(@Query("format") format: string = "json") {
    // Demonstrate metrics service usage
    const metricsData = {
      counters: {
        requests_total: 1248,
        errors_total: 12,
        cache_hits: 456,
        cache_misses: 89,
      },
      gauges: {
        active_connections: 23,
        memory_usage_bytes: process.memoryUsage().heapUsed,
        cpu_usage_percent: Math.random() * 100,
      },
      histograms: {
        request_duration_ms: {
          buckets: { "0.1": 123, "0.5": 456, "1": 789, "+Inf": 1248 },
          sum: 892.5,
          count: 1248,
        },
      },
    };

    return {
      message: "Metrics collection via DI injection",
      injectionDecorator: "@InjectMetrics()",
      serviceInjected: !!this.metricsService,
      format,
      metrics: metricsData,
      configuration: {
        enabled: true,
        type: "prometheus",
        exportInterval: 5000,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("anomaly-detection")
  @Priority(7) // High priority for anomaly detection
  async triggerAnomalyDetection(
    @Body() body: { metricName: string; values: number[]; detectorType?: string },
  ) {
    // Demonstrate anomaly detection service usage
    const detectionResult = {
      metricName: body.metricName,
      valuesAnalyzed: body.values.length,
      detectorType: body.detectorType || "zscore",
      anomaliesDetected: body.values.filter((v) => v > 1000 || v < 0).length,
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      threshold: 1000,
      recommendations: [
        "Monitor this metric closely",
        "Consider adjusting thresholds",
        "Check for system issues",
      ],
    };

    return {
      message: "Anomaly detection via DI injection",
      injectionDecorator: "@InjectAnomalyDetection()",
      serviceInjected: !!this.anomalyDetectionService,
      input: body,
      result: detectionResult,
      availableDetectors: [
        "zscore",
        "threshold",
        "statistical",
        "seasonal",
        "machine-learning",
        "isolation-forest",
        "composite",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("overload-protection")
  @Shield({
    overload: {
      maxConcurrentRequests: 3,
      maxQueueSize: 5,
      queueTimeout: 2000,
    },
  })
  async getOverloadProtection() {
    // Simulate processing delay to test overload protection
    await new Promise((resolve) => setTimeout(resolve, 500));

    const overloadStatus = {
      currentRequests: Math.floor(Math.random() * 5),
      queuedRequests: Math.floor(Math.random() * 3),
      maxConcurrent: 3,
      maxQueue: 5,
      isOverloaded: false,
      avgProcessingTime: 450,
    };

    return {
      message: "Overload protection via DI injection",
      injectionDecorator: "@InjectOverload()",
      serviceInjected: !!this.overloadService,
      status: overloadStatus,
      configuration: {
        maxConcurrentRequests: 3,
        maxQueueSize: 5,
        queueTimeout: 2000,
        shedStrategy: "priority",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("priority-management")
  @Priority(8)
  async getPriorityManagement(@ShieldContext() context: IProtectionContext) {
    const priorityInfo = {
      currentPriority: 8,
      priorityLevels: {
        1: "Bulk operations",
        3: "Background tasks",
        5: "Normal requests",
        7: "Important operations",
        10: "Critical system operations",
      },
      queuePosition: Math.floor(Math.random() * 5),
      estimatedWaitTime: Math.floor(Math.random() * 1000),
    };

    return {
      message: "Priority management via DI injection",
      injectionDecorator: "@InjectPriorityManager()",
      serviceInjected: !!this.priorityManagerService,
      priorityInfo,
      requestContext: {
        id: "mock-request-id",
        method: context.method,
        url: "/di-showcase/priority-management",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("graceful-shutdown-info")
  @BypassShield() // Allow during shutdown process
  async getGracefulShutdownInfo() {
    const shutdownInfo = {
      isShuttingDown: false,
      activeRequests: Math.floor(Math.random() * 10),
      gracePeriod: 30000,
      forceShutdownAfter: 60000,
      shutdownHooks: [
        "Database connections cleanup",
        "Active requests completion",
        "Cache persistence",
        "Metrics export",
      ],
    };

    return {
      message: "Graceful shutdown info via DI injection",
      injectionDecorator: "@InjectGracefulShutdown()",
      serviceInjected: !!this.gracefulShutdownService,
      shutdownInfo,
      features: [
        "Request draining",
        "Configurable grace period",
        "Force shutdown timeout",
        "Custom shutdown hooks",
        "Health check integration",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("distributed-sync-status")
  async getDistributedSyncStatus() {
    const syncStatus = {
      nodeId: process.env.NODE_ID || require("os").hostname(),
      clusterId: "nest-shield-playground",
      connectedNodes: ["node-1", "node-2", "node-3"],
      lastSyncTime: new Date().toISOString(),
      syncChannel: "nest-shield:playground:sync",
      syncInterval: 5000,
      dataConsistency: "strong",
    };

    return {
      message: "Distributed sync status via DI injection",
      injectionDecorator: "@InjectDistributedSync()",
      serviceInjected: !!this.distributedSyncService,
      syncStatus,
      features: [
        "Multi-node coordination",
        "Shared state synchronization",
        "Node discovery and health",
        "Consistent rate limiting",
        "Distributed circuit breakers",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Post("combined-protection")
  @Shield({
    rateLimit: { points: 10, duration: 60 },
    throttle: { limit: 5, ttl: 30 },
    circuitBreaker: { timeout: 3000, errorThresholdPercentage: 50 },
    overload: { maxConcurrentRequests: 3 },
  })
  async getCombinedProtection(@Body() body: { simulate?: string }) {
    // Demonstrate multiple services working together
    const protectionStatus = {
      rateLimitActive: true,
      throttleActive: true,
      circuitBreakerActive: true,
      overloadProtectionActive: true,
      allServicesInjected: {
        rateLimit: !!this.rateLimitService,
        throttle: !!this.throttleService,
        circuitBreaker: !!this.circuitBreakerService,
        overload: !!this.overloadService,
        metrics: !!this.metricsService,
      },
      combinedConfiguration: {
        rateLimit: "10 requests/min",
        throttle: "5 requests/30s",
        circuitBreaker: "3s timeout, 50% error threshold",
        overload: "3 concurrent requests max",
      },
    };

    if (body.simulate === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else if (body.simulate === "error") {
      throw new Error("Simulated error for circuit breaker");
    }

    return {
      message: "Combined protection via multiple DI injections",
      injectionsUsed: [
        "@InjectRateLimit()",
        "@InjectThrottle()",
        "@InjectCircuitBreaker()",
        "@InjectOverload()",
        "@InjectMetrics()",
      ],
      protectionStatus,
      simulation: body.simulate || "none",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("service-health-check")
  @BypassShield()
  async getServiceHealthCheck() {
    const healthStatus = {
      overall: "healthy",
      services: {
        circuitBreaker: { status: "healthy", injected: !!this.circuitBreakerService },
        rateLimit: { status: "healthy", injected: !!this.rateLimitService },
        throttle: { status: "healthy", injected: !!this.throttleService },
        overload: { status: "healthy", injected: !!this.overloadService },
        metrics: { status: "healthy", injected: !!this.metricsService },
        anomalyDetection: { status: "healthy", injected: !!this.anomalyDetectionService },
        gracefulShutdown: { status: "healthy", injected: !!this.gracefulShutdownService },
        distributedSync: { status: "healthy", injected: !!this.distributedSyncService },
        priorityManager: { status: "healthy", injected: !!this.priorityManagerService },
      },
      diImplementation: {
        symbolTokensWorking: true,
        backwardCompatibility: true,
        providerFactoriesActive: true,
        typeScriptSupport: true,
      },
      playgroundConfig: {
        loaded: !!this.playgroundConfig,
        name: this.playgroundConfig?.name,
        version: this.playgroundConfig?.version,
        features: this.playgroundConfig?.features,
      },
    };

    return {
      message: "Service health check for DI implementation",
      healthStatus,
      allServicesAvailable: Object.values(healthStatus.services).every((s) => s.injected),
      timestamp: new Date().toISOString(),
    };
  }
}
