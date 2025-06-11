import type { LogLevel } from "@nestjs/common";
import { Logger, Injectable } from "@nestjs/common";

export interface LogContext {
  component?: string;
  operation?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  nodeId?: string;
  metadata?: Record<string, any>;
}

export interface ShieldLogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  timestamp: number;
  component: string;
}

@Injectable()
export class ShieldLoggerService {
  private readonly logger = new Logger("NestShield");
  private logHistory: ShieldLogEntry[] = [];
  private readonly maxHistorySize = 1000;
  private logLevel: LogLevel = "log";
  private enabledComponents: Set<string> = new Set();
  private disabledComponents: Set<string> = new Set();

  constructor() {
    // Initialize with all components enabled by default
    this.enableAllComponents();
  }

  /**
   * Set the minimum log level for the shield logger
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.logger.localInstance?.setLogLevels?.([level]);
  }

  /**
   * Enable logging for specific components
   */
  enableComponent(component: string): void {
    this.enabledComponents.add(component);
    this.disabledComponents.delete(component);
  }

  /**
   * Disable logging for specific components
   */
  disableComponent(component: string): void {
    this.disabledComponents.add(component);
    this.enabledComponents.delete(component);
  }

  /**
   * Enable logging for all components
   */
  enableAllComponents(): void {
    this.enabledComponents.clear();
    this.disabledComponents.clear();
    // Add all known components
    const components = [
      "ShieldModule",
      "CircuitBreaker",
      "RateLimit",
      "Throttle",
      "Overload",
      "Metrics",
      "AnomalyDetection",
      "Storage",
      "DistributedSync",
      "GracefulShutdown",
      "Guards",
      "Interceptors",
      "Adapters",
    ];
    components.forEach((comp) => this.enabledComponents.add(comp));
  }

  /**
   * Check if logging is enabled for a component
   */
  private isComponentEnabled(component: string): boolean {
    if (this.disabledComponents.has(component)) {
      return false;
    }
    return this.enabledComponents.size === 0 || this.enabledComponents.has(component);
  }

  /**
   * Add entry to log history for debugging
   */
  private addToHistory(entry: ShieldLogEntry): void {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  /**
   * Get recent log entries
   */
  getLogHistory(): ShieldLogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    component: string,
    context?: LogContext,
    error?: Error,
  ): void {
    if (!this.isComponentEnabled(component)) {
      return;
    }

    const entry: ShieldLogEntry = {
      level,
      message,
      context,
      error,
      timestamp: Date.now(),
      component,
    };

    this.addToHistory(entry);

    // Format message with context
    const formattedMessage = this.formatMessage(message, context);
    const loggerContext = `Shield:${component}`;

    // Use NestJS Logger with appropriate level
    switch (level) {
      case "error":
        this.logger.error(formattedMessage, error?.stack, loggerContext);
        break;
      case "warn":
        this.logger.warn(formattedMessage, loggerContext);
        break;
      case "debug":
        this.logger.debug(formattedMessage, loggerContext);
        break;
      case "verbose":
        this.logger.verbose(formattedMessage, loggerContext);
        break;
      case "fatal":
        this.logger.fatal(formattedMessage, error?.stack, loggerContext);
        break;
      case "log":
      default:
        this.logger.log(formattedMessage, loggerContext);
        break;
    }
  }

  /**
   * Format message with context information
   */
  private formatMessage(message: string, context?: LogContext): string {
    if (!context) {
      return message;
    }

    const contextParts: string[] = [];

    if (context.operation) {
      contextParts.push(`op=${context.operation}`);
    }

    if (context.requestId) {
      contextParts.push(`req=${context.requestId}`);
    }

    if (context.correlationId) {
      contextParts.push(`corr=${context.correlationId}`);
    }

    if (context.nodeId) {
      contextParts.push(`node=${context.nodeId}`);
    }

    if (context.userId) {
      contextParts.push(`user=${context.userId}`);
    }

    if (context.ip) {
      contextParts.push(`ip=${context.ip}`);
    }

    if (context.metadata && Object.keys(context.metadata).length > 0) {
      contextParts.push(`meta=${JSON.stringify(context.metadata)}`);
    }

    if (contextParts.length > 0) {
      return `${message} [${contextParts.join(", ")}]`;
    }

    return message;
  }

  // Public logging methods for different components

  /**
   * Shield Module logging
   */
  module(message: string, context?: LogContext): void {
    this.log("log", message, "ShieldModule", context);
  }

  moduleError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "ShieldModule", context, error);
  }

  moduleWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "ShieldModule", context);
  }

  moduleDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "ShieldModule", context);
  }

  /**
   * Circuit Breaker logging
   */
  circuitBreaker(message: string, context?: LogContext): void {
    this.log("log", message, "CircuitBreaker", context);
  }

  circuitBreakerError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "CircuitBreaker", context, error);
  }

  circuitBreakerWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "CircuitBreaker", context);
  }

  circuitBreakerDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "CircuitBreaker", context);
  }

  /**
   * Rate Limit logging
   */
  rateLimit(message: string, context?: LogContext): void {
    this.log("log", message, "RateLimit", context);
  }

  rateLimitError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "RateLimit", context, error);
  }

  rateLimitWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "RateLimit", context);
  }

  rateLimitDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "RateLimit", context);
  }

  /**
   * Throttle logging
   */
  throttle(message: string, context?: LogContext): void {
    this.log("log", message, "Throttle", context);
  }

  throttleError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Throttle", context, error);
  }

  throttleWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Throttle", context);
  }

  throttleDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Throttle", context);
  }

  /**
   * Overload logging
   */
  overload(message: string, context?: LogContext): void {
    this.log("log", message, "Overload", context);
  }

  overloadError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Overload", context, error);
  }

  overloadWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Overload", context);
  }

  overloadDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Overload", context);
  }

  /**
   * Metrics logging
   */
  metrics(message: string, context?: LogContext): void {
    this.log("log", message, "Metrics", context);
  }

  metricsError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Metrics", context, error);
  }

  metricsWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Metrics", context);
  }

  metricsDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Metrics", context);
  }

  /**
   * Anomaly Detection logging
   */
  anomaly(message: string, context?: LogContext): void {
    this.log("log", message, "AnomalyDetection", context);
  }

  anomalyError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "AnomalyDetection", context, error);
  }

  anomalyWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "AnomalyDetection", context);
  }

  anomalyDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "AnomalyDetection", context);
  }

  /**
   * Storage logging
   */
  storage(message: string, context?: LogContext): void {
    this.log("log", message, "Storage", context);
  }

  storageError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Storage", context, error);
  }

  storageWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Storage", context);
  }

  storageDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Storage", context);
  }

  /**
   * Distributed Sync logging
   */
  distributedSync(message: string, context?: LogContext): void {
    this.log("log", message, "DistributedSync", context);
  }

  distributedSyncError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "DistributedSync", context, error);
  }

  distributedSyncWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "DistributedSync", context);
  }

  distributedSyncDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "DistributedSync", context);
  }

  /**
   * Graceful Shutdown logging
   */
  shutdown(message: string, context?: LogContext): void {
    this.log("log", message, "GracefulShutdown", context);
  }

  shutdownError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "GracefulShutdown", context, error);
  }

  shutdownWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "GracefulShutdown", context);
  }

  shutdownDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "GracefulShutdown", context);
  }

  /**
   * Guards logging
   */
  guard(message: string, context?: LogContext): void {
    this.log("log", message, "Guards", context);
  }

  guardError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Guards", context, error);
  }

  guardWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Guards", context);
  }

  guardDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Guards", context);
  }

  /**
   * Interceptors logging
   */
  interceptor(message: string, context?: LogContext): void {
    this.log("log", message, "Interceptors", context);
  }

  interceptorError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Interceptors", context, error);
  }

  interceptorWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Interceptors", context);
  }

  interceptorDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Interceptors", context);
  }

  /**
   * Adapters logging
   */
  adapter(message: string, context?: LogContext): void {
    this.log("log", message, "Adapters", context);
  }

  adapterError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Adapters", context, error);
  }

  adapterWarn(message: string, context?: LogContext): void {
    this.log("warn", message, "Adapters", context);
  }

  adapterDebug(message: string, context?: LogContext): void {
    this.log("debug", message, "Adapters", context);
  }

  /**
   * Performance monitoring
   */
  performance(message: string, duration?: number, context?: LogContext): void {
    const perfContext = {
      ...context,
      metadata: {
        ...context?.metadata,
        duration: duration ? `${duration}ms` : undefined,
      },
    };
    this.log("log", message, "Performance", perfContext);
  }

  /**
   * Security logging
   */
  security(message: string, context?: LogContext): void {
    this.log("warn", message, "Security", context);
  }

  securityError(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, "Security", context, error);
  }

  /**
   * System health logging
   */
  health(
    message: string,
    status: "healthy" | "unhealthy" | "degraded",
    context?: LogContext,
  ): void {
    const healthContext = {
      ...context,
      metadata: {
        ...context?.metadata,
        status,
      },
    };
    const level = status === "healthy" ? "log" : status === "degraded" ? "warn" : "error";
    this.log(level, message, "Health", healthContext);
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByComponent: Record<string, number>;
    enabledComponents: string[];
    disabledComponents: string[];
  } {
    const logsByLevel: Record<LogLevel, number> = {
      error: 0,
      warn: 0,
      log: 0,
      debug: 0,
      verbose: 0,
      fatal: 0,
    };

    const logsByComponent: Record<string, number> = {};

    this.logHistory.forEach((entry) => {
      logsByLevel[entry.level]++;
      logsByComponent[entry.component] = (logsByComponent[entry.component] || 0) + 1;
    });

    return {
      totalLogs: this.logHistory.length,
      logsByLevel,
      logsByComponent,
      enabledComponents: Array.from(this.enabledComponents),
      disabledComponents: Array.from(this.disabledComponents),
    };
  }
}
