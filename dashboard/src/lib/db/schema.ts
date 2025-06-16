import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  decimal,
  int,
  json,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// Authentication Tables (NextAuth.js compatible)
export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified"),
  image: varchar("image", { length: 255 }),
  role: varchar("role", { length: 50 }).default("user"), // 'admin', 'user', 'viewer'
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'banned', 'suspended'
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const accounts = mysqlTable(
  "accounts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("userId", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
  }),
);

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionToken: varchar("sessionToken", { length: 255 }).notNull(),
  userId: varchar("userId", { length: 255 }).notNull(),
  expires: timestamp("expires").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  device: varchar("device", { length: 255 }),
  location: varchar("location", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationTokens = mysqlTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
    type: varchar("type", { length: 50 }).default("email"), // 'email', 'password_reset', 'magic_link'
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
  }),
);

// WebAuthn/Passkeys Tables
export const authenticators = mysqlTable("authenticators", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  credentialId: text("credential_id").notNull(),
  credentialPublicKey: text("credential_public_key").notNull(),
  counter: bigint("counter", { mode: "number" }).notNull(),
  credentialDeviceType: varchar("credential_device_type", { length: 32 }).notNull(),
  credentialBackedUp: boolean("credential_backed_up").notNull(),
  transports: json("transports"),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// Activity Logs
export const activityLogs = mysqlTable("activity_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(), // 'login', 'logout', 'config_change', etc.
  resource: varchar("resource", { length: 255 }), // The resource affected
  resourceId: varchar("resource_id", { length: 255 }), // ID of the resource
  details: json("details"), // Additional details about the action
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Magic Link Tokens
export const magicLinkTokens = mysqlTable("magic_link_tokens", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expires: timestamp("expires").notNull(),
  used: boolean("used").default(false),
  usedAt: timestamp("used_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Two-Factor Authentication Backup Codes
export const twoFactorBackupCodes = mysqlTable("two_factor_backup_codes", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  used: boolean("used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for authentication tables
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  authenticators: many(authenticators),
  activityLogs: many(activityLogs),
  backupCodes: many(twoFactorBackupCodes),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
  user: one(users, {
    fields: [authenticators.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const twoFactorBackupCodesRelations = relations(twoFactorBackupCodes, ({ one }) => ({
  user: one(users, {
    fields: [twoFactorBackupCodes.userId],
    references: [users.id],
  }),
}));

// Shield Configuration Tables
export const shieldConfigs = mysqlTable("shield_configs", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  config: json("config").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Metrics Tables
export const metrics = mysqlTable("metrics", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  timestamp: datetime("timestamp").notNull(),
  metricType: varchar("metric_type", { length: 100 }).notNull(), // 'request', 'response_time', 'error', etc.
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  tags: json("tags"), // Additional metadata
  source: varchar("source", { length: 255 }), // Source service/endpoint
  createdAt: timestamp("created_at").defaultNow(),
});

// Rate Limit Rules
export const rateLimitRules = mysqlTable("rate_limit_rules", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  windowMs: int("window_ms").notNull(),
  maxRequests: int("max_requests").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Circuit Breaker Rules
export const circuitBreakerRules = mysqlTable("circuit_breaker_rules", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  service: varchar("service", { length: 255 }).notNull(),
  failureThreshold: int("failure_threshold").notNull(),
  recoveryTimeout: int("recovery_timeout").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Throttle Rules
export const throttleRules = mysqlTable("throttle_rules", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  ttl: int("ttl").notNull(),
  limit: int("limit").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Anomaly Detection Settings
export const anomalyDetectionSettings = mysqlTable("anomaly_detection_settings", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  detectorType: varchar("detector_type", { length: 100 }).notNull(), // 'zscore', 'isolation_forest', etc.
  config: json("config").notNull(),
  threshold: decimal("threshold", { precision: 5, scale: 3 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Alerts and Notifications
export const alerts = mysqlTable("alerts", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  type: varchar("type", { length: 100 }).notNull(), // 'anomaly', 'circuit_breaker', 'rate_limit'
  severity: varchar("severity", { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  metadata: json("metadata"),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: datetime("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// System Health Checks
export const healthChecks = mysqlTable("health_checks", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  service: varchar("service", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(), // 'healthy', 'degraded', 'unhealthy'
  responseTime: int("response_time"), // in milliseconds
  details: json("details"),
  checkedAt: timestamp("checked_at").defaultNow(),
});

// Dashboard Settings
export const dashboardSettings = mysqlTable("dashboard_settings", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  theme: varchar("theme", { length: 20 }).default("light"),
  language: varchar("language", { length: 5 }).default("en"),
  dashboardLayout: json("dashboard_layout"),
  notifications: json("notifications"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Request Logs (for analysis and monitoring)
export const requestLogs = mysqlTable("request_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  timestamp: datetime("timestamp").notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 1000 }).notNull(),
  statusCode: int("status_code").notNull(),
  responseTime: int("response_time").notNull(),
  userAgent: text("user_agent"),
  ip: varchar("ip", { length: 45 }).notNull(),
  size: bigint("size", { mode: "number" }),
  blocked: boolean("blocked").default(false),
  blockReason: varchar("block_reason", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Data Retention Policies
export const dataRetentionPolicies = mysqlTable("data_retention_policies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  dataType: varchar("data_type", { length: 100 }).notNull(), // 'activity_logs', 'metrics', 'request_logs', 'alerts'
  retentionPeriodDays: int("retention_period_days").notNull(),
  cleanupFrequency: varchar("cleanup_frequency", { length: 20 }).notNull(), // 'daily', 'weekly', 'monthly'
  isActive: boolean("is_active").default(true),
  lastCleanupAt: timestamp("last_cleanup_at"),
  nextCleanupAt: timestamp("next_cleanup_at"),
  totalRecordsProcessed: bigint("total_records_processed", { mode: "number" }).default(0),
  totalRecordsDeleted: bigint("total_records_deleted", { mode: "number" }).default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Data Retention Cleanup Jobs
export const retentionCleanupJobs = mysqlTable("retention_cleanup_jobs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  policyId: int("policy_id").notNull(),
  jobId: varchar("job_id", { length: 255 }), // External job ID (e.g., from job queue)
  status: varchar("status", { length: 20 }).notNull(), // 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recordsProcessed: bigint("records_processed", { mode: "number" }).default(0),
  recordsDeleted: bigint("records_deleted", { mode: "number" }).default(0),
  errorMessage: text("error_message"),
  metadata: json("metadata"), // Additional job details
  createdAt: timestamp("created_at").defaultNow(),
});

// Data Retention Configuration
export const retentionConfiguration = mysqlTable("retention_configuration", {
  id: int("id").primaryKey().autoincrement(),
  globalEnabled: boolean("global_enabled").default(true),
  maxConcurrentJobs: int("max_concurrent_jobs").default(3),
  batchSize: int("batch_size").default(1000),
  jobTimeout: int("job_timeout").default(3600), // seconds
  notifications: json("notifications"), // Notification settings
  schedulerConfig: json("scheduler_config"), // Scheduler configuration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Relations
export const shieldConfigsRelations = relations(shieldConfigs, ({ many }) => ({
  rateLimitRules: many(rateLimitRules),
  circuitBreakerRules: many(circuitBreakerRules),
  throttleRules: many(throttleRules),
}));

export const dataRetentionPoliciesRelations = relations(dataRetentionPolicies, ({ many }) => ({
  cleanupJobs: many(retentionCleanupJobs),
}));

export const retentionCleanupJobsRelations = relations(retentionCleanupJobs, ({ one }) => ({
  policy: one(dataRetentionPolicies, {
    fields: [retentionCleanupJobs.policyId],
    references: [dataRetentionPolicies.id],
  }),
}));
