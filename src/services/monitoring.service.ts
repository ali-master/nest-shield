import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Interval, SchedulerRegistry } from "@nestjs/schedule";
import { MetricsService } from "./metrics.service";
import { ShieldLoggerService } from "./shield-logger.service";
import { IStorageAdapter } from "../storage/base-storage.adapter";
import { Inject } from "@nestjs/common";
import { STORAGE_ADAPTER } from "../core/di-tokens";

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  shield: {
    requestsTotal: number;
    requestsBlocked: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

export interface ServiceHealth {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  lastCheck: Date;
  details: Record<string, any>;
  error?: string;
}

export interface Alert {
  id: string;
  type: "performance" | "security" | "availability" | "anomaly";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private systemMetricsHistory: SystemMetrics[] = [];
  private serviceHealthCache = new Map<string, ServiceHealth>();
  private activeAlerts = new Map<string, Alert>();
  private readonly maxHistorySize = 1000;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly shieldLogger: ShieldLoggerService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  /**
   * Collect comprehensive system metrics
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date();

    // CPU metrics
    const cpuUsage = process.cpuUsage();
    const loadAverage = require("os").loadavg();

    // Memory metrics
    const totalMemory = require("os").totalmem();
    const freeMemory = require("os").freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    // Process metrics
    const processMemory = process.memoryUsage();
    const processUptime = process.uptime();

    // Network metrics (simplified - in real implementation, you'd use network monitoring)
    const networkMetrics = await this.getNetworkMetrics();

    // Shield-specific metrics
    const shieldMetrics = await this.getShieldMetrics();

    const metrics: SystemMetrics = {
      timestamp,
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: memoryUsage,
      },
      network: networkMetrics,
      process: {
        pid: process.pid,
        uptime: processUptime,
        memoryUsage: processMemory,
        cpuUsage,
      },
      shield: shieldMetrics,
    };

    // Store metrics in history
    this.systemMetricsHistory.push(metrics);
    if (this.systemMetricsHistory.length > this.maxHistorySize) {
      this.systemMetricsHistory.shift();
    }

    // Store in external storage for persistence
    await this.storage.set(
      `metrics:system:${timestamp.getTime()}`,
      JSON.stringify(metrics),
      3600, // 1 hour TTL
    );

    // Emit real-time metrics event
    this.eventEmitter.emit("metrics.system.updated", metrics);

    return metrics;
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.systemMetricsHistory[this.systemMetricsHistory.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): SystemMetrics[] {
    if (limit) {
      return this.systemMetricsHistory.slice(-limit);
    }
    return [...this.systemMetricsHistory];
  }

  /**
   * Monitor service health
   */
  async checkServiceHealth(
    serviceName: string,
    healthCheckFn: () => Promise<any>,
  ): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        healthCheckFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Health check timeout")), 5000),
        ),
      ]);

      const responseTime = Date.now() - startTime;
      const health: ServiceHealth = {
        service: serviceName,
        status: responseTime > 1000 ? "degraded" : "healthy",
        responseTime,
        lastCheck: new Date(),
        details: result || {},
      };

      this.serviceHealthCache.set(serviceName, health);

      // Store in external storage
      await this.storage.set(
        `health:${serviceName}`,
        JSON.stringify(health),
        300, // 5 minutes TTL
      );

      this.eventEmitter.emit("health.service.updated", health);

      return health;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const health: ServiceHealth = {
        service: serviceName,
        status: "unhealthy",
        responseTime,
        lastCheck: new Date(),
        details: {},
        error: error.message,
      };

      this.serviceHealthCache.set(serviceName, health);
      this.eventEmitter.emit("health.service.updated", health);

      return health;
    }
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealthCache.values());
  }

  /**
   * Create and manage alerts
   */
  async createAlert(alert: Omit<Alert, "id" | "timestamp" | "resolved">): Promise<Alert> {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
    };

    this.activeAlerts.set(fullAlert.id, fullAlert);

    // Store in external storage
    await this.storage.set(
      `alert:${fullAlert.id}`,
      JSON.stringify(fullAlert),
      86400, // 24 hours TTL
    );

    // Log the alert
    this.shieldLogger.warn(`Alert created: ${fullAlert.title}`, {
      alertId: fullAlert.id,
      severity: fullAlert.severity,
      type: fullAlert.type,
      metadata: fullAlert.metadata,
    });

    this.eventEmitter.emit("alert.created", fullAlert);

    return fullAlert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      await this.storage.set(
        `alert:${alertId}`,
        JSON.stringify(alert),
        86400, // 24 hours TTL
      );

      this.shieldLogger.info(`Alert resolved: ${alert.title}`, {
        alertId,
        resolvedAt: alert.resolvedAt,
      });

      this.eventEmitter.emit("alert.resolved", alert);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Analyze metrics for anomalies and create alerts
   */
  async analyzeMetricsForAnomalies(metrics: SystemMetrics): Promise<void> {
    const alerts: Omit<Alert, "id" | "timestamp" | "resolved">[] = [];

    // CPU usage alert
    if (metrics.cpu.usage > 80) {
      alerts.push({
        type: "performance",
        severity: metrics.cpu.usage > 95 ? "critical" : "high",
        title: "High CPU Usage",
        message: `CPU usage is at ${metrics.cpu.usage.toFixed(1)}%`,
        metadata: { cpuUsage: metrics.cpu.usage },
      });
    }

    // Memory usage alert
    if (metrics.memory.usage > 85) {
      alerts.push({
        type: "performance",
        severity: metrics.memory.usage > 95 ? "critical" : "high",
        title: "High Memory Usage",
        message: `Memory usage is at ${metrics.memory.usage.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memory.usage },
      });
    }

    // Response time alert
    if (metrics.shield.averageResponseTime > 1000) {
      alerts.push({
        type: "performance",
        severity: metrics.shield.averageResponseTime > 2000 ? "high" : "medium",
        title: "High Response Time",
        message: `Average response time is ${metrics.shield.averageResponseTime}ms`,
        metadata: { responseTime: metrics.shield.averageResponseTime },
      });
    }

    // Error rate alert
    if (metrics.shield.errorRate > 5) {
      alerts.push({
        type: "availability",
        severity: metrics.shield.errorRate > 10 ? "critical" : "high",
        title: "High Error Rate",
        message: `Error rate is at ${metrics.shield.errorRate.toFixed(1)}%`,
        metadata: { errorRate: metrics.shield.errorRate },
      });
    }

    // Create alerts
    for (const alertData of alerts) {
      await this.createAlert(alertData);
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    systemMetrics: SystemMetrics | null;
    serviceHealth: ServiceHealth[];
    activeAlerts: Alert[];
    performance: {
      requestsPerMinute: number;
      averageResponseTime: number;
      errorRate: number;
      throughput: number;
    };
    trends: {
      cpuTrend: number[];
      memoryTrend: number[];
      responseTrend: number[];
    };
  }> {
    const currentMetrics = this.getCurrentMetrics();
    const recentHistory = this.getMetricsHistory(60); // Last 60 data points

    // Calculate performance metrics
    const performance = {
      requestsPerMinute: currentMetrics?.shield.requestsTotal || 0,
      averageResponseTime: currentMetrics?.shield.averageResponseTime || 0,
      errorRate: currentMetrics?.shield.errorRate || 0,
      throughput: currentMetrics?.shield.requestsTotal || 0,
    };

    // Calculate trends
    const trends = {
      cpuTrend: recentHistory.map((m) => m.cpu.usage),
      memoryTrend: recentHistory.map((m) => m.memory.usage),
      responseTrend: recentHistory.map((m) => m.shield.averageResponseTime),
    };

    return {
      systemMetrics: currentMetrics,
      serviceHealth: this.getAllServiceHealth(),
      activeAlerts: this.getActiveAlerts(),
      performance,
      trends,
    };
  }

  /**
   * Start automated monitoring
   */
  @Interval(30000) // Every 30 seconds
  async performSystemMonitoring(): Promise<void> {
    try {
      const metrics = await this.collectSystemMetrics();
      await this.analyzeMetricsForAnomalies(metrics);
    } catch (error) {
      this.logger.error("Error during system monitoring", error);
    }
  }

  /**
   * Health check for common services
   */
  @Interval(60000) // Every minute
  async performHealthChecks(): Promise<void> {
    const healthChecks = [
      {
        name: "database",
        check: () => this.checkDatabaseHealth(),
      },
      {
        name: "redis",
        check: () => this.checkRedisHealth(),
      },
      {
        name: "external-api",
        check: () => this.checkExternalApiHealth(),
      },
    ];

    for (const healthCheck of healthChecks) {
      try {
        await this.checkServiceHealth(healthCheck.name, healthCheck.check);
      } catch (error) {
        this.logger.error(`Health check failed for ${healthCheck.name}`, error);
      }
    }
  }

  private async getNetworkMetrics() {
    // In a real implementation, you would collect actual network metrics
    // For now, return mock data
    return {
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 1000000),
      connectionsActive: Math.floor(Math.random() * 100),
    };
  }

  private async getShieldMetrics() {
    // Get metrics from the metrics service
    const metricsData = await this.metricsService.getMetrics();

    return {
      requestsTotal: metricsData.requests_total || 0,
      requestsBlocked: metricsData.requests_blocked || 0,
      averageResponseTime: metricsData.response_time_avg || 0,
      errorRate: metricsData.error_rate || 0,
      activeConnections: metricsData.active_connections || 0,
    };
  }

  private async checkDatabaseHealth(): Promise<any> {
    // Implement database health check
    return { status: "connected", queries: "responsive" };
  }

  private async checkRedisHealth(): Promise<any> {
    // Implement Redis health check
    return { status: "connected", latency: "low" };
  }

  private async checkExternalApiHealth(): Promise<any> {
    // Implement external API health check
    return { status: "available", response: "ok" };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
