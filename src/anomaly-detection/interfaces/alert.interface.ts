import type { IAnomaly } from "./anomaly.interface";

export interface IAnomalyAlert {
  id: string;
  anomaly: IAnomaly;
  alertRule: IAlertRule;
  status: AlertStatus;
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  escalations: IEscalation[];
  notifications: INotification[];
  suppressions: ISuppression[];
  metadata: Record<string, any>;
}

export enum AlertStatus {
  OPEN = "open",
  ACKNOWLEDGED = "acknowledged",
  SUPPRESSED = "suppressed",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export interface IAlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: IAlertCondition[];
  severity: string;
  priority: AlertPriority;
  notificationChannels: string[];
  escalationPolicy?: string;
  suppressionRules: ISuppressionRule[];
  autoResolve: boolean;
  autoResolveTimeout: number;
  metadata: Record<string, any>;
}

export enum AlertPriority {
  P1 = "P1", // Critical - immediate response required
  P2 = "P2", // High - response within 30 minutes
  P3 = "P3", // Medium - response within 2 hours
  P4 = "P4", // Low - response within 24 hours
  P5 = "P5", // Informational - no immediate response required
}

export interface IAlertCondition {
  metric: string;
  anomalyTypes: string[];
  severityThreshold: string;
  confidenceThreshold: number;
  timeWindow: number;
  aggregation: AggregationType;
  operator: ComparisonOperator;
  value: number;
  labels?: Record<string, string>;
}

export enum AggregationType {
  COUNT = "count",
  SUM = "sum",
  AVG = "avg",
  MIN = "min",
  MAX = "max",
  P95 = "p95",
  P99 = "p99",
}

export enum ComparisonOperator {
  GT = "gt",
  GTE = "gte",
  LT = "lt",
  LTE = "lte",
  EQ = "eq",
  NEQ = "neq",
}

export interface IEscalation {
  level: number;
  triggeredAt: number;
  recipients: string[];
  channels: string[];
  reason: string;
  acknowledged: boolean;
}

export interface INotification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  sentAt: number;
  status: NotificationStatus;
  retryCount: number;
  content: INotificationContent;
  metadata: Record<string, any>;
}

export enum NotificationChannel {
  LOG = "log",
  EMAIL = "email",
  SMS = "sms",
  SLACK = "slack",
  TEAMS = "teams",
  DISCORD = "discord",
  WEBHOOK = "webhook",
  PAGERDUTY = "pagerduty",
  OPSGENIE = "opsgenie",
  JIRA = "jira",
}

export enum NotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  RETRYING = "retrying",
}

export interface INotificationContent {
  subject: string;
  body: string;
  format: ContentFormat;
  attachments?: IAttachment[];
  actions?: INotificationAction[];
}

export enum ContentFormat {
  TEXT = "text",
  HTML = "html",
  MARKDOWN = "markdown",
  JSON = "json",
}

export interface IAttachment {
  filename: string;
  contentType: string;
  data: string; // base64 encoded
  size: number;
}

export interface INotificationAction {
  id: string;
  label: string;
  action: string;
  style: ActionStyle;
  url?: string;
}

export enum ActionStyle {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  DANGER = "danger",
  SUCCESS = "success",
}

export interface ISuppression {
  id: string;
  rule: ISuppressionRule;
  startTime: number;
  endTime: number;
  reason: string;
  createdBy: string;
  active: boolean;
}

export interface ISuppressionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: ISuppressionCondition[];
  duration: number; // in milliseconds
  recurring: boolean;
  schedule?: ISchedule;
  createdBy: string;
  createdAt: number;
}

export interface ISuppressionCondition {
  field: string;
  operator: ComparisonOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

export enum LogicalOperator {
  AND = "and",
  OR = "or",
  NOT = "not",
}

export interface ISchedule {
  type: ScheduleType;
  timezone: string;
  recurrence: IRecurrence;
  exceptions?: IScheduleException[];
}

export enum ScheduleType {
  ONCE = "once",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  CUSTOM = "custom",
}

export interface IRecurrence {
  interval: number;
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  daysOfMonth?: number[]; // 1-31
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface IScheduleException {
  date: string; // YYYY-MM-DD format
  reason: string;
}

export interface IAlertingConfig {
  enabled: boolean;
  defaultSeverity: string;
  defaultPriority: AlertPriority;
  globalSuppressions: ISuppressionRule[];
  notificationDefaults: INotificationDefaults;
  escalationPolicies: IEscalationPolicy[];
  alertRules: IAlertRule[];
  integrations: IIntegrationConfig[];
}

export interface INotificationDefaults {
  channels: NotificationChannel[];
  retryAttempts: number;
  retryInterval: number;
  timeout: number;
  templates: INotificationTemplate[];
}

export interface INotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  format: ContentFormat;
  variables: ITemplateVariable[];
}

export interface ITemplateVariable {
  name: string;
  description: string;
  type: VariableType;
  defaultValue?: any;
  required: boolean;
}

export enum VariableType {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  DATE = "date",
  OBJECT = "object",
  ARRAY = "array",
}

export interface IEscalationPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  levels: IEscalationLevel[];
  repeat: boolean;
  repeatInterval: number;
}

export interface IEscalationLevel {
  level: number;
  delay: number; // delay in minutes from previous level
  recipients: IRecipient[];
  channels: NotificationChannel[];
  stopEscalation: boolean;
}

export interface IRecipient {
  type: RecipientType;
  id: string;
  name: string;
  contact: string;
  timezone?: string;
  availability?: IAvailability;
}

export enum RecipientType {
  USER = "user",
  TEAM = "team",
  ONCALL = "oncall",
  EXTERNAL = "external",
}

export interface IAvailability {
  schedule: ISchedule;
  backup?: IRecipient;
}

export interface IIntegrationConfig {
  type: IntegrationType;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  credentials: Record<string, string>;
  mappings: IFieldMapping[];
}

export enum IntegrationType {
  PAGERDUTY = "pagerduty",
  OPSGENIE = "opsgenie",
  SLACK = "slack",
  TEAMS = "teams",
  JIRA = "jira",
  SERVICENOW = "servicenow",
  WEBHOOK = "webhook",
  EMAIL = "email",
  SMS = "sms",
}

export interface IFieldMapping {
  source: string;
  target: string;
  transform?: string;
  defaultValue?: any;
}
