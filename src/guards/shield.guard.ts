import type { ExecutionContext, CanActivate, BeforeApplicationShutdown } from "@nestjs/common";
import { Injectable, Inject, HttpStatus, HttpException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Reflector } from "@nestjs/core";
import type { Response, Request } from "express";
import { SHIELD_DECORATORS } from "../core/constants";
import { DI_TOKENS } from "../core/di-tokens";
import type {
  IThrottleConfig,
  IShieldConfig,
  IRateLimitConfig,
  IProtectionContext,
  IOverloadConfig,
  ICircuitBreakerConfig,
} from "../interfaces/shield-config.interface";
import type {
  ThrottleService,
  ShieldLoggerService,
  RateLimitService,
  PriorityManagerService,
  OverloadService,
  MetricsService,
  DistributedSyncService,
  CircuitBreakerService,
} from "../services";
import {
  ThrottleException,
  ShieldException,
  RateLimitException,
  OverloadException,
  CircuitBreakerException,
} from "../core/exceptions";

/**
 * Protection result interface for internal use
 */
interface IProtectionResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  metadata?: Record<string, any>;
}

/**
 * Protection metadata extracted from decorators
 */
interface IProtectionMetadata {
  circuitBreaker?: Partial<ICircuitBreakerConfig>;
  rateLimit?: Partial<IRateLimitConfig>;
  throttle?: Partial<IThrottleConfig>;
  overload?: Partial<IOverloadConfig>;
  priority?: number;
  bypass?: boolean;
  shield?: {
    enabled?: boolean;
    protection?: string[];
    priority?: number;
  };
}

/**
 * Priority management options for enhanced request handling
 */
export interface IPriorityManagerOptions {
  enabled: boolean;
  strategy: "fifo" | "priority" | "weighted" | "adaptive";
  queueTimeout: number;
  maxQueueSize: number;
  adaptiveAdjustment: boolean;
  preemption: boolean;
  fairnessThreshold: number;
  metrics: {
    enabled: boolean;
    includeTimings: boolean;
    includeThroughput: boolean;
    includeQueueDepth: boolean;
  };
}

/**
 * Enhanced Shield configuration with comprehensive customization options
 */
export interface IEnhancedShieldOptions {
  priorityManager: IPriorityManagerOptions;
  adaptiveProtection: {
    enabled: boolean;
    monitoringInterval: number;
    adjustmentThreshold: number;
    emergencyMode: {
      enabled: boolean;
      triggerConditions: {
        errorRateThreshold: number;
        responseTimeThreshold: number;
        queueDepthThreshold: number;
      };
      actions: {
        reduceTimeouts: boolean;
        increaseLimits: boolean;
        enableFallbacks: boolean;
      };
    };
  };
  performanceMonitoring: {
    enabled: boolean;
    metricsRetention: number;
    rollingAverageWindow: number;
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      throughput: number;
    };
  };
  resilience: {
    gracefulDegradation: boolean;
    fallbackStrategies: string[];
    recoveryMode: "automatic" | "manual";
    healthCheckInterval: number;
  };
}

/**
 * Enterprise-grade Shield Guard
 *
 * Provides comprehensive protection for NestJS applications including:
 * - Rate limiting with configurable windows and strategies
 * - Request throttling with token bucket algorithm
 * - Overload protection with queue management
 * - Circuit breaker integration
 * - Priority-based request handling
 * - Distributed synchronization support
 * - Comprehensive logging and metrics
 * - Security headers and request validation
 * - Graceful degradation under load
 */
@Injectable()
export class ShieldGuard implements CanActivate, BeforeApplicationShutdown {
  private readonly startTime: number = Date.now();
  private enhancedOptions?: IEnhancedShieldOptions;
  private reflector!: Reflector;
  private performanceMetrics: {
    requestCount: number;
    errorCount: number;
    totalResponseTime: number;
    avgResponseTime: number;
    lastResponseTime: number;
    throughput: number;
  } = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    avgResponseTime: 0,
    lastResponseTime: 0,
    throughput: 0,
  };
  private healthMonitoringTimer?: NodeJS.Timeout;
  private adaptiveMonitoringTimer?: NodeJS.Timeout;

  constructor(
    @Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly config: IShieldConfig,
    @Inject(DI_TOKENS.SHIELD_LOGGER_SERVICE) private readonly logger: ShieldLoggerService,
    @Inject(DI_TOKENS.RATE_LIMIT_SERVICE) private readonly rateLimitService: RateLimitService,
    @Inject(DI_TOKENS.THROTTLE_SERVICE) private readonly throttleService: ThrottleService,
    @Inject(DI_TOKENS.OVERLOAD_SERVICE) private readonly overloadService: OverloadService,
    @Inject(DI_TOKENS.CIRCUIT_BREAKER_SERVICE)
    private readonly circuitBreakerService: CircuitBreakerService,
    @Inject(DI_TOKENS.METRICS_SERVICE) private readonly metricsService: MetricsService,
    @Inject(DI_TOKENS.DISTRIBUTED_SYNC_SERVICE)
    private readonly distributedSyncService: DistributedSyncService,
    @Inject(DI_TOKENS.PRIORITY_MANAGER_SERVICE)
    private readonly priorityManagerService: PriorityManagerService,
  ) {
    // Create reflector instance manually to avoid DI issues
    this.reflector = new Reflector();
    this.initializeEnhancedOptions();

    this.logger.guard("Shield Guard initialized", {
      operation: "initialization",
      metadata: {
        globalEnabled: this.config.global?.enabled,
        protectionTypes: this.getEnabledProtectionTypes(),
        enhancedOptionsEnabled: !!this.enhancedOptions,
      },
    });

    if (this.enhancedOptions?.adaptiveProtection.enabled) {
      this.startAdaptiveMonitoring();
    }

    // Initialize health monitoring and management system
    this.startHealthMonitoring();
  }

  beforeApplicationShutdown() {
    if (this.healthMonitoringTimer) {
      clearInterval(this.healthMonitoringTimer);
      this.healthMonitoringTimer = undefined;
    }

    if (this.adaptiveMonitoringTimer) {
      clearTimeout(this.adaptiveMonitoringTimer);
      this.adaptiveMonitoringTimer = undefined;
    }

    this.logger.guardDebug("Shield Guard shutdown complete", {
      operation: "shutdown",
    });
  }

  /**
   * Main guard entry point - orchestrates all protection mechanisms
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Start performance measurement
    const startTime = performance.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Create protection context with request metadata
    const protectionContext = this.createProtectionContext(request, context);

    try {
      // Log guard activation
      this.logger.guardDebug("Shield Guard activated", {
        operation: "guard_activation",
        requestId: protectionContext.requestId,
        metadata: {
          method: request.method,
          path: request.path,
          ip: protectionContext.ip,
          userAgent: request.get("user-agent"),
        },
      });

      // Check if shield is globally disabled
      if (!this.config.global?.enabled) {
        this.logger.guardDebug("Shield globally disabled, allowing request", {
          requestId: protectionContext.requestId,
        });
        return true;
      }

      // Extract protection metadata from decorators
      const metadata = this.extractProtectionMetadata(context);

      // Check if request should bypass all protection
      if (metadata.bypass || this.shouldBypassProtection(request, metadata)) {
        this.logger.guard("Request bypassing Shield protection", {
          operation: "bypass",
          requestId: protectionContext.requestId,
          metadata: { reason: metadata.bypass ? "decorator" : "conditional" },
        });

        this.metricsService.increment("shield_requests_bypassed", 1, {
          path: request.path,
          method: request.method,
        });

        return true;
      }

      // Extract and validate request priority using enhanced logic
      const priority = this.determinePriority(metadata, protectionContext);
      protectionContext.priority = priority;

      // Check if we can accept this request based on priority constraints
      if (!this.priorityManagerService.canAcceptRequest(priority)) {
        this.logger.guardWarn("Request rejected due to priority constraints", {
          operation: "priority_rejection",
          requestId: protectionContext.requestId,
          metadata: {
            priority,
            priorityLevel: this.priorityManagerService.getPriorityLevel(priority),
            stats: this.priorityManagerService.getAggregateStats(),
          },
        });

        this.metricsService.increment("shield_priority_rejections", 1, {
          priority: priority.toString(),
          path: protectionContext.path,
          reason: "priority_limit_exceeded",
        });

        const priorityResult: IProtectionResult = {
          allowed: false,
          reason: "Server busy - priority queue full",
          retryAfter: Math.ceil(this.priorityManagerService.getTimeout(priority) / 1000),
          metadata: {
            priority,
            priorityLevel: this.priorityManagerService.getPriorityLevel(priority),
            queueStats: this.priorityManagerService.getAggregateStats(),
          },
        };

        await this.handleProtectionRejection(priorityResult, protectionContext, response);
        return false;
      }

      // Acquire a slot in the priority queue
      const slotAcquired = this.priorityManagerService.acquireSlot(priority);
      if (!slotAcquired) {
        // Try to enqueue the request if slot acquisition failed
        const queued = this.priorityManagerService.enqueue(priority);
        if (!queued) {
          this.logger.guardWarn("Request rejected - cannot queue", {
            operation: "priority_queue_full",
            requestId: protectionContext.requestId,
            metadata: { priority },
          });

          const queueFullResult: IProtectionResult = {
            allowed: false,
            reason: "Server overloaded - queue full",
            retryAfter: 60,
            metadata: { priority },
          };

          await this.handleProtectionRejection(queueFullResult, protectionContext, response);
          return false;
        }

        // Wait for slot to become available (simplified approach)
        const timeout = this.priorityManagerService.getTimeout(priority);
        const waitTime = Math.min(timeout, 5000); // Cap at 5 seconds

        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Try to acquire slot again after waiting
        const retryAcquired = this.priorityManagerService.acquireSlot(priority);
        this.priorityManagerService.dequeue(priority);

        if (!retryAcquired) {
          this.logger.guardWarn("Request timeout in priority queue", {
            operation: "priority_timeout",
            requestId: protectionContext.requestId,
            metadata: { priority, waitTime },
          });

          const timeoutResult: IProtectionResult = {
            allowed: false,
            reason: "Request timeout in priority queue",
            retryAfter: Math.ceil(timeout / 1000),
            metadata: { priority, waitTime },
          };

          await this.handleProtectionRejection(timeoutResult, protectionContext, response);
          return false;
        }
      }

      // Apply all protection mechanisms in order
      const protectionResult = await this.applyProtectionMechanisms(
        protectionContext,
        metadata,
        request,
      );

      // Handle protection result
      if (!protectionResult.allowed) {
        await this.handleProtectionRejection(protectionResult, protectionContext, response);
        return false;
      }

      // Add security headers
      this.addSecurityHeaders(response, protectionContext);

      // Record successful protection and release priority slot
      const duration = performance.now() - startTime;
      this.recordSuccessMetrics(protectionContext, duration);

      // Update performance metrics for adaptive monitoring
      if (this.enhancedOptions?.performanceMonitoring.enabled) {
        this.performanceMetrics.requestCount++;
        this.performanceMetrics.totalResponseTime += duration;
        this.performanceMetrics.lastResponseTime = duration;
      }

      // Schedule slot release (will be called after response is sent)
      response.on("finish", () => {
        this.priorityManagerService.releaseSlot(priority);

        // Record priority-specific metrics
        this.metricsService.histogram("shield_priority_processing_time", duration, {
          priority: priority.toString(),
          path: protectionContext.path,
        });

        this.metricsService.increment("shield_priority_requests_completed", 1, {
          priority: priority.toString(),
          path: protectionContext.path,
        });
      });

      // Also handle connection termination
      response.on("close", () => {
        this.priorityManagerService.releaseSlot(priority);
      });

      this.logger.guardDebug("Request passed all protection mechanisms", {
        operation: "protection_success",
        requestId: protectionContext.requestId,
        metadata: {
          duration: `${duration.toFixed(2)}ms`,
          priority,
        },
      });

      return true;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Release priority slot on error
      if (protectionContext.priority !== undefined) {
        this.priorityManagerService.releaseSlot(protectionContext.priority);

        this.metricsService.increment("shield_priority_requests_failed", 1, {
          priority: protectionContext.priority.toString(),
          path: protectionContext.path,
          errorType: error.constructor.name,
        });
      }

      // Update error metrics for adaptive monitoring
      if (this.enhancedOptions?.performanceMonitoring.enabled) {
        this.performanceMetrics.errorCount++;
        this.performanceMetrics.requestCount++;
      }

      await this.handleGuardError(error, protectionContext, response, duration);
      return false;
    }
  }

  /**
   * Create protection context with request metadata
   */
  private createProtectionContext(
    request: Request,
    context: ExecutionContext,
  ): IProtectionContext & { requestId: string; clientIp: string; priority?: number } {
    const requestId = this.generateRequestId();
    const clientIp = this.extractClientIp(request);
    const userAgent = request.get("user-agent") || "unknown";
    const userId = this.extractUserId(request);
    const sessionId = this.extractSessionId(request);

    const protectionContext = {
      request,
      response: context.switchToHttp().getResponse(),
      handler: context.getHandler(),
      class: context.getClass(),
      ip: clientIp,
      userAgent,
      path: request.path,
      method: request.method,
      headers: { ...request.headers },
      metadata: {},
      timestamp: Date.now(),
      userId,
      sessionId,
      // Additional fields for internal use
      requestId,
      clientIp,
    };

    // Attach context to request for use by interceptors
    (request as any).shieldContext = protectionContext;

    return protectionContext as IProtectionContext & {
      requestId: string;
      clientIp: string;
      priority?: number;
    };
  }

  /**
   * Extract protection metadata from method and class decorators
   */
  private extractProtectionMetadata(context: ExecutionContext): IProtectionMetadata {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Extract metadata from decorators
    return {
      // Shield decorator
      shield:
        this.reflector.get(SHIELD_DECORATORS.SHIELD, handler) ||
        this.reflector.get(SHIELD_DECORATORS.SHIELD, classRef),

      // Individual protection decorators
      circuitBreaker:
        this.reflector.get(SHIELD_DECORATORS.CIRCUIT_BREAKER, handler) ||
        this.reflector.get(SHIELD_DECORATORS.CIRCUIT_BREAKER, classRef),

      rateLimit:
        this.reflector.get(SHIELD_DECORATORS.RATE_LIMIT, handler) ||
        this.reflector.get(SHIELD_DECORATORS.RATE_LIMIT, classRef),

      throttle:
        this.reflector.get(SHIELD_DECORATORS.THROTTLE, handler) ||
        this.reflector.get(SHIELD_DECORATORS.THROTTLE, classRef),

      overload:
        this.reflector.get(SHIELD_DECORATORS.OVERLOAD, handler) ||
        this.reflector.get(SHIELD_DECORATORS.OVERLOAD, classRef),

      priority:
        this.reflector.get(SHIELD_DECORATORS.PRIORITY, handler) ||
        this.reflector.get(SHIELD_DECORATORS.PRIORITY, classRef),

      bypass:
        this.reflector.get(SHIELD_DECORATORS.BYPASS, handler) ||
        this.reflector.get(SHIELD_DECORATORS.BYPASS, classRef),
    };
  }

  /**
   * Apply all protection mechanisms in the correct order
   */
  private async applyProtectionMechanisms(
    context: IProtectionContext,
    metadata: IProtectionMetadata,
    request: Request,
  ): Promise<IProtectionResult> {
    // 1. Priority-based overload protection (first line of defense)
    if (this.isOverloadProtectionEnabled(metadata)) {
      const overloadResult = await this.checkOverloadProtection(context, metadata);
      if (!overloadResult.allowed) {
        return overloadResult;
      }
    }

    // 2. Rate limiting (per-client limits)
    if (this.isRateLimitEnabled(metadata)) {
      const rateLimitResult = await this.checkRateLimit(context, metadata);
      if (!rateLimitResult.allowed) {
        return rateLimitResult;
      }
    }

    // 3. Throttling (token bucket)
    if (this.isThrottleEnabled(metadata)) {
      const throttleResult = await this.checkThrottle(context, metadata);
      if (!throttleResult.allowed) {
        return throttleResult;
      }
    }

    // 4. Circuit breaker check (service health)
    if (this.isCircuitBreakerEnabled(metadata)) {
      const circuitResult = await this.checkCircuitBreaker(context, metadata);
      if (!circuitResult.allowed) {
        return circuitResult;
      }
    }

    // 5. Additional security validations
    const securityResult = await this.performSecurityValidations(context, request);
    if (!securityResult.allowed) {
      return securityResult;
    }

    // 6. Transfer protection info to request for parameter decorators
    this.transferProtectionInfoToRequest(context, request);

    return { allowed: true };
  }

  /**
   * Check overload protection
   */
  private async checkOverloadProtection(
    context: IProtectionContext,
    metadata: IProtectionMetadata,
  ): Promise<IProtectionResult> {
    try {
      const config = { ...this.config.overload, ...metadata.overload };
      const overloadKey = this.generateOverloadKey(context);

      // Store key in context for tracing
      if (!context.metadata) context.metadata = {};
      context.metadata.overloadKey = overloadKey;

      const result = await this.overloadService.acquire(context, config);

      if (!result.allowed) {
        this.logger.guardWarn("Request rejected by overload protection", {
          operation: "overload_protection",
          requestId: (context as any).requestId,
          metadata: {
            reason: result.reason,
            ...result.metadata,
          },
        });

        this.metricsService.increment("shield_overload_rejections", 1, {
          reason: result.reason || "unknown",
          path: context.path,
        });

        return result;
      }

      // Store overload info for interceptors
      if (!context.metadata) context.metadata = {};
      context.metadata.overloadInfo = result;

      return { allowed: true };
    } catch (error) {
      return this.handleProtectionException(error, context, "overload", (context as any).requestId);
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(
    context: IProtectionContext,
    metadata: IProtectionMetadata,
  ): Promise<IProtectionResult> {
    try {
      const config = { ...this.config.rateLimit, ...metadata.rateLimit };
      const rateLimitKey = this.generateRateLimitKey(context, config);

      // Store key in context for tracing and metrics
      if (!context.metadata) context.metadata = {};
      context.metadata.rateLimitKey = rateLimitKey;

      const result = await this.rateLimitService.consume(context, config);

      if (!result.allowed) {
        this.logger.guardWarn("Request rejected by rate limiter", {
          operation: "rate_limit",
          requestId: (context as any).requestId,
          metadata: {
            reason: result.reason,
            ...result.metadata,
          },
        });

        this.metricsService.increment("shield_rate_limit_rejections", 1, {
          path: context.path,
        });

        return result;
      }

      // Store rate limit info for headers
      if (!context.metadata) context.metadata = {};
      context.metadata.rateLimitInfo = result;

      return { allowed: true };
    } catch (error) {
      return this.handleProtectionException(
        error,
        context,
        "rateLimit",
        (context as any).requestId,
      );
    }
  }

  /**
   * Check throttling
   */
  private async checkThrottle(
    context: IProtectionContext,
    metadata: IProtectionMetadata,
  ): Promise<IProtectionResult> {
    try {
      const config = { ...this.config.throttle, ...metadata.throttle };
      const throttleKey = this.generateThrottleKey(context, config);

      // Store key in context for tracing and session management
      if (!context.metadata) context.metadata = {};
      context.metadata.throttleKey = throttleKey;

      const result = await this.throttleService.consume(context, config);

      if (!result.allowed) {
        this.logger.guardWarn("Request rejected by throttler", {
          operation: "throttle",
          requestId: (context as any).requestId,
          metadata: {
            reason: result.reason,
            ...result.metadata,
          },
        });

        this.metricsService.increment("shield_throttle_rejections", 1, {
          path: context.path,
        });

        return result;
      }

      // Store throttle info
      if (!context.metadata) context.metadata = {};
      context.metadata.throttleInfo = result;

      return { allowed: true };
    } catch (error) {
      return this.handleProtectionException(error, context, "throttle", (context as any).requestId);
    }
  }

  /**
   * Check circuit breaker
   */
  private async checkCircuitBreaker(
    context: IProtectionContext,
    metadata: IProtectionMetadata,
  ): Promise<IProtectionResult> {
    try {
      const config = { ...this.config.circuitBreaker, ...metadata.circuitBreaker };
      const key = this.generateCircuitBreakerKey(context);

      const isHealthy = await this.circuitBreakerService.healthCheck(key);

      if (!isHealthy) {
        const state = this.circuitBreakerService.getState(key);
        const stats = this.circuitBreakerService.getStats(key);

        this.logger.guardWarn("Request rejected by circuit breaker", {
          operation: "circuit_breaker",
          requestId: (context as any).requestId,
          metadata: {
            key,
            state,
            stats: stats
              ? {
                  fires: stats.fires,
                  successes: stats.successes,
                  failures: stats.failures,
                }
              : undefined,
          },
        });

        this.metricsService.increment("shield_circuit_breaker_rejections", 1, {
          key: this.sanitizeKeyForMetrics(key),
          state: state || "unknown",
        });

        return {
          allowed: false,
          reason: "Service temporarily unavailable",
          retryAfter: Math.ceil((config.resetTimeout || 60000) / 1000),
          metadata: {
            state,
            stats,
          },
        };
      }

      // Store circuit breaker info
      if (!context.metadata) context.metadata = {};
      context.metadata.circuitBreakerInfo = {
        state: this.circuitBreakerService.getState(key),
        stats: this.circuitBreakerService.getStats(key),
      };

      return { allowed: true };
    } catch (error) {
      return this.handleProtectionException(
        error,
        context,
        "circuitBreaker",
        (context as any).requestId,
      );
    }
  }

  /**
   * Perform additional security validations
   */
  private async performSecurityValidations(
    context: IProtectionContext,
    request: Request,
  ): Promise<IProtectionResult> {
    try {
      // Check for suspicious patterns
      if (this.detectSuspiciousPatterns(request)) {
        this.logger.security("Suspicious request pattern detected", {
          operation: "security_validation",
          requestId: (context as any).requestId,
          ip: context.ip,
          metadata: {
            path: request.path,
            userAgent: context.userAgent,
          },
        });

        this.metricsService.increment("shield_security_rejections", 1, {
          reason: "suspicious_pattern",
          path: context.path,
        });

        return {
          allowed: false,
          reason: "Request blocked for security reasons",
        };
      }

      // Check request size limits
      const contentLength = parseInt(request.get("content-length") || "0", 10);
      const maxRequestSize = 10 * 1024 * 1024; // 10MB default

      if (contentLength > maxRequestSize) {
        this.logger.security("Request size exceeds limit", {
          operation: "security_validation",
          requestId: (context as any).requestId,
          metadata: {
            contentLength,
            maxRequestSize,
          },
        });

        return {
          allowed: false,
          reason: "Request size too large",
        };
      }

      return { allowed: true };
    } catch (error) {
      return this.handleProtectionException(error, context, "security", (context as any).requestId);
    }
  }

  /**
   * Handle protection rejection
   */
  private async handleProtectionRejection(
    result: IProtectionResult,
    context: IProtectionContext,
    response: Response,
  ): Promise<void> {
    // Set appropriate HTTP status
    const status = this.getHttpStatusForRejection(result.reason);

    // Add retry-after header if provided
    if (result.retryAfter) {
      response.setHeader("Retry-After", result.retryAfter.toString());
    }

    // Add rate limit headers if available
    if (context.metadata?.rateLimitInfo) {
      const info = context.metadata.rateLimitInfo;
      response.setHeader("X-RateLimit-Limit", info.limit?.toString() || "0");
      response.setHeader("X-RateLimit-Remaining", info.remaining?.toString() || "0");
      if (info.resetTime) {
        response.setHeader("X-RateLimit-Reset", Math.ceil(info.resetTime / 1000).toString());
      }
    }

    this.logger.guard("Request rejected by Shield protection", {
      operation: "protection_rejection",
      requestId: (context as any).requestId,
      metadata: {
        reason: result.reason,
        status,
        retryAfter: result.retryAfter,
        ...result.metadata,
      },
    });

    this.metricsService.increment("shield_requests_rejected", 1, {
      reason: result.reason || "unknown",
      status: status.toString(),
      path: context.path,
    });

    // Throw appropriate HTTP exception
    throw new HttpException(
      {
        statusCode: status,
        message: result.reason || "Request blocked by protection system",
        timestamp: new Date().toISOString(),
        path: context.path,
        requestId: (context as any).requestId,
        retryAfter: result.retryAfter,
      },
      status,
    );
  }

  /**
   * Handle guard errors
   */
  private async handleGuardError(
    error: any,
    context: IProtectionContext,
    _response: Response,
    duration: number,
  ): Promise<void> {
    this.logger.guardError("Shield Guard encountered an error", error, {
      operation: "guard_error",
      requestId: (context as any).requestId,
      metadata: {
        duration: `${duration.toFixed(2)}ms`,
        errorType: error.constructor.name,
      },
    });

    this.metricsService.increment("shield_guard_errors", 1, {
      errorType: error.constructor.name,
      path: context.path,
    });

    // Re-throw circuit breaker exceptions
    if (
      error instanceof CircuitBreakerException ||
      error instanceof ThrottleException ||
      error instanceof RateLimitException ||
      error instanceof OverloadException ||
      error instanceof ShieldException
    ) {
      throw error;
    }

    // For other errors, fail open to maintain service availability
    if (!(error instanceof HttpException)) {
      this.logger.guardWarn("Shield Guard failing open due to internal error", {
        requestId: (context as any).requestId,
      });
      return;
    }

    throw error;
  }

  /**
   * Add security headers to response with limited information disclosure
   */
  private addSecurityHeaders(
    response: Response,
    context: IProtectionContext & { requestId: string },
  ): void {
    // Add request ID for tracing
    response.setHeader("X-Request-ID", context.requestId);

    // Only add detailed info in development mode
    if (this.config.global?.logging?.enabled && this.isDevelopmentMode()) {
      const healthInfo = this.getHealthInfo();
      const protectionInfo = {
        protected: true,
        timestamp: context.timestamp,
        // Remove sensitive system information
        status: healthInfo.status === "healthy" ? "ok" : "degraded",
      };
      response.setHeader("X-Shield-Info", JSON.stringify(protectionInfo));
    } else {
      // In production, only indicate protection is active
      response.setHeader("X-Shield-Protected", "true");
    }

    // Add standard security headers
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("X-XSS-Protection", "1; mode=block");
  }

  /**
   * Check if running in development mode
   */
  private isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  }

  /**
   * Record success metrics
   */
  private recordSuccessMetrics(
    context: IProtectionContext & { priority?: number },
    duration: number,
  ): void {
    this.metricsService.increment("shield_requests_allowed", 1, {
      path: context.path,
      method: context.method,
    });

    this.metricsService.histogram("shield_guard_duration", duration, {
      path: context.path,
      method: context.method,
    });

    if (context.priority !== undefined) {
      this.metricsService.histogram("shield_request_priority", context.priority, {
        path: context.path,
      });
    }
  }

  // ==================== EXCEPTION HANDLING ====================

  /**
   * 🛡️ Elite Exception Dispatcher - The Guardian's Last Stand
   *
   * This sophisticated exception routing system categorizes and handles all Shield protection
   * exceptions with military precision. Each exception type gets specialized treatment based
   * on its threat level and operational context.
   */
  private handleProtectionException(
    error: unknown,
    context: IProtectionContext,
    operation: "overload" | "rateLimit" | "throttle" | "circuitBreaker" | "security",
    requestId: string,
  ): never | IProtectionResult {
    const errorName = (error as Error).constructor.name;

    // 🚨 CRITICAL THREAT LEVEL - Immediate Action Required
    const criticalExceptions = [
      "ThrottleException",
      "RateLimitException",
      "OverloadException",
      "CircuitBreakerException",
    ];

    // 🔴 HIGH PRIORITY - Shield Protection Exceptions (Re-throw for HTTP response)
    if (criticalExceptions.includes(errorName)) {
      this.logger.guardWarn(`🛡️ Shield Protection Activated: ${errorName}`, {
        operation: `${operation}_exception_thrown`,
        requestId,
        metadata: {
          exceptionType: errorName,
          threatLevel: "CRITICAL",
          actionTaken: "HTTP_RESPONSE_GENERATED",
          path: context.path,
          method: context.method,
          ip: context.ip,
        },
      });

      // Record specific metrics for each exception type
      this.recordExceptionMetrics(errorName, context, operation);

      // 🚀 Launch exception to HTTP layer for proper client response
      throw error;
    }

    // 🟠 MEDIUM PRIORITY - Generic Shield Exceptions
    if (errorName === "ShieldException") {
      this.logger.guardWarn(`🛡️ Generic Shield Protection Triggered`, {
        operation: `${operation}_shield_exception`,
        requestId,
        metadata: {
          exceptionType: errorName,
          threatLevel: "MEDIUM",
          actionTaken: "HTTP_RESPONSE_GENERATED",
        },
      });

      this.metricsService.increment(`shield_${operation}_shield_exceptions`, 1, {
        path: context.path,
        method: context.method,
      });

      throw error;
    }

    // 🟡 LOW PRIORITY - Infrastructure/Internal Errors (Fail Open)
    const infrastructureExceptions = [
      "StorageException",
      "ConfigurationException",
      "TypeError",
      "ReferenceError",
      "NetworkError",
      "TimeoutError",
    ];

    if (infrastructureExceptions.includes(errorName)) {
      this.logger.guardError(`⚙️ Infrastructure Issue Detected in ${operation}`, error as Error, {
        operation: `${operation}_infrastructure_error`,
        requestId,
        metadata: {
          exceptionType: errorName,
          threatLevel: "LOW",
          actionTaken: "FAIL_OPEN_GRACEFUL_DEGRADATION",
          resilience: "MAINTAINING_SERVICE_AVAILABILITY",
        },
      });

      this.metricsService.increment(`shield_${operation}_infrastructure_errors`, 1, {
        errorType: errorName,
        path: context.path,
      });

      // 🟢 Graceful degradation - Allow request to proceed
      return { allowed: true };
    }

    // 🔵 DEFAULT HANDLING - Unknown/Unexpected Errors
    this.logger.guardError(`🔍 Unknown Exception in ${operation} Protection`, error as Error, {
      operation: `${operation}_unknown_error`,
      requestId,
      metadata: {
        exceptionType: errorName,
        threatLevel: "UNKNOWN",
        actionTaken: "FAIL_OPEN_WITH_MONITORING",
        requiresInvestigation: true,
      },
    });

    this.metricsService.increment(`shield_${operation}_unknown_errors`, 1, {
      errorType: errorName,
      path: context.path,
    });

    // 🟢 Conservative approach - Fail open for unknown errors
    return { allowed: true };
  }

  /**
   * 📊 Exception Metrics Recorder - Intelligence Gathering
   *
   * Records detailed metrics for each exception type to enable
   * advanced analytics and threat pattern recognition.
   */
  private recordExceptionMetrics(
    exceptionType: string,
    context: IProtectionContext,
    operation: string,
  ): void {
    const baseLabels = {
      path: context.path,
      method: context.method,
      ip: this.sanitizeKeyForMetrics(context.ip),
    };

    // Exception-specific metrics
    switch (exceptionType) {
      case "ThrottleException":
        this.metricsService.increment("shield_throttle_exceptions_thrown", 1, {
          ...baseLabels,
          severity: "high",
          category: "rate_control",
        });
        break;

      case "RateLimitException":
        this.metricsService.increment("shield_rate_limit_exceptions_thrown", 1, {
          ...baseLabels,
          severity: "high",
          category: "rate_control",
        });
        break;

      case "OverloadException":
        this.metricsService.increment("shield_overload_exceptions_thrown", 1, {
          ...baseLabels,
          severity: "critical",
          category: "capacity_management",
        });
        break;

      case "CircuitBreakerException":
        this.metricsService.increment("shield_circuit_breaker_exceptions_thrown", 1, {
          ...baseLabels,
          severity: "critical",
          category: "service_health",
        });
        break;
    }

    // General exception counter
    this.metricsService.increment("shield_protection_exceptions_total", 1, {
      ...baseLabels,
      operation,
      exceptionType,
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Determine if protection should be bypassed with secure path validation
   */
  private shouldBypassProtection(request: Request, metadata: IProtectionMetadata): boolean {
    // Use exact path matching instead of includes to prevent bypass attacks
    const trustedBypassPaths = ["/health", "/metrics", "/status"];
    const exactPathMatch = trustedBypassPaths.includes(request.path);

    if (exactPathMatch) {
      // Additional security: verify request comes from trusted sources
      return this.verifyTrustedSource(request);
    }

    // Check for emergency shutdown mode with additional validation
    if (process.env.SHIELD_SHUTDOWN_MODE === "true") {
      // Log security event for audit trail
      this.logger.security("Shield bypass activated due to shutdown mode", {
        operation: "bypass_protection",
        metadata: {
          reason: "shutdown_mode",
          ip: this.extractClientIp(request),
          requestPath: request.path,
        },
      });
      return true;
    }

    // Check shield decorator settings (only if explicitly disabled)
    return metadata.shield?.enabled === false;
  }

  /**
   * Verify request comes from trusted sources for bypass paths
   */
  private verifyTrustedSource(request: Request): boolean {
    const clientIp = this.extractClientIp(request);

    // Allow localhost and private networks for health checks
    const trustedNetworks = [
      "127.0.0.1",
      "::1",
      /^10\./, // Private network 10.x.x.x
      /^192\.168\./, // Private network 192.168.x.x
      /^172\.(1[6-9]|2\d|3[01])\./, // Private network 172.16-31.x.x
    ];

    return trustedNetworks.some((network) => {
      if (typeof network === "string") {
        return clientIp === network;
      }
      return network.test(clientIp);
    });
  }

  /**
   * Determine request priority with enhanced logic
   */
  private determinePriority(metadata: IProtectionMetadata, context?: IProtectionContext): number {
    // Use PriorityManagerService for sophisticated priority extraction
    if (context) {
      return this.priorityManagerService.extractPriority(context);
    }

    // Fallback to decorator-based priority
    if (metadata.priority !== undefined) {
      return metadata.priority;
    }

    // Priority from shield decorator
    if (metadata.shield?.priority !== undefined) {
      return metadata.shield.priority;
    }

    // Default priority from config
    return this.config.advanced?.requestPriority?.defaultPriority || 5;
  }

  /**
   * Check if specific protection is enabled
   */
  private isOverloadProtectionEnabled(metadata: IProtectionMetadata): boolean {
    return (
      this.config.overload?.enabled !== false &&
      metadata.overload?.enabled !== false &&
      metadata.shield?.protection?.includes("overload") !== false
    );
  }

  private isRateLimitEnabled(metadata: IProtectionMetadata): boolean {
    return (
      this.config.rateLimit?.enabled !== false &&
      metadata.rateLimit?.enabled !== false &&
      metadata.shield?.protection?.includes("rateLimit") !== false
    );
  }

  private isThrottleEnabled(metadata: IProtectionMetadata): boolean {
    return (
      this.config.throttle?.enabled !== false &&
      metadata.throttle?.enabled !== false &&
      metadata.shield?.protection?.includes("throttle") !== false
    );
  }

  private isCircuitBreakerEnabled(metadata: IProtectionMetadata): boolean {
    return (
      this.config.circuitBreaker?.enabled !== false &&
      metadata.circuitBreaker?.enabled !== false &&
      metadata.shield?.protection?.includes("circuitBreaker") !== false
    );
  }

  /**
   * Generate various keys for different protection mechanisms
   */
  private generateOverloadKey(context: IProtectionContext): string {
    return `overload:${context.path}:${context.method}`;
  }

  private generateRateLimitKey(
    context: IProtectionContext,
    config: Partial<IRateLimitConfig>,
  ): string {
    const keyGenerator = config.keyGenerator;
    if (keyGenerator) {
      return keyGenerator(context);
    }
    return `ratelimit:${context.ip}:${context.path}`;
  }

  private generateThrottleKey(
    context: IProtectionContext,
    config: Partial<IThrottleConfig>,
  ): string {
    const keyGenerator = config.keyGenerator;
    if (keyGenerator) {
      return keyGenerator(context);
    }
    return `throttle:${context.ip}`;
  }

  private generateCircuitBreakerKey(context: IProtectionContext): string {
    return `circuit:${context.path}:${context.method}`;
  }

  /**
   * Extract client IP from request
   */
  private extractClientIp(request: Request): string {
    return (
      request.get("x-forwarded-for")?.split(",")[0] ||
      request.get("x-real-ip") ||
      request.get("cf-connecting-ip") ||
      request.socket.remoteAddress ||
      "unknown"
    );
  }

  /**
   * Extract session ID from request
   */
  private extractSessionId(request: Request): string | undefined {
    return request.get("x-session-id") || request.cookies?.sessionId || undefined;
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(request: Request): string | undefined {
    return request.get("x-user-id") || (request as any).user?.id || undefined;
  }

  /**
   * Generate cryptographically secure unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const secureRandomBytes = randomBytes(16).toString("hex");
    return `${timestamp}-${secureRandomBytes}`;
  }

  /**
   * Detect suspicious request patterns with secure input handling
   */
  private detectSuspiciousPatterns(request: Request): boolean {
    const suspiciousPatterns = [
      /\.\./, // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /exec\s*\(/i, // Code injection
      /__proto__/i, // Prototype pollution
      /constructor/i, // Constructor pollution
    ];

    // Safely sanitize inputs before pattern matching
    const sanitizedPath = this.sanitizeInput(request.path);
    const sanitizedUA = this.sanitizeInput(request.get("user-agent") || "");
    const sanitizedQuery = this.sanitizeQueryParams(request.query);

    const checkString = `${sanitizedPath} ${sanitizedUA} ${sanitizedQuery}`;

    return suspiciousPatterns.some((pattern) => pattern.test(checkString));
  }

  /**
   * Safely sanitize string inputs to prevent injection attacks
   */
  private sanitizeInput(input: string): string {
    if (!input) return "";

    // Remove potentially dangerous characters and limit length
    return input
      .replace(/[<>'"]/g, "") // Remove XSS chars
      .replace(/[{}]/g, "") // Remove object notation
      .substring(0, 1000); // Limit length to prevent DoS
  }

  /**
   * Safely sanitize query parameters to prevent injection
   */
  private sanitizeQueryParams(query: any): string {
    if (!query || typeof query !== "object") return "";

    try {
      const safeParams: string[] = [];
      for (const [key, value] of Object.entries(query)) {
        // Only allow alphanumeric keys and safe values
        if (/^[\w-]+$/.test(key) && typeof value === "string") {
          const sanitizedValue = this.sanitizeInput(value);
          if (sanitizedValue.length < 100) {
            // Limit param value length
            safeParams.push(`${key}=${sanitizedValue}`);
          }
        }
      }
      return safeParams.join("&");
    } catch {
      return "";
    }
  }

  /**
   * Get HTTP status for rejection reason
   */
  private getHttpStatusForRejection(reason?: string): number {
    if (!reason) return HttpStatus.TOO_MANY_REQUESTS;

    if (reason.includes("Rate limit")) return HttpStatus.TOO_MANY_REQUESTS;
    if (reason.includes("overload")) return HttpStatus.SERVICE_UNAVAILABLE;
    if (reason.includes("Too many")) return HttpStatus.TOO_MANY_REQUESTS;
    if (reason.includes("unavailable")) return HttpStatus.SERVICE_UNAVAILABLE;
    if (reason.includes("security")) return HttpStatus.FORBIDDEN;
    if (reason.includes("size")) return HttpStatus.PAYLOAD_TOO_LARGE;

    return HttpStatus.TOO_MANY_REQUESTS;
  }

  /**
   * Sanitize key for metrics (remove sensitive data)
   */
  private sanitizeKeyForMetrics(key: string): string {
    // Remove IP addresses and other sensitive data
    return key.replace(/\d+\.\d+\.\d+\.\d+/g, "x.x.x.x").replace(/[a-f0-9]{32,}/gi, "hash");
  }

  /**
   * Get enabled protection types for logging including priority management
   */
  private getEnabledProtectionTypes(): string[] {
    const types: string[] = [];
    if (this.config.rateLimit?.enabled) types.push("rateLimit");
    if (this.config.throttle?.enabled) types.push("throttle");
    if (this.config.overload?.enabled) types.push("overload");
    if (this.config.circuitBreaker?.enabled) types.push("circuitBreaker");
    if (this.config.advanced?.requestPriority?.enabled) types.push("priorityManager");
    return types;
  }

  /**
   * Get comprehensive guard statistics and health info including priority management
   */
  getHealthInfo(): {
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;
    requestsProcessed: number;
    protectionMechanisms: Record<string, boolean>;
    errors: number;
    priorityManager: {
      enabled: boolean;
      stats: any;
      currentLoad: number;
      queueUtilization: number;
    };
  } {
    const uptime = Date.now() - this.startTime;
    const stats = this.metricsService.getHealth();
    const priorityStats = this.priorityManagerService.getAggregateStats();

    // Calculate overall system load based on priority queues
    const totalCapacity = priorityStats.priorityBreakdown.reduce(
      (sum, p) => sum + (p.current + p.queued),
      0,
    );
    const currentLoad = priorityStats.totalCurrentRequests + priorityStats.totalQueuedRequests;
    const loadPercentage = totalCapacity > 0 ? (currentLoad / totalCapacity) * 100 : 0;

    // Determine health status based on load and queue utilization
    let healthStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (loadPercentage > 80) {
      healthStatus = "unhealthy";
    } else if (loadPercentage > 60) {
      healthStatus = "degraded";
    }

    return {
      status: stats.status === "healthy" ? healthStatus : "degraded",
      uptime,
      requestsProcessed: priorityStats.totalProcessedRequests,
      protectionMechanisms: {
        rateLimit: this.config.rateLimit?.enabled || false,
        throttle: this.config.throttle?.enabled || false,
        overload: this.config.overload?.enabled || false,
        circuitBreaker: this.config.circuitBreaker?.enabled || false,
        priorityManager: this.config.advanced?.requestPriority?.enabled || false,
      },
      errors: priorityStats.totalRejectedRequests,
      priorityManager: {
        enabled: this.config.advanced?.requestPriority?.enabled || false,
        stats: priorityStats,
        currentLoad: loadPercentage,
        queueUtilization:
          priorityStats.totalQueuedRequests > 0
            ? (priorityStats.totalQueuedRequests /
                priorityStats.priorityBreakdown.reduce(
                  (sum, p) =>
                    sum +
                    (this.priorityManagerService.getPriorityLevel(p.priority).maxQueueSize || 1000),
                  0,
                )) *
              100
            : 0,
      },
    };
  }

  /**
   * Get detailed priority management statistics
   */
  getPriorityStats(): {
    enabled: boolean;
    aggregate: any;
    individual: Map<number, any>;
    recommendations: string[];
  } {
    const aggregateStats = this.priorityManagerService.getAggregateStats();
    const individualStats = this.priorityManagerService.getStats();

    // Generate recommendations based on current state
    const recommendations: string[] = [];

    aggregateStats.priorityBreakdown.forEach((priority) => {
      if (priority.utilization > 90) {
        recommendations.push(
          `Priority ${priority.priority} (${priority.name}) is over 90% utilized. Consider increasing maxConcurrent.`,
        );
      }

      if (priority.rejected > priority.processed * 0.1) {
        recommendations.push(
          `Priority ${priority.priority} (${priority.name}) has high rejection rate. Consider increasing queue size.`,
        );
      }

      if (priority.queued > priority.current * 2) {
        recommendations.push(
          `Priority ${priority.priority} (${priority.name}) has significant queue backlog. Monitor for potential bottlenecks.`,
        );
      }
    });

    return {
      enabled: this.config.advanced?.requestPriority?.enabled || false,
      aggregate: aggregateStats,
      individual: individualStats,
      recommendations,
    };
  }

  /**
   * Dynamically adjust priority limits based on current load
   */
  adjustPriorityLimits(
    adjustments: {
      priority: number;
      maxConcurrent?: number;
      maxQueueSize?: number;
      timeout?: number;
    }[],
  ): void {
    adjustments.forEach((adjustment) => {
      this.priorityManagerService.adjustPriorityLimits(adjustment.priority, {
        maxConcurrent: adjustment.maxConcurrent,
        maxQueueSize: adjustment.maxQueueSize,
        timeout: adjustment.timeout,
      });

      this.logger.guard("Priority limits adjusted", {
        operation: "priority_adjustment",
        metadata: adjustment,
      });
    });
  }

  /**
   * Reset priority statistics
   */
  resetPriorityStats(): void {
    this.priorityManagerService.resetStats();

    this.logger.guard("Priority statistics reset", {
      operation: "priority_stats_reset",
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Initialize enhanced options from configuration
   */
  private initializeEnhancedOptions(): void {
    const enhancedConfig = (this.config as any).enhanced;
    if (enhancedConfig) {
      this.enhancedOptions = {
        priorityManager: {
          enabled: true,
          strategy: "adaptive",
          queueTimeout: 30000,
          maxQueueSize: 1000,
          adaptiveAdjustment: true,
          preemption: false,
          fairnessThreshold: 0.8,
          metrics: {
            enabled: true,
            includeTimings: true,
            includeThroughput: true,
            includeQueueDepth: true,
          },
          ...enhancedConfig.priorityManager,
        },
        adaptiveProtection: {
          enabled: false,
          monitoringInterval: 10000,
          adjustmentThreshold: 0.8,
          emergencyMode: {
            enabled: true,
            triggerConditions: {
              errorRateThreshold: 0.15,
              responseTimeThreshold: 5000,
              queueDepthThreshold: 0.9,
            },
            actions: {
              reduceTimeouts: true,
              increaseLimits: false,
              enableFallbacks: true,
            },
          },
          ...enhancedConfig.adaptiveProtection,
        },
        performanceMonitoring: {
          enabled: true,
          metricsRetention: 300000,
          rollingAverageWindow: 60000,
          alertThresholds: {
            responseTime: 2000,
            errorRate: 0.05,
            throughput: 100,
          },
          ...enhancedConfig.performanceMonitoring,
        },
        resilience: {
          gracefulDegradation: true,
          fallbackStrategies: ["queue", "throttle", "reject"],
          recoveryMode: "automatic",
          healthCheckInterval: 30000,
          ...enhancedConfig.resilience,
        },
      };
    }
  }

  /**
   * Start comprehensive health monitoring system
   */
  private startHealthMonitoring(): void {
    // Set up health check interval
    const healthCheckInterval = this.enhancedOptions?.resilience.healthCheckInterval || 30000;

    this.healthMonitoringTimer = setInterval(() => {
      const healthInfo = this.getHealthInfo();
      const priorityStats = this.getPriorityStats();
      const configStatus = this.getConfigurationStatus();

      // Log health status periodically
      this.logger.guard("Shield Health Check", {
        operation: "health_monitoring",
        metadata: {
          healthStatus: healthInfo.status,
          uptime: healthInfo.uptime,
          requestsProcessed: healthInfo.requestsProcessed,
          errors: healthInfo.errors,
          priorityEnabled: priorityStats.enabled,
          recommendations: priorityStats.recommendations.length,
          adaptiveMonitoring: configStatus.adaptiveStatus.monitoringActive,
        },
      });

      // Auto-adjust if needed based on health
      if (healthInfo.status === "unhealthy" || priorityStats.recommendations.length > 0) {
        this.performAutoAdjustments(healthInfo, priorityStats);
      }

      // Reset stats periodically to prevent memory buildup
      if (healthInfo.uptime % 3600000 === 0) {
        // Every hour
        this.resetPriorityStats();
      }
    }, healthCheckInterval);
  }

  /**
   * Perform automatic adjustments based on health metrics
   */
  private performAutoAdjustments(healthInfo: any, priorityStats: any): void {
    const adjustments: {
      priority: number;
      maxConcurrent?: number;
      maxQueueSize?: number;
      timeout?: number;
    }[] = [];

    // Auto-adjust based on recommendations
    priorityStats.recommendations.forEach((recommendation: string) => {
      if (recommendation.includes("over 90% utilized")) {
        const priorityMatch = recommendation.match(/Priority (\d+)/);
        if (priorityMatch) {
          const priority = parseInt(priorityMatch[1]);
          adjustments.push({
            priority,
            maxConcurrent: Math.ceil(healthInfo.requestsProcessed * 0.1),
          });
        }
      }

      if (recommendation.includes("high rejection rate")) {
        const priorityMatch = recommendation.match(/Priority (\d+)/);
        if (priorityMatch) {
          const priority = parseInt(priorityMatch[1]);
          adjustments.push({ priority, maxQueueSize: 1500 });
        }
      }
    });

    if (adjustments.length > 0) {
      this.adjustPriorityLimits(adjustments);
    }
  }

  /**
   * Start adaptive monitoring and performance tracking
   */
  private startAdaptiveMonitoring(): void {
    if (!this.enhancedOptions?.adaptiveProtection.enabled) {
      return;
    }

    const interval = this.enhancedOptions.adaptiveProtection.monitoringInterval;

    this.adaptiveMonitoringTimer = setInterval(() => {
      this.performAdaptiveAdjustments();
    }, interval);

    this.logger.guard("Adaptive monitoring started", {
      operation: "adaptive_monitoring_start",
      metadata: {
        interval,
        enabled: true,
      },
    });
  }

  /**
   * Perform adaptive adjustments based on current performance metrics
   */
  private performAdaptiveAdjustments(): void {
    if (!this.enhancedOptions?.adaptiveProtection.enabled) {
      return;
    }

    const stats = this.priorityManagerService.getAggregateStats();
    const errorRate =
      this.performanceMetrics.requestCount > 0
        ? this.performanceMetrics.errorCount / this.performanceMetrics.requestCount
        : 0;

    const emergencyConditions =
      this.enhancedOptions.adaptiveProtection.emergencyMode.triggerConditions;

    // Check emergency conditions
    const inEmergencyMode =
      errorRate > emergencyConditions.errorRateThreshold ||
      this.performanceMetrics.avgResponseTime > emergencyConditions.responseTimeThreshold ||
      stats.totalQueuedRequests / (stats.totalCurrentRequests + stats.totalQueuedRequests) >
        emergencyConditions.queueDepthThreshold;

    if (inEmergencyMode) {
      this.activateEmergencyMode();
    } else {
      this.optimizePerformance();
    }

    this.updatePerformanceMetrics();
  }

  /**
   * Activate emergency mode with protective measures
   */
  private activateEmergencyMode(): void {
    if (!this.enhancedOptions?.adaptiveProtection.emergencyMode.enabled) {
      return;
    }

    const actions = this.enhancedOptions.adaptiveProtection.emergencyMode.actions;

    this.logger.guardWarn("Emergency mode activated", {
      operation: "emergency_mode_activation",
      metadata: {
        performanceMetrics: this.performanceMetrics,
        priorityStats: this.priorityManagerService.getAggregateStats(),
      },
    });

    if (actions.reduceTimeouts) {
      // Reduce priority timeouts by 50%
      const priorities = [1, 3, 5, 8, 10];
      priorities.forEach((priority) => {
        const currentLevel = this.priorityManagerService.getPriorityLevel(priority);
        this.priorityManagerService.adjustPriorityLimits(priority, {
          timeout: Math.max(5000, (currentLevel.timeout || 30000) * 0.5),
        });
      });
    }

    if (actions.increaseLimits) {
      // Temporarily increase queue sizes for high priority requests
      this.priorityManagerService.adjustPriorityLimits(10, { maxQueueSize: 2000 });
      this.priorityManagerService.adjustPriorityLimits(8, { maxQueueSize: 1500 });
    }

    this.metricsService.increment("shield_emergency_mode_activated", 1);
  }

  /**
   * Optimize performance based on current metrics
   */
  private optimizePerformance(): void {
    const stats = this.priorityManagerService.getAggregateStats();

    // Auto-adjust priority limits based on utilization
    stats.priorityBreakdown.forEach((priority) => {
      if (priority.utilization > 90) {
        // Increase concurrent requests for highly utilized priorities
        this.priorityManagerService.adjustPriorityLimits(priority.priority, {
          maxConcurrent: Math.ceil(priority.current * 1.2),
        });
      } else if (priority.utilization < 30 && priority.current > 20) {
        // Reduce concurrent requests for underutilized priorities
        this.priorityManagerService.adjustPriorityLimits(priority.priority, {
          maxConcurrent: Math.ceil(priority.current * 0.8),
        });
      }
    });
  }

  /**
   * Update rolling performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (!this.enhancedOptions?.performanceMonitoring.enabled) {
      return;
    }

    const windowMs = this.enhancedOptions.performanceMonitoring.rollingAverageWindow;

    // Calculate throughput (requests per second)
    this.performanceMetrics.throughput = this.performanceMetrics.requestCount / (windowMs / 1000);

    // Update average response time
    if (this.performanceMetrics.requestCount > 0) {
      this.performanceMetrics.avgResponseTime =
        this.performanceMetrics.totalResponseTime / this.performanceMetrics.requestCount;
    }

    // Record metrics
    this.metricsService.gauge(
      "shield_performance_avg_response_time",
      this.performanceMetrics.avgResponseTime,
    );
    this.metricsService.gauge("shield_performance_throughput", this.performanceMetrics.throughput);
    this.metricsService.gauge(
      "shield_performance_error_rate",
      this.performanceMetrics.requestCount > 0
        ? this.performanceMetrics.errorCount / this.performanceMetrics.requestCount
        : 0,
    );

    // Reset counters for next window
    this.performanceMetrics.requestCount = 0;
    this.performanceMetrics.errorCount = 0;
    this.performanceMetrics.totalResponseTime = 0;
  }

  /**
   * Get comprehensive configuration status including enhanced options
   */
  getConfigurationStatus(): {
    basic: Record<string, any>;
    enhanced: IEnhancedShieldOptions | null;
    performance: typeof this.performanceMetrics;
    adaptiveStatus: {
      enabled: boolean;
      monitoringActive: boolean;
      emergencyMode: boolean;
    };
  } {
    const stats = this.priorityManagerService.getAggregateStats();
    const errorRate =
      this.performanceMetrics.requestCount > 0
        ? this.performanceMetrics.errorCount / this.performanceMetrics.requestCount
        : 0;

    const emergencyConditions =
      this.enhancedOptions?.adaptiveProtection.emergencyMode.triggerConditions;
    const inEmergencyMode = emergencyConditions
      ? errorRate > emergencyConditions.errorRateThreshold ||
        this.performanceMetrics.avgResponseTime > emergencyConditions.responseTimeThreshold ||
        stats.totalQueuedRequests / (stats.totalCurrentRequests + stats.totalQueuedRequests) >
          emergencyConditions.queueDepthThreshold
      : false;

    return {
      basic: {
        globalEnabled: this.config.global?.enabled,
        protectionTypes: this.getEnabledProtectionTypes(),
        rateLimit: this.config.rateLimit?.enabled,
        throttle: this.config.throttle?.enabled,
        overload: this.config.overload?.enabled,
        circuitBreaker: this.config.circuitBreaker?.enabled,
        priorityManager: this.config.advanced?.requestPriority?.enabled,
      },
      enhanced: this.enhancedOptions || null,
      performance: { ...this.performanceMetrics },
      adaptiveStatus: {
        enabled: this.enhancedOptions?.adaptiveProtection.enabled || false,
        monitoringActive: !!this.adaptiveMonitoringTimer,
        emergencyMode: inEmergencyMode,
      },
    };
  }

  /**
   * Transfer protection info from context to request for parameter decorators
   */
  private transferProtectionInfoToRequest(context: IProtectionContext, request: Request): void {
    // Transfer all protection info from context.metadata to request object
    // so that parameter decorators (@ThrottleInfo, @RateLimitInfo, etc.) can access them
    if (context.metadata) {
      if (context.metadata.throttleInfo) {
        (request as any).throttleInfo =
          context.metadata.throttleInfo.metadata || context.metadata.throttleInfo;
      }
      if (context.metadata.rateLimitInfo) {
        (request as any).rateLimitInfo =
          context.metadata.rateLimitInfo.metadata || context.metadata.rateLimitInfo;
      }
      if (context.metadata.circuitBreakerInfo) {
        (request as any).circuitBreakerInfo = context.metadata.circuitBreakerInfo;
      }
      if (context.metadata.overloadInfo) {
        (request as any).overloadInfo =
          context.metadata.overloadInfo.metadata || context.metadata.overloadInfo;
      }
    }
  }
}
