import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IAnomaly, AnomalySeverity } from "../interfaces/anomaly.interface";
import {
  IAnomalyAlert,
  IAlertRule,
  AlertStatus,
  IEscalationPolicy,
  NotificationChannel,
  NotificationStatus,
  ContentFormat,
} from "../interfaces/alert.interface";
import { v4 as uuidv4 } from "uuid";

export interface INotificationChannel {
  type: NotificationChannel;
  config: Record<string, any>;
  enabled?: boolean;
}

interface IAlertingServiceConfig {
  enabled: boolean;
  channels: INotificationChannel[];
  escalationPolicy: IEscalationPolicy;
  suppressionRules?: ISimpleSuppressionRule[];
  rateLimiting?: {
    maxAlertsPerMinute: number;
    maxAlertsPerHour: number;
  };
  autoAcknowledgment?: {
    enabled: boolean;
    timeoutMinutes: number;
  };
}

export interface ISimpleSuppressionRule {
  id: string;
  name: string;
  condition: string;
  enabled: boolean;
  validFrom?: Date;
  validTo?: Date;
  reason: string;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private alerts: Map<string, IAnomalyAlert> = new Map();
  private alertRules: Map<string, IAlertRule> = new Map();
  private suppressionRules: Map<string, ISimpleSuppressionRule> = new Map();
  private alertHistory: IAnomalyAlert[] = [];
  private config: IAlertingServiceConfig;
  private alertCounts = {
    lastMinute: { count: 0, timestamp: Date.now() },
    lastHour: { count: 0, timestamp: Date.now() },
  };

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Default configuration
    this.config = {
      enabled: true,
      channels: [],
      escalationPolicy: {
        id: "default",
        name: "Default Escalation",
        description: "Default escalation policy",
        enabled: true,
        levels: [
          {
            level: 1,
            delay: 0,
            recipients: [],
            channels: [NotificationChannel.LOG],
            stopEscalation: false,
          },
          {
            level: 2,
            delay: 5, // 5 minutes
            recipients: [],
            channels: [NotificationChannel.WEBHOOK],
            stopEscalation: false,
          },
          {
            level: 3,
            delay: 10, // 10 minutes after level 2
            recipients: [],
            channels: [NotificationChannel.EMAIL],
            stopEscalation: true,
          },
        ],
        repeat: false,
        repeatInterval: 0,
      },
      rateLimiting: {
        maxAlertsPerMinute: 10,
        maxAlertsPerHour: 100,
      },
      autoAcknowledgment: {
        enabled: true,
        timeoutMinutes: 60,
      },
    };
  }

  configure(config: Partial<IAlertingServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log(`Alerting service configured with ${this.config.channels.length} channels`);
  }

  async processAnomaly(anomaly: IAnomaly): Promise<IAnomalyAlert | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check suppression rules
    if (this.isAnomalySuppressed(anomaly)) {
      this.logger.debug(`Anomaly ${anomaly.id} suppressed by rules`);
      return null;
    }

    // Check rate limiting
    if (!this.isWithinRateLimit()) {
      this.logger.warn("Alert rate limit exceeded, dropping alert");
      return null;
    }

    // Find matching alert rule
    const alertRule = this.findMatchingAlertRule(anomaly);
    if (!alertRule) {
      this.logger.debug(`No alert rule found for anomaly ${anomaly.id}`);
      return null;
    }

    // Create alert
    const alert = this.createAlert(anomaly, alertRule);
    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Trigger notifications
    await this.triggerNotifications(alert);

    // Schedule escalations
    this.scheduleEscalations(alert);

    // Emit event for external systems
    this.eventEmitter.emit("anomaly.alert.created", alert);

    this.logger.log(`Alert ${alert.id} created for anomaly ${anomaly.id}`);
    return alert;
  }

  private isAnomalySuppressed(anomaly: IAnomaly): boolean {
    for (const rule of this.suppressionRules.values()) {
      if (!rule.enabled) continue;

      const now = new Date();
      if (rule.validFrom && now < rule.validFrom) continue;
      if (rule.validTo && now > rule.validTo) continue;

      try {
        // Simple expression evaluation - in production, use a proper expression engine
        const context = {
          severity: anomaly.severity,
          type: anomaly.type,
          metric: anomaly.context.metric,
          score: anomaly.score,
          ...anomaly.data.metadata,
        };

        if (this.evaluateCondition(rule.condition, context)) {
          return true;
        }
      } catch (error) {
        this.logger.error(`Error evaluating suppression rule ${rule.id}: ${error.message}`);
      }
    }

    return false;
  }

  private isWithinRateLimit(): boolean {
    const now = Date.now();
    const oneMinute = 60 * 1000;
    const oneHour = 60 * 60 * 1000;

    // Reset counters if time window has passed
    if (now - this.alertCounts.lastMinute.timestamp > oneMinute) {
      this.alertCounts.lastMinute = { count: 0, timestamp: now };
    }
    if (now - this.alertCounts.lastHour.timestamp > oneHour) {
      this.alertCounts.lastHour = { count: 0, timestamp: now };
    }

    // Check limits
    if (this.alertCounts.lastMinute.count >= this.config.rateLimiting!.maxAlertsPerMinute) {
      return false;
    }
    if (this.alertCounts.lastHour.count >= this.config.rateLimiting!.maxAlertsPerHour) {
      return false;
    }

    // Increment counters
    this.alertCounts.lastMinute.count++;
    this.alertCounts.lastHour.count++;

    return true;
  }

  private findMatchingAlertRule(anomaly: IAnomaly): IAlertRule | null {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check severity threshold from metadata
      if (
        rule.metadata?.severityThreshold &&
        !this.meetsSeveityThreshold(anomaly.severity, rule.metadata.severityThreshold)
      ) {
        continue;
      }

      // Check metric patterns from metadata
      if (rule.metadata?.metricPatterns?.length > 0) {
        const matchesPattern = rule.metadata.metricPatterns.some((pattern: string) =>
          new RegExp(pattern).test(anomaly.context.metric),
        );
        if (!matchesPattern) continue;
      }

      // Check anomaly types from metadata
      if (
        rule.metadata?.anomalyTypes?.length > 0 &&
        !rule.metadata.anomalyTypes.includes(anomaly.type)
      ) {
        continue;
      }

      return rule;
    }

    return null;
  }

  private meetsSeveityThreshold(severity: string, threshold: string): boolean {
    const severityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const severityIndex = severityOrder.indexOf(severity.toUpperCase());
    const thresholdIndex = severityOrder.indexOf(threshold.toUpperCase());
    return severityIndex >= thresholdIndex;
  }

  private createAlert(anomaly: IAnomaly, alertRule: IAlertRule): IAnomalyAlert {
    return {
      id: uuidv4(),
      anomaly,
      alertRule,
      status: AlertStatus.OPEN,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      escalations: [],
      notifications: [],
      suppressions: [],
      metadata: {
        source: "AlertingService",
        version: "1.0.0",
      },
    };
  }

  private async triggerNotifications(alert: IAnomalyAlert): Promise<void> {
    const escalationLevel = this.config.escalationPolicy.levels[0];

    for (const channelType of escalationLevel.channels) {
      try {
        await this.sendNotification(
          alert,
          channelType,
          escalationLevel.recipients.map((r: any) => r.id || r),
        );
      } catch (error) {
        this.logger.error(`Failed to send notification via ${channelType}: ${error.message}`);
      }
    }
  }

  private async sendNotification(
    alert: IAnomalyAlert,
    channelType: NotificationChannel,
    recipients: string[],
  ): Promise<void> {
    const channel = this.config.channels.find((c) => c.type === channelType);
    if (!channel || !channel.enabled) {
      return;
    }

    const message = this.formatAlertMessage(alert);

    switch (channelType) {
      case NotificationChannel.LOG:
        this.logger.warn(`ALERT: ${message}`);
        break;

      case NotificationChannel.WEBHOOK:
        if (channel.config.url) {
          await this.sendWebhookNotification(channel.config.url, alert);
        }
        break;

      case NotificationChannel.EMAIL:
        if (channel.config.recipients?.length > 0) {
          await this.sendEmailNotification(channel.config.recipients, alert);
        }
        break;

      case NotificationChannel.SLACK:
        if (channel.config.webhook) {
          await this.sendSlackNotification(channel.config.webhook, alert);
        }
        break;

      case NotificationChannel.SMS:
        if (channel.config.phoneNumbers?.length > 0) {
          await this.sendSMSNotification(channel.config.phoneNumbers, alert);
        }
        break;
    }

    // Record notification
    alert.notifications.push({
      id: uuidv4(),
      channel: channelType,
      recipient: recipients[0] || "system",
      sentAt: Date.now(),
      status: NotificationStatus.SENT,
      retryCount: 0,
      content: {
        subject: "Anomaly Alert",
        body: this.formatAlertMessage(alert),
        format: ContentFormat.TEXT,
      },
      metadata: {},
    });
  }

  private formatAlertMessage(alert: IAnomalyAlert): string {
    const { anomaly } = alert;
    return `🚨 ANOMALY DETECTED
Metric: ${anomaly.context.metric}
Severity: ${anomaly.severity}
Type: ${anomaly.type}
Score: ${anomaly.score.toFixed(3)}
Value: ${anomaly.actualValue}
Expected: ${anomaly.expectedValue || "N/A"}
Deviation: ${anomaly.deviation.toFixed(3)}
Timestamp: ${new Date(anomaly.timestamp).toISOString()}
Description: ${anomaly.description}`;
  }

  private async sendWebhookNotification(url: string, alert: IAnomalyAlert): Promise<void> {
    // Implementation would use HTTP client to send webhook
    this.logger.debug(`Sending webhook notification to ${url}`);
  }

  private async sendEmailNotification(recipients: string[], alert: IAnomalyAlert): Promise<void> {
    // Implementation would integrate with email service
    this.logger.debug(`Sending email notification to ${recipients.join(", ")}`);
  }

  private async sendSlackNotification(webhook: string, alert: IAnomalyAlert): Promise<void> {
    // Implementation would send Slack webhook
    this.logger.debug(`Sending Slack notification to ${webhook}`);
  }

  private async sendSMSNotification(phoneNumbers: string[], alert: IAnomalyAlert): Promise<void> {
    // Implementation would integrate with SMS service
    this.logger.debug(`Sending SMS notification to ${phoneNumbers.join(", ")}`);
  }

  private scheduleEscalations(alert: IAnomalyAlert): void {
    const policy = this.config.escalationPolicy;

    for (let i = 1; i < policy.levels.length; i++) {
      const level = policy.levels[i];

      setTimeout(
        async () => {
          // Check if alert is still open and not acknowledged
          const currentAlert = this.alerts.get(alert.id);
          if (
            currentAlert &&
            currentAlert.status === AlertStatus.OPEN &&
            !currentAlert.acknowledgedAt
          ) {
            await this.escalateAlert(currentAlert, level);
          }
        },
        level.delay * 60 * 1000,
      ); // delay is in minutes
    }
  }

  private async escalateAlert(alert: IAnomalyAlert, escalationLevel: any): Promise<void> {
    this.logger.warn(`Escalating alert ${alert.id} to level ${escalationLevel.level}`);

    // Send notifications for this escalation level
    for (const channelType of escalationLevel.channels) {
      try {
        await this.sendNotification(
          alert,
          channelType,
          escalationLevel.recipients.map((r: any) => r.id || r),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send escalation notification via ${channelType}: ${error.message}`,
        );
      }
    }

    // Record escalation
    alert.escalations.push({
      level: escalationLevel.level,
      triggeredAt: Date.now(),
      recipients: escalationLevel.recipients.map((r: any) => r.id || r),
      channels: escalationLevel.channels.map((c: any) => c.toString()),
      reason: "Auto-escalation due to unacknowledged alert",
      acknowledged: false,
    });

    alert.updatedAt = Date.now();
    this.eventEmitter.emit("anomaly.alert.escalated", alert);
  }

  // Alert management methods
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = acknowledgedBy;
    alert.updatedAt = Date.now();

    this.eventEmitter.emit("anomaly.alert.acknowledged", alert);
    this.logger.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    return true;
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = Date.now();
    alert.updatedAt = Date.now();

    this.eventEmitter.emit("anomaly.alert.resolved", alert);
    this.logger.log(`Alert ${alertId} resolved`);
    return true;
  }

  // Configuration methods
  addAlertRule(rule: IAlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.log(`Added alert rule: ${rule.name}`);
  }

  addSuppressionRule(rule: ISimpleSuppressionRule): void {
    this.suppressionRules.set(rule.id, rule);
    this.logger.log(`Added suppression rule: ${rule.name}`);
  }

  // Query methods
  getActiveAlerts(): IAnomalyAlert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.status === AlertStatus.OPEN || alert.status === AlertStatus.ACKNOWLEDGED,
    );
  }

  getAlertHistory(limit: number = 100): IAnomalyAlert[] {
    return this.alertHistory.slice(-limit);
  }

  getAlertStatistics(): any {
    const alerts = Array.from(this.alerts.values());
    return {
      total: alerts.length,
      byStatus: {
        open: alerts.filter((a) => a.status === AlertStatus.OPEN).length,
        acknowledged: alerts.filter((a) => a.status === AlertStatus.ACKNOWLEDGED).length,
        resolved: alerts.filter((a) => a.status === AlertStatus.RESOLVED).length,
        suppressed: alerts.filter((a) => a.status === AlertStatus.SUPPRESSED).length,
      },
      bySeverity: {
        critical: alerts.filter((a) => a.anomaly.severity === AnomalySeverity.CRITICAL).length,
        high: alerts.filter((a) => a.anomaly.severity === AnomalySeverity.HIGH).length,
        medium: alerts.filter((a) => a.anomaly.severity === AnomalySeverity.MEDIUM).length,
        low: alerts.filter((a) => a.anomaly.severity === AnomalySeverity.LOW).length,
      },
      averageResolutionTime: this.calculateAverageResolutionTime(alerts),
    };
  }

  private calculateAverageResolutionTime(alerts: IAnomalyAlert[]): number {
    const resolvedAlerts = alerts.filter((a) => a.resolvedAt && a.createdAt);
    if (resolvedAlerts.length === 0) return 0;

    const totalTime = resolvedAlerts.reduce(
      (sum, alert) => sum + (alert.resolvedAt! - alert.createdAt),
      0,
    );

    return totalTime / resolvedAlerts.length;
  }

  private evaluateCondition(condition: string, context: any): boolean {
    // Simple expression evaluator - in production, use a proper expression engine
    try {
      // Replace variables in condition with actual values
      let evaluableCondition = condition;
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, "g");
        evaluableCondition = evaluableCondition.replace(regex, JSON.stringify(value));
      }

      // This is a simplified evaluation - use a proper expression library in production
      return Function(`"use strict"; return (${evaluableCondition})`)();
    } catch (error) {
      this.logger.error(`Error evaluating condition: ${condition}`, error);
      return false;
    }
  }
}
