import type { IPriorityManagerOptions, IEnhancedShieldOptions } from "../guards/shield.guard";

/**
 * Configuration builder for comprehensive Shield Guard customization
 */
export class ShieldGuardConfigBuilder {
  private config: Partial<IEnhancedShieldOptions> = {};

  /**
   * Configure priority management options
   */
  priorityManager(options: Partial<IPriorityManagerOptions>): this {
    this.config.priorityManager = {
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
      ...options,
    };
    return this;
  }

  /**
   * Configure adaptive protection settings
   */
  adaptiveProtection(options: Partial<IEnhancedShieldOptions["adaptiveProtection"]>): this {
    this.config.adaptiveProtection = {
      enabled: true,
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
      ...options,
    };
    return this;
  }

  /**
   * Configure performance monitoring
   */
  performanceMonitoring(options: Partial<IEnhancedShieldOptions["performanceMonitoring"]>): this {
    this.config.performanceMonitoring = {
      enabled: true,
      metricsRetention: 300000,
      rollingAverageWindow: 60000,
      alertThresholds: {
        responseTime: 2000,
        errorRate: 0.05,
        throughput: 100,
      },
      ...options,
    };
    return this;
  }

  /**
   * Configure resilience options
   */
  resilience(options: Partial<IEnhancedShieldOptions["resilience"]>): this {
    this.config.resilience = {
      gracefulDegradation: true,
      fallbackStrategies: ["queue", "throttle", "reject"],
      recoveryMode: "automatic",
      healthCheckInterval: 30000,
      ...options,
    };
    return this;
  }

  /**
   * Apply enterprise-grade preset configuration
   */
  enterprisePreset(): this {
    return this.priorityManager({
      enabled: true,
      strategy: "adaptive",
      queueTimeout: 60000,
      maxQueueSize: 5000,
      adaptiveAdjustment: true,
      preemption: true,
      fairnessThreshold: 0.9,
    })
      .adaptiveProtection({
        enabled: true,
        monitoringInterval: 5000,
        emergencyMode: {
          enabled: true,
          triggerConditions: {
            errorRateThreshold: 0.1,
            responseTimeThreshold: 3000,
            queueDepthThreshold: 0.85,
          },
          actions: {
            reduceTimeouts: true,
            increaseLimits: true,
            enableFallbacks: true,
          },
        },
      })
      .performanceMonitoring({
        enabled: true,
        metricsRetention: 600000,
        rollingAverageWindow: 120000,
        alertThresholds: {
          responseTime: 1500,
          errorRate: 0.03,
          throughput: 500,
        },
      })
      .resilience({
        gracefulDegradation: true,
        recoveryMode: "automatic",
        healthCheckInterval: 15000,
      });
  }

  /**
   * Apply high-performance preset configuration
   */
  highPerformancePreset(): this {
    return this.priorityManager({
      enabled: true,
      strategy: "priority",
      queueTimeout: 15000,
      maxQueueSize: 2000,
      adaptiveAdjustment: false,
      preemption: false,
    })
      .adaptiveProtection({
        enabled: false,
      })
      .performanceMonitoring({
        enabled: true,
        metricsRetention: 120000,
        rollingAverageWindow: 30000,
        alertThresholds: {
          responseTime: 500,
          errorRate: 0.01,
          throughput: 1000,
        },
      })
      .resilience({
        gracefulDegradation: false,
        recoveryMode: "manual",
      });
  }

  /**
   * Apply development preset configuration
   */
  developmentPreset(): this {
    return this.priorityManager({
      enabled: false,
    })
      .adaptiveProtection({
        enabled: false,
      })
      .performanceMonitoring({
        enabled: true,
        metricsRetention: 60000,
        rollingAverageWindow: 10000,
        alertThresholds: {
          responseTime: 10000,
          errorRate: 0.5,
          throughput: 10,
        },
      })
      .resilience({
        gracefulDegradation: true,
        recoveryMode: "manual",
        healthCheckInterval: 60000,
      });
  }

  /**
   * Build the final configuration
   */
  build(): IEnhancedShieldOptions {
    return {
      priorityManager: {
        enabled: false,
        strategy: "fifo",
        queueTimeout: 30000,
        maxQueueSize: 1000,
        adaptiveAdjustment: false,
        preemption: false,
        fairnessThreshold: 0.8,
        metrics: {
          enabled: true,
          includeTimings: true,
          includeThroughput: true,
          includeQueueDepth: true,
        },
      },
      adaptiveProtection: {
        enabled: false,
        monitoringInterval: 10000,
        adjustmentThreshold: 0.8,
        emergencyMode: {
          enabled: false,
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
      },
      resilience: {
        gracefulDegradation: true,
        fallbackStrategies: ["queue", "throttle", "reject"],
        recoveryMode: "automatic",
        healthCheckInterval: 30000,
      },
      ...this.config,
    };
  }
}
