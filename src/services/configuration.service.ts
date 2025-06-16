import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IStorageAdapter } from "../storage/base-storage.adapter";
import { Inject } from "@nestjs/common";
import { STORAGE_ADAPTER } from "../core/di-tokens";
import { ShieldLoggerService } from "./shield-logger.service";

export interface RateLimitConfig {
  id: string;
  name: string;
  path: string;
  method: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CircuitBreakerConfig {
  id: string;
  name: string;
  service: string;
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  fallbackResponse?: any;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThrottleConfig {
  id: string;
  name: string;
  path: string;
  ttl: number;
  limit: number;
  blockDuration?: number;
  keyGenerator?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnomalyDetectionConfig {
  id: string;
  name: string;
  detectorType: string;
  threshold: number;
  sensitivity: "low" | "medium" | "high";
  windowSize: number;
  features: string[];
  enabled: boolean;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShieldGlobalConfig {
  enabled: boolean;
  mode: "monitor" | "protect" | "strict";
  defaultResponseHeaders: Record<string, string>;
  logging: {
    enabled: boolean;
    level: "error" | "warn" | "info" | "debug";
    includeSensitiveData: boolean;
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
    retentionPeriod: number;
  };
  alerts: {
    enabled: boolean;
    channels: string[];
    thresholds: Record<string, number>;
  };
  performance: {
    maxConcurrentRequests: number;
    queueTimeout: number;
    gracefulShutdownTimeout: number;
  };
}

export interface ConfigurationChangeEvent {
  type: "create" | "update" | "delete";
  configType: "rateLimit" | "circuitBreaker" | "throttle" | "anomalyDetection" | "global";
  configId: string;
  changes: Record<string, any>;
  timestamp: Date;
  user?: string;
}

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);
  private configCache = new Map<string, any>();
  private readonly cachePrefix = "shield:config";

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly shieldLogger: ShieldLoggerService,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  // Rate Limit Configuration Management
  async createRateLimitConfig(
    config: Omit<RateLimitConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<RateLimitConfig> {
    const id = this.generateId("rl");
    const now = new Date();

    const rateLimitConfig: RateLimitConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveConfig("rateLimit", id, rateLimitConfig);

    this.eventEmitter.emit("config.rateLimit.created", rateLimitConfig);
    this.emitConfigChangeEvent("create", "rateLimit", id, rateLimitConfig);

    this.shieldLogger.info("Rate limit configuration created", {
      configId: id,
      config: rateLimitConfig,
    });

    return rateLimitConfig;
  }

  async updateRateLimitConfig(
    id: string,
    updates: Partial<RateLimitConfig>,
  ): Promise<RateLimitConfig> {
    const existing = await this.getRateLimitConfig(id);
    if (!existing) {
      throw new BadRequestException(`Rate limit configuration with id ${id} not found`);
    }

    const updated: RateLimitConfig = {
      ...existing,
      ...updates,
      id, // Prevent ID change
      updatedAt: new Date(),
    };

    await this.saveConfig("rateLimit", id, updated);

    this.eventEmitter.emit("config.rateLimit.updated", updated);
    this.emitConfigChangeEvent("update", "rateLimit", id, updates);

    this.shieldLogger.info("Rate limit configuration updated", { configId: id, updates });

    return updated;
  }

  async getRateLimitConfig(id: string): Promise<RateLimitConfig | null> {
    return this.getConfig("rateLimit", id);
  }

  async getAllRateLimitConfigs(): Promise<RateLimitConfig[]> {
    return this.getAllConfigs("rateLimit");
  }

  async deleteRateLimitConfig(id: string): Promise<void> {
    await this.deleteConfig("rateLimit", id);
    this.eventEmitter.emit("config.rateLimit.deleted", { id });
    this.emitConfigChangeEvent("delete", "rateLimit", id, {});
    this.shieldLogger.info("Rate limit configuration deleted", { configId: id });
  }

  // Circuit Breaker Configuration Management
  async createCircuitBreakerConfig(
    config: Omit<CircuitBreakerConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<CircuitBreakerConfig> {
    const id = this.generateId("cb");
    const now = new Date();

    const circuitBreakerConfig: CircuitBreakerConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveConfig("circuitBreaker", id, circuitBreakerConfig);

    this.eventEmitter.emit("config.circuitBreaker.created", circuitBreakerConfig);
    this.emitConfigChangeEvent("create", "circuitBreaker", id, circuitBreakerConfig);

    this.shieldLogger.info("Circuit breaker configuration created", {
      configId: id,
      config: circuitBreakerConfig,
    });

    return circuitBreakerConfig;
  }

  async updateCircuitBreakerConfig(
    id: string,
    updates: Partial<CircuitBreakerConfig>,
  ): Promise<CircuitBreakerConfig> {
    const existing = await this.getCircuitBreakerConfig(id);
    if (!existing) {
      throw new BadRequestException(`Circuit breaker configuration with id ${id} not found`);
    }

    const updated: CircuitBreakerConfig = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    await this.saveConfig("circuitBreaker", id, updated);

    this.eventEmitter.emit("config.circuitBreaker.updated", updated);
    this.emitConfigChangeEvent("update", "circuitBreaker", id, updates);

    return updated;
  }

  async getCircuitBreakerConfig(id: string): Promise<CircuitBreakerConfig | null> {
    return this.getConfig("circuitBreaker", id);
  }

  async getAllCircuitBreakerConfigs(): Promise<CircuitBreakerConfig[]> {
    return this.getAllConfigs("circuitBreaker");
  }

  async deleteCircuitBreakerConfig(id: string): Promise<void> {
    await this.deleteConfig("circuitBreaker", id);
    this.eventEmitter.emit("config.circuitBreaker.deleted", { id });
    this.emitConfigChangeEvent("delete", "circuitBreaker", id, {});
  }

  // Throttle Configuration Management
  async createThrottleConfig(
    config: Omit<ThrottleConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<ThrottleConfig> {
    const id = this.generateId("th");
    const now = new Date();

    const throttleConfig: ThrottleConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveConfig("throttle", id, throttleConfig);

    this.eventEmitter.emit("config.throttle.created", throttleConfig);
    this.emitConfigChangeEvent("create", "throttle", id, throttleConfig);

    return throttleConfig;
  }

  async updateThrottleConfig(
    id: string,
    updates: Partial<ThrottleConfig>,
  ): Promise<ThrottleConfig> {
    const existing = await this.getThrottleConfig(id);
    if (!existing) {
      throw new BadRequestException(`Throttle configuration with id ${id} not found`);
    }

    const updated: ThrottleConfig = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    await this.saveConfig("throttle", id, updated);

    this.eventEmitter.emit("config.throttle.updated", updated);
    this.emitConfigChangeEvent("update", "throttle", id, updates);

    return updated;
  }

  async getThrottleConfig(id: string): Promise<ThrottleConfig | null> {
    return this.getConfig("throttle", id);
  }

  async getAllThrottleConfigs(): Promise<ThrottleConfig[]> {
    return this.getAllConfigs("throttle");
  }

  async deleteThrottleConfig(id: string): Promise<void> {
    await this.deleteConfig("throttle", id);
    this.eventEmitter.emit("config.throttle.deleted", { id });
    this.emitConfigChangeEvent("delete", "throttle", id, {});
  }

  // Anomaly Detection Configuration Management
  async createAnomalyDetectionConfig(
    config: Omit<AnomalyDetectionConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<AnomalyDetectionConfig> {
    const id = this.generateId("ad");
    const now = new Date();

    const anomalyConfig: AnomalyDetectionConfig = {
      ...config,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveConfig("anomalyDetection", id, anomalyConfig);

    this.eventEmitter.emit("config.anomalyDetection.created", anomalyConfig);
    this.emitConfigChangeEvent("create", "anomalyDetection", id, anomalyConfig);

    return anomalyConfig;
  }

  async updateAnomalyDetectionConfig(
    id: string,
    updates: Partial<AnomalyDetectionConfig>,
  ): Promise<AnomalyDetectionConfig> {
    const existing = await this.getAnomalyDetectionConfig(id);
    if (!existing) {
      throw new BadRequestException(`Anomaly detection configuration with id ${id} not found`);
    }

    const updated: AnomalyDetectionConfig = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    await this.saveConfig("anomalyDetection", id, updated);

    this.eventEmitter.emit("config.anomalyDetection.updated", updated);
    this.emitConfigChangeEvent("update", "anomalyDetection", id, updates);

    return updated;
  }

  async getAnomalyDetectionConfig(id: string): Promise<AnomalyDetectionConfig | null> {
    return this.getConfig("anomalyDetection", id);
  }

  async getAllAnomalyDetectionConfigs(): Promise<AnomalyDetectionConfig[]> {
    return this.getAllConfigs("anomalyDetection");
  }

  async deleteAnomalyDetectionConfig(id: string): Promise<void> {
    await this.deleteConfig("anomalyDetection", id);
    this.eventEmitter.emit("config.anomalyDetection.deleted", { id });
    this.emitConfigChangeEvent("delete", "anomalyDetection", id, {});
  }

  // Global Configuration Management
  async updateGlobalConfig(updates: Partial<ShieldGlobalConfig>): Promise<ShieldGlobalConfig> {
    const existing = await this.getGlobalConfig();
    const updated: ShieldGlobalConfig = {
      ...existing,
      ...updates,
    };

    await this.saveConfig("global", "main", updated);

    this.eventEmitter.emit("config.global.updated", updated);
    this.emitConfigChangeEvent("update", "global", "main", updates);

    return updated;
  }

  async getGlobalConfig(): Promise<ShieldGlobalConfig> {
    const config = await this.getConfig("global", "main");

    if (!config) {
      // Return default configuration
      return this.getDefaultGlobalConfig();
    }

    return config;
  }

  // Bulk Configuration Operations
  async exportConfiguration(): Promise<{
    rateLimits: RateLimitConfig[];
    circuitBreakers: CircuitBreakerConfig[];
    throttles: ThrottleConfig[];
    anomalyDetection: AnomalyDetectionConfig[];
    global: ShieldGlobalConfig;
    exportedAt: Date;
  }> {
    const [rateLimits, circuitBreakers, throttles, anomalyDetection, global] = await Promise.all([
      this.getAllRateLimitConfigs(),
      this.getAllCircuitBreakerConfigs(),
      this.getAllThrottleConfigs(),
      this.getAllAnomalyDetectionConfigs(),
      this.getGlobalConfig(),
    ]);

    return {
      rateLimits,
      circuitBreakers,
      throttles,
      anomalyDetection,
      global,
      exportedAt: new Date(),
    };
  }

  async importConfiguration(config: any): Promise<void> {
    // Validate configuration structure
    this.validateImportedConfiguration(config);

    // Import each configuration type
    if (config.rateLimits) {
      for (const rateLimitConfig of config.rateLimits) {
        await this.createRateLimitConfig(rateLimitConfig);
      }
    }

    if (config.circuitBreakers) {
      for (const circuitBreakerConfig of config.circuitBreakers) {
        await this.createCircuitBreakerConfig(circuitBreakerConfig);
      }
    }

    if (config.throttles) {
      for (const throttleConfig of config.throttles) {
        await this.createThrottleConfig(throttleConfig);
      }
    }

    if (config.anomalyDetection) {
      for (const anomalyConfig of config.anomalyDetection) {
        await this.createAnomalyDetectionConfig(anomalyConfig);
      }
    }

    if (config.global) {
      await this.updateGlobalConfig(config.global);
    }

    this.shieldLogger.info("Configuration imported successfully");
  }

  // Configuration Validation
  async validateConfiguration(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate rate limit configurations
      const rateLimits = await this.getAllRateLimitConfigs();
      for (const config of rateLimits) {
        if (config.maxRequests <= 0) {
          errors.push(`Rate limit ${config.id}: maxRequests must be positive`);
        }
        if (config.windowMs <= 0) {
          errors.push(`Rate limit ${config.id}: windowMs must be positive`);
        }
      }

      // Validate circuit breaker configurations
      const circuitBreakers = await this.getAllCircuitBreakerConfigs();
      for (const config of circuitBreakers) {
        if (config.failureThreshold <= 0) {
          errors.push(`Circuit breaker ${config.id}: failureThreshold must be positive`);
        }
        if (config.recoveryTimeout <= 0) {
          errors.push(`Circuit breaker ${config.id}: recoveryTimeout must be positive`);
        }
      }

      // Add more validation rules...
    } catch (error) {
      errors.push(`Configuration validation failed: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Private helper methods
  private async saveConfig(type: string, id: string, config: any): Promise<void> {
    const key = `${this.cachePrefix}:${type}:${id}`;
    await this.storage.set(key, JSON.stringify(config));
    this.configCache.set(key, config);
  }

  private async getConfig<T>(type: string, id: string): Promise<T | null> {
    const key = `${this.cachePrefix}:${type}:${id}`;

    // Check cache first
    if (this.configCache.has(key)) {
      return this.configCache.get(key);
    }

    // Fetch from storage
    const data = await this.storage.get(key);
    if (data) {
      const config = JSON.parse(data);
      this.configCache.set(key, config);
      return config;
    }

    return null;
  }

  private async getAllConfigs<T>(type: string): Promise<T[]> {
    const pattern = `${this.cachePrefix}:${type}:*`;
    const keys = await this.storage.keys(pattern);
    const configs: T[] = [];

    for (const key of keys) {
      const data = await this.storage.get(key);
      if (data) {
        configs.push(JSON.parse(data));
      }
    }

    return configs;
  }

  private async deleteConfig(type: string, id: string): Promise<void> {
    const key = `${this.cachePrefix}:${type}:${id}`;
    await this.storage.delete(key);
    this.configCache.delete(key);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitConfigChangeEvent(
    type: ConfigurationChangeEvent["type"],
    configType: ConfigurationChangeEvent["configType"],
    configId: string,
    changes: Record<string, any>,
  ): void {
    const event: ConfigurationChangeEvent = {
      type,
      configType,
      configId,
      changes,
      timestamp: new Date(),
    };

    this.eventEmitter.emit("config.changed", event);
  }

  private getDefaultGlobalConfig(): ShieldGlobalConfig {
    return {
      enabled: true,
      mode: "protect",
      defaultResponseHeaders: {
        "X-Shield-Protected": "true",
      },
      logging: {
        enabled: true,
        level: "info",
        includeSensitiveData: false,
      },
      metrics: {
        enabled: true,
        exportInterval: 60000,
        retentionPeriod: 86400000,
      },
      alerts: {
        enabled: true,
        channels: ["console"],
        thresholds: {
          errorRate: 5,
          responseTime: 1000,
          cpuUsage: 80,
          memoryUsage: 85,
        },
      },
      performance: {
        maxConcurrentRequests: 1000,
        queueTimeout: 30000,
        gracefulShutdownTimeout: 10000,
      },
    };
  }

  private validateImportedConfiguration(config: any): void {
    if (!config || typeof config !== "object") {
      throw new BadRequestException("Invalid configuration format");
    }

    // Add validation logic for imported configuration
    // This would include schema validation, required fields, etc.
  }
}
