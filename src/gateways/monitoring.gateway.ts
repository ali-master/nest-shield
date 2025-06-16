import {
  WebSocketServer,
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayDisconnect,
  OnGatewayConnection,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Socket, Server } from "socket.io";
import { Logger, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  SystemMetrics,
  ServiceHealth,
  MonitoringService,
  Alert,
} from "../services/monitoring.service";
import { ConfigurationService, ConfigurationChangeEvent } from "../services/configuration.service";
import { MetricsService } from "../services/metrics.service";

interface ClientSubscription {
  socketId: string;
  subscriptions: Set<string>;
  filters?: {
    alertSeverity?: string[];
    metricTypes?: string[];
    services?: string[];
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.DASHBOARD_URL || "http://localhost:3001",
    credentials: true,
  },
  namespace: "/monitoring",
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private connectedClients = new Map<string, ClientSubscription>();
  private metricsInterval: NodeJS.Timeout;
  private readonly METRICS_BROADCAST_INTERVAL = 5000; // 5 seconds

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly configurationService: ConfigurationService,
    private readonly metricsService: MetricsService,
  ) {}

  afterInit(_server: Server) {
    this.logger.log("WebSocket Gateway initialized");
    this.startMetricsBroadcast();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    this.connectedClients.set(client.id, {
      socketId: client.id,
      subscriptions: new Set(),
    });

    // Send initial data to newly connected client
    this.sendInitialData(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  // Subscription Management
  @SubscribeMessage("subscribe")
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channels: string[]; filters?: any },
  ) {
    const subscription = this.connectedClients.get(client.id);
    if (subscription) {
      data.channels.forEach((channel) => subscription.subscriptions.add(channel));
      if (data.filters) {
        subscription.filters = data.filters;
      }

      client.emit("subscribed", {
        channels: Array.from(subscription.subscriptions),
        timestamp: new Date(),
      });

      this.logger.log(`Client ${client.id} subscribed to: ${data.channels.join(", ")}`);
    }
  }

  @SubscribeMessage("unsubscribe")
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channels: string[] },
  ) {
    const subscription = this.connectedClients.get(client.id);
    if (subscription) {
      data.channels.forEach((channel) => subscription.subscriptions.delete(channel));

      client.emit("unsubscribed", {
        channels: data.channels,
        timestamp: new Date(),
      });

      this.logger.log(`Client ${client.id} unsubscribed from: ${data.channels.join(", ")}`);
    }
  }

  // Real-time Data Requests
  @SubscribeMessage("getDashboardData")
  async handleGetDashboardData(@ConnectedSocket() client: Socket) {
    try {
      const dashboardData = await this.monitoringService.getDashboardData();
      client.emit("dashboardData", {
        data: dashboardData,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error getting dashboard data", error);
      client.emit("error", { message: "Failed to get dashboard data" });
    }
  }

  @SubscribeMessage("getMetricsHistory")
  async handleGetMetricsHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number; from?: string; to?: string },
  ) {
    try {
      const history = this.monitoringService.getMetricsHistory(data.limit);
      let filteredHistory = history;

      if (data.from || data.to) {
        const fromDate = data.from ? new Date(data.from) : new Date(0);
        const toDate = data.to ? new Date(data.to) : new Date();

        filteredHistory = history.filter(
          (metric) => metric.timestamp >= fromDate && metric.timestamp <= toDate,
        );
      }

      client.emit("metricsHistory", {
        data: filteredHistory,
        count: filteredHistory.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error getting metrics history", error);
      client.emit("error", { message: "Failed to get metrics history" });
    }
  }

  @SubscribeMessage("getServiceHealth")
  async handleGetServiceHealth(@ConnectedSocket() client: Socket) {
    try {
      const serviceHealth = this.monitoringService.getAllServiceHealth();
      client.emit("serviceHealth", {
        data: serviceHealth,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error getting service health", error);
      client.emit("error", { message: "Failed to get service health" });
    }
  }

  @SubscribeMessage("getActiveAlerts")
  async handleGetActiveAlerts(@ConnectedSocket() client: Socket) {
    try {
      const alerts = this.monitoringService.getActiveAlerts();
      client.emit("activeAlerts", {
        data: alerts,
        count: alerts.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error getting active alerts", error);
      client.emit("error", { message: "Failed to get active alerts" });
    }
  }

  // Configuration Management
  @SubscribeMessage("getConfiguration")
  async handleGetConfiguration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type?: string },
  ) {
    try {
      let configuration;

      if (data.type) {
        switch (data.type) {
          case "rateLimit":
            configuration = await this.configurationService.getAllRateLimitConfigs();
            break;
          case "circuitBreaker":
            configuration = await this.configurationService.getAllCircuitBreakerConfigs();
            break;
          case "throttle":
            configuration = await this.configurationService.getAllThrottleConfigs();
            break;
          case "anomalyDetection":
            configuration = await this.configurationService.getAllAnomalyDetectionConfigs();
            break;
          case "global":
            configuration = await this.configurationService.getGlobalConfig();
            break;
          default:
            throw new Error(`Unknown configuration type: ${data.type}`);
        }
      } else {
        configuration = await this.configurationService.exportConfiguration();
      }

      client.emit("configuration", {
        type: data.type || "all",
        data: configuration,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error getting configuration", error);
      client.emit("error", { message: "Failed to get configuration" });
    }
  }

  // Alert Management
  @SubscribeMessage("resolveAlert")
  async handleResolveAlert(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { alertId: string },
  ) {
    try {
      await this.monitoringService.resolveAlert(data.alertId);
      client.emit("alertResolved", {
        alertId: data.alertId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error resolving alert", error);
      client.emit("error", { message: "Failed to resolve alert" });
    }
  }

  // Event Listeners for Broadcasting
  @OnEvent("metrics.system.updated")
  handleSystemMetricsUpdated(metrics: SystemMetrics) {
    this.broadcastToSubscribers("systemMetrics", {
      type: "systemMetrics",
      data: metrics,
      timestamp: new Date(),
    });
  }

  @OnEvent("health.service.updated")
  handleServiceHealthUpdated(health: ServiceHealth) {
    this.broadcastToSubscribers("serviceHealth", {
      type: "serviceHealth",
      data: health,
      timestamp: new Date(),
    });
  }

  @OnEvent("alert.created")
  handleAlertCreated(alert: Alert) {
    this.broadcastToSubscribers("alerts", {
      type: "alertCreated",
      data: alert,
      timestamp: new Date(),
    });
  }

  @OnEvent("alert.resolved")
  handleAlertResolved(alert: Alert) {
    this.broadcastToSubscribers("alerts", {
      type: "alertResolved",
      data: alert,
      timestamp: new Date(),
    });
  }

  @OnEvent("config.changed")
  handleConfigurationChanged(event: ConfigurationChangeEvent) {
    this.broadcastToSubscribers("configuration", {
      type: "configurationChanged",
      data: event,
      timestamp: new Date(),
    });
  }

  // Performance Metrics Broadcasting
  private startMetricsBroadcast() {
    this.metricsInterval = setInterval(async () => {
      try {
        const performanceMetrics = await this.collectPerformanceMetrics();
        this.broadcastToSubscribers("performance", {
          type: "performanceMetrics",
          data: performanceMetrics,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error("Error broadcasting performance metrics", error);
      }
    }, this.METRICS_BROADCAST_INTERVAL);
  }

  private async collectPerformanceMetrics() {
    const metrics = await this.metricsService.getMetrics();
    const currentSystemMetrics = this.monitoringService.getCurrentMetrics();

    return {
      requests: {
        total: metrics.requests_total || 0,
        perSecond: metrics.requests_per_second || 0,
        blocked: metrics.requests_blocked || 0,
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
          }
        : null,
    };
  }

  private async sendInitialData(client: Socket) {
    try {
      // Send current dashboard data
      const dashboardData = await this.monitoringService.getDashboardData();
      client.emit("initialData", {
        dashboard: dashboardData,
        timestamp: new Date(),
      });

      // Send current configuration summary
      const configSummary = await this.getConfigurationSummary();
      client.emit("configurationSummary", {
        data: configSummary,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Error sending initial data", error);
    }
  }

  private async getConfigurationSummary() {
    const [rateLimits, circuitBreakers, throttles, anomalyConfigs] = await Promise.all([
      this.configurationService.getAllRateLimitConfigs(),
      this.configurationService.getAllCircuitBreakerConfigs(),
      this.configurationService.getAllThrottleConfigs(),
      this.configurationService.getAllAnomalyDetectionConfigs(),
    ]);

    return {
      rateLimits: {
        total: rateLimits.length,
        active: rateLimits.filter((config) => config.enabled).length,
      },
      circuitBreakers: {
        total: circuitBreakers.length,
        active: circuitBreakers.filter((config) => config.enabled).length,
      },
      throttles: {
        total: throttles.length,
        active: throttles.filter((config) => config.enabled).length,
      },
      anomalyDetection: {
        total: anomalyConfigs.length,
        active: anomalyConfigs.filter((config) => config.enabled).length,
      },
    };
  }

  private broadcastToSubscribers(channel: string, data: any) {
    for (const [socketId, subscription] of this.connectedClients) {
      if (subscription.subscriptions.has(channel) || subscription.subscriptions.has("*")) {
        // Apply filters if any
        if (this.shouldSendToClient(subscription, data)) {
          this.server.to(socketId).emit(channel, data);
        }
      }
    }
  }

  private shouldSendToClient(subscription: ClientSubscription, data: any): boolean {
    if (!subscription.filters) {
      return true;
    }

    // Apply alert severity filter
    if (data.type === "alertCreated" && subscription.filters.alertSeverity) {
      return subscription.filters.alertSeverity.includes(data.data.severity);
    }

    // Apply service filter
    if (data.type === "serviceHealth" && subscription.filters.services) {
      return subscription.filters.services.includes(data.data.service);
    }

    // Apply metric type filter
    if (data.type === "performanceMetrics" && subscription.filters.metricTypes) {
      // Custom logic for metric type filtering
    }

    return true;
  }

  onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}
