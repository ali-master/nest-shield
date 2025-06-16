import {
  Query,
  Put,
  Post,
  Param,
  HttpStatus,
  HttpCode,
  Get,
  Controller,
  Body,
} from "@nestjs/common";
import { ApiTags, ApiResponse, ApiQuery, ApiParam, ApiOperation } from "@nestjs/swagger";
import {
  SystemMetrics,
  ServiceHealth,
  MonitoringService,
  Alert,
} from "../services/monitoring.service";
import { MetricsService } from "../services/metrics.service";

@ApiTags("Monitoring & Observability")
@Controller("api/shield/monitoring")
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricsService: MetricsService,
  ) {}

  // System Metrics Endpoints
  @Get("metrics/system")
  @ApiOperation({ summary: "Get current system metrics" })
  @ApiResponse({ status: 200, description: "Current system metrics" })
  async getCurrentSystemMetrics(): Promise<SystemMetrics | null> {
    return this.monitoringService.getCurrentMetrics();
  }

  @Get("metrics/system/history")
  @ApiOperation({ summary: "Get system metrics history" })
  @ApiQuery({ name: "limit", required: false, description: "Limit number of results" })
  @ApiQuery({ name: "from", required: false, description: "Start date (ISO string)" })
  @ApiQuery({ name: "to", required: false, description: "End date (ISO string)" })
  @ApiResponse({ status: 200, description: "System metrics history" })
  async getSystemMetricsHistory(
    @Query("limit") limit?: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<SystemMetrics[]> {
    let history = this.monitoringService.getMetricsHistory(limit);

    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate = to ? new Date(to) : new Date();

      history = history.filter(
        (metric) => metric.timestamp >= fromDate && metric.timestamp <= toDate,
      );
    }

    return history;
  }

  @Post("metrics/collect")
  @ApiOperation({ summary: "Manually trigger metrics collection" })
  @ApiResponse({ status: 200, description: "Metrics collected successfully" })
  async collectMetrics(): Promise<SystemMetrics> {
    return this.monitoringService.collectSystemMetrics();
  }

  // Service Health Endpoints
  @Get("health")
  @ApiOperation({ summary: "Get overall system health status" })
  @ApiResponse({ status: 200, description: "System health status" })
  async getOverallHealth() {
    const serviceHealth = this.monitoringService.getAllServiceHealth();
    const currentMetrics = this.monitoringService.getCurrentMetrics();

    const healthyServices = serviceHealth.filter((s) => s.status === "healthy").length;
    const degradedServices = serviceHealth.filter((s) => s.status === "degraded").length;
    const unhealthyServices = serviceHealth.filter((s) => s.status === "unhealthy").length;

    let overallStatus = "healthy";
    if (unhealthyServices > 0) {
      overallStatus = "unhealthy";
    } else if (degradedServices > 0) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      services: {
        total: serviceHealth.length,
        healthy: healthyServices,
        degraded: degradedServices,
        unhealthy: unhealthyServices,
      },
      system: currentMetrics
        ? {
            cpu: currentMetrics.cpu.usage,
            memory: currentMetrics.memory.usage,
            uptime: currentMetrics.process.uptime,
          }
        : null,
      details: serviceHealth,
    };
  }

  @Get("health/services")
  @ApiOperation({ summary: "Get all service health statuses" })
  @ApiResponse({ status: 200, description: "All service health statuses" })
  async getAllServiceHealth(): Promise<ServiceHealth[]> {
    return this.monitoringService.getAllServiceHealth();
  }

  @Get("health/services/:serviceName")
  @ApiOperation({ summary: "Get specific service health status" })
  @ApiParam({ name: "serviceName", description: "Name of the service" })
  @ApiResponse({ status: 200, description: "Service health status" })
  async getServiceHealth(@Param("serviceName") serviceName: string): Promise<ServiceHealth | null> {
    const allHealth = this.monitoringService.getAllServiceHealth();
    return allHealth.find((health) => health.service === serviceName) || null;
  }

  // Performance Metrics Endpoints
  @Get("performance")
  @ApiOperation({ summary: "Get performance metrics" })
  @ApiResponse({ status: 200, description: "Performance metrics" })
  async getPerformanceMetrics() {
    const metrics = await this.metricsService.getMetrics();
    const currentSystemMetrics = this.monitoringService.getCurrentMetrics();

    return {
      requests: {
        total: metrics.requests_total || 0,
        perSecond: metrics.requests_per_second || 0,
        blocked: metrics.requests_blocked || 0,
        success_rate: metrics.success_rate || 0,
      },
      response: {
        averageTime: metrics.response_time_avg || 0,
        p50: metrics.response_time_p50 || 0,
        p95: metrics.response_time_p95 || 0,
        p99: metrics.response_time_p99 || 0,
      },
      errors: {
        rate: metrics.error_rate || 0,
        total: metrics.errors_total || 0,
        by_type: metrics.errors_by_type || {},
      },
      system: currentSystemMetrics
        ? {
            cpu: currentSystemMetrics.cpu.usage,
            memory: currentSystemMetrics.memory.usage,
            network: currentSystemMetrics.network,
            connections: currentSystemMetrics.shield.activeConnections,
          }
        : null,
      timestamp: new Date(),
    };
  }

  @Get("performance/trends")
  @ApiOperation({ summary: "Get performance trends" })
  @ApiQuery({ name: "period", required: false, description: "Time period (1h, 6h, 24h, 7d)" })
  @ApiResponse({ status: 200, description: "Performance trends" })
  async getPerformanceTrends(@Query("period") period: string = "1h") {
    const periodMap = {
      "1h": 60, // 60 data points for 1 hour
      "6h": 72, // 72 data points for 6 hours (5-minute intervals)
      "24h": 144, // 144 data points for 24 hours (10-minute intervals)
      "7d": 168, // 168 data points for 7 days (1-hour intervals)
    };

    const limit = periodMap[period] || 60;
    const history = this.monitoringService.getMetricsHistory(limit);

    const trends = {
      cpu: history.map((m) => ({ timestamp: m.timestamp, value: m.cpu.usage })),
      memory: history.map((m) => ({ timestamp: m.timestamp, value: m.memory.usage })),
      responseTime: history.map((m) => ({
        timestamp: m.timestamp,
        value: m.shield.averageResponseTime,
      })),
      requestRate: history.map((m) => ({ timestamp: m.timestamp, value: m.shield.requestsTotal })),
      errorRate: history.map((m) => ({ timestamp: m.timestamp, value: m.shield.errorRate })),
    };

    return {
      period,
      dataPoints: history.length,
      trends,
      summary: {
        cpu: {
          current: trends.cpu[trends.cpu.length - 1]?.value || 0,
          average: trends.cpu.reduce((sum, p) => sum + p.value, 0) / trends.cpu.length || 0,
          peak: Math.max(...trends.cpu.map((p) => p.value)),
        },
        memory: {
          current: trends.memory[trends.memory.length - 1]?.value || 0,
          average: trends.memory.reduce((sum, p) => sum + p.value, 0) / trends.memory.length || 0,
          peak: Math.max(...trends.memory.map((p) => p.value)),
        },
        responseTime: {
          current: trends.responseTime[trends.responseTime.length - 1]?.value || 0,
          average:
            trends.responseTime.reduce((sum, p) => sum + p.value, 0) / trends.responseTime.length ||
            0,
          peak: Math.max(...trends.responseTime.map((p) => p.value)),
        },
      },
    };
  }

  // Alert Management Endpoints
  @Get("alerts")
  @ApiOperation({ summary: "Get all alerts" })
  @ApiQuery({ name: "active", required: false, description: "Filter by active alerts only" })
  @ApiQuery({ name: "severity", required: false, description: "Filter by severity" })
  @ApiQuery({ name: "type", required: false, description: "Filter by alert type" })
  @ApiResponse({ status: 200, description: "List of alerts" })
  async getAlerts(
    @Query("active") active?: boolean,
    @Query("severity") severity?: string,
    @Query("type") type?: string,
  ): Promise<Alert[]> {
    let alerts = this.monitoringService.getAllAlerts();

    if (active !== undefined) {
      alerts = alerts.filter((alert) => alert.resolved !== active);
    }

    if (severity) {
      alerts = alerts.filter((alert) => alert.severity === severity);
    }

    if (type) {
      alerts = alerts.filter((alert) => alert.type === type);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  @Get("alerts/active")
  @ApiOperation({ summary: "Get active alerts" })
  @ApiResponse({ status: 200, description: "List of active alerts" })
  async getActiveAlerts(): Promise<Alert[]> {
    return this.monitoringService.getActiveAlerts();
  }

  @Get("alerts/stats")
  @ApiOperation({ summary: "Get alert statistics" })
  @ApiResponse({ status: 200, description: "Alert statistics" })
  async getAlertStats() {
    const allAlerts = this.monitoringService.getAllAlerts();
    const activeAlerts = this.monitoringService.getActiveAlerts();

    const stats = {
      total: allAlerts.length,
      active: activeAlerts.length,
      resolved: allAlerts.length - activeAlerts.length,
      bySeverity: {
        critical: allAlerts.filter((a) => a.severity === "critical").length,
        high: allAlerts.filter((a) => a.severity === "high").length,
        medium: allAlerts.filter((a) => a.severity === "medium").length,
        low: allAlerts.filter((a) => a.severity === "low").length,
      },
      byType: {
        performance: allAlerts.filter((a) => a.type === "performance").length,
        security: allAlerts.filter((a) => a.type === "security").length,
        availability: allAlerts.filter((a) => a.type === "availability").length,
        anomaly: allAlerts.filter((a) => a.type === "anomaly").length,
      },
      recent: allAlerts.filter((a) => a.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000))
        .length,
    };

    return stats;
  }

  @Post("alerts")
  @ApiOperation({ summary: "Create manual alert" })
  @ApiResponse({ status: 201, description: "Alert created successfully" })
  @HttpCode(HttpStatus.CREATED)
  async createAlert(
    @Body()
    alertData: {
      type: "performance" | "security" | "availability" | "anomaly";
      severity: "low" | "medium" | "high" | "critical";
      title: string;
      message: string;
      metadata?: Record<string, any>;
    },
  ): Promise<Alert> {
    return this.monitoringService.createAlert({
      ...alertData,
      metadata: alertData.metadata || {},
    });
  }

  @Put("alerts/:id/resolve")
  @ApiOperation({ summary: "Resolve an alert" })
  @ApiParam({ name: "id", description: "Alert ID" })
  @ApiResponse({ status: 200, description: "Alert resolved successfully" })
  async resolveAlert(@Param("id") id: string): Promise<{ message: string }> {
    await this.monitoringService.resolveAlert(id);
    return { message: "Alert resolved successfully" };
  }

  // Dashboard Data Endpoint
  @Get("dashboard")
  @ApiOperation({ summary: "Get comprehensive dashboard data" })
  @ApiResponse({ status: 200, description: "Dashboard data" })
  async getDashboardData() {
    return this.monitoringService.getDashboardData();
  }

  // Real-time Metrics Summary
  @Get("realtime")
  @ApiOperation({ summary: "Get real-time metrics summary" })
  @ApiResponse({ status: 200, description: "Real-time metrics summary" })
  async getRealtimeMetrics() {
    const [systemMetrics, serviceHealth, activeAlerts, performanceMetrics] = await Promise.all([
      this.monitoringService.getCurrentMetrics(),
      this.monitoringService.getAllServiceHealth(),
      this.monitoringService.getActiveAlerts(),
      this.metricsService.getMetrics(),
    ]);

    return {
      timestamp: new Date(),
      system: systemMetrics
        ? {
            cpu: {
              usage: systemMetrics.cpu.usage,
              loadAverage: systemMetrics.cpu.loadAverage,
            },
            memory: {
              usage: systemMetrics.memory.usage,
              total: systemMetrics.memory.total,
              used: systemMetrics.memory.used,
            },
            network: systemMetrics.network,
            uptime: systemMetrics.process.uptime,
          }
        : null,
      services: {
        total: serviceHealth.length,
        healthy: serviceHealth.filter((s) => s.status === "healthy").length,
        degraded: serviceHealth.filter((s) => s.status === "degraded").length,
        unhealthy: serviceHealth.filter((s) => s.status === "unhealthy").length,
        details: serviceHealth,
      },
      alerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter((a) => a.severity === "critical").length,
        high: activeAlerts.filter((a) => a.severity === "high").length,
        medium: activeAlerts.filter((a) => a.severity === "medium").length,
        low: activeAlerts.filter((a) => a.severity === "low").length,
      },
      performance: {
        requestsPerSecond: performanceMetrics.requests_per_second || 0,
        averageResponseTime: performanceMetrics.response_time_avg || 0,
        errorRate: performanceMetrics.error_rate || 0,
        throughput: performanceMetrics.requests_total || 0,
      },
    };
  }

  // Monitoring Configuration
  @Get("config")
  @ApiOperation({ summary: "Get monitoring configuration" })
  @ApiResponse({ status: 200, description: "Monitoring configuration" })
  async getMonitoringConfig() {
    return {
      collection: {
        interval: 30000, // 30 seconds
        retention: 86400000, // 24 hours
        maxHistorySize: 1000,
      },
      health: {
        checkInterval: 60000, // 1 minute
        timeout: 5000, // 5 seconds
      },
      alerts: {
        enabled: true,
        thresholds: {
          cpuUsage: 80,
          memoryUsage: 85,
          responseTime: 1000,
          errorRate: 5,
        },
      },
      notifications: {
        channels: ["console", "webhook"],
        webhookUrl: process.env.WEBHOOK_URL,
      },
    };
  }

  @Put("config")
  @ApiOperation({ summary: "Update monitoring configuration" })
  @ApiResponse({ status: 200, description: "Monitoring configuration updated" })
  async updateMonitoringConfig(@Body() config: any) {
    // In a real implementation, you would persist this configuration
    // For now, just return the updated config
    return {
      message: "Monitoring configuration updated successfully",
      config,
      updatedAt: new Date(),
    };
  }
}
