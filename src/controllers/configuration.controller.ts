import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UsePipes,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from "@nestjs/swagger";
import {
  ConfigurationService,
  RateLimitConfig,
  CircuitBreakerConfig,
  ThrottleConfig,
  AnomalyDetectionConfig,
  ShieldGlobalConfig,
} from "../services/configuration.service";

// DTOs for validation
export class CreateRateLimitConfigDto {
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
}

export class UpdateRateLimitConfigDto {
  name?: string;
  path?: string;
  method?: string;
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: string;
  enabled?: boolean;
}

export class CreateCircuitBreakerConfigDto {
  name: string;
  service: string;
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  fallbackResponse?: any;
  enabled: boolean;
}

export class UpdateCircuitBreakerConfigDto {
  name?: string;
  service?: string;
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  fallbackResponse?: any;
  enabled?: boolean;
}

export class CreateThrottleConfigDto {
  name: string;
  path: string;
  ttl: number;
  limit: number;
  blockDuration?: number;
  keyGenerator?: string;
  enabled: boolean;
}

export class UpdateThrottleConfigDto {
  name?: string;
  path?: string;
  ttl?: number;
  limit?: number;
  blockDuration?: number;
  keyGenerator?: string;
  enabled?: boolean;
}

export class CreateAnomalyDetectionConfigDto {
  name: string;
  detectorType: string;
  threshold: number;
  sensitivity: "low" | "medium" | "high";
  windowSize: number;
  features: string[];
  enabled: boolean;
  config: Record<string, any>;
}

export class UpdateAnomalyDetectionConfigDto {
  name?: string;
  detectorType?: string;
  threshold?: number;
  sensitivity?: "low" | "medium" | "high";
  windowSize?: number;
  features?: string[];
  enabled?: boolean;
  config?: Record<string, any>;
}

@ApiTags("Configuration Management")
@Controller("api/shield/config")
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  // Rate Limit Configuration Endpoints
  @Get("rate-limits")
  @ApiOperation({ summary: "Get all rate limit configurations" })
  @ApiResponse({ status: 200, description: "List of rate limit configurations" })
  async getAllRateLimitConfigs(): Promise<RateLimitConfig[]> {
    return this.configurationService.getAllRateLimitConfigs();
  }

  @Get("rate-limits/:id")
  @ApiOperation({ summary: "Get rate limit configuration by ID" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 200, description: "Rate limit configuration" })
  @ApiResponse({ status: 404, description: "Configuration not found" })
  async getRateLimitConfig(@Param("id") id: string): Promise<RateLimitConfig> {
    const config = await this.configurationService.getRateLimitConfig(id);
    if (!config) {
      throw new Error("Rate limit configuration not found");
    }
    return config;
  }

  @Post("rate-limits")
  @ApiOperation({ summary: "Create new rate limit configuration" })
  @ApiBody({ type: CreateRateLimitConfigDto })
  @ApiResponse({ status: 201, description: "Rate limit configuration created" })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createRateLimitConfig(
    @Body() createDto: CreateRateLimitConfigDto,
  ): Promise<RateLimitConfig> {
    return this.configurationService.createRateLimitConfig(createDto);
  }

  @Put("rate-limits/:id")
  @ApiOperation({ summary: "Update rate limit configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiBody({ type: UpdateRateLimitConfigDto })
  @ApiResponse({ status: 200, description: "Rate limit configuration updated" })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateRateLimitConfig(
    @Param("id") id: string,
    @Body() updateDto: UpdateRateLimitConfigDto,
  ): Promise<RateLimitConfig> {
    return this.configurationService.updateRateLimitConfig(id, updateDto);
  }

  @Delete("rate-limits/:id")
  @ApiOperation({ summary: "Delete rate limit configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 204, description: "Rate limit configuration deleted" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRateLimitConfig(@Param("id") id: string): Promise<void> {
    return this.configurationService.deleteRateLimitConfig(id);
  }

  // Circuit Breaker Configuration Endpoints
  @Get("circuit-breakers")
  @ApiOperation({ summary: "Get all circuit breaker configurations" })
  @ApiResponse({ status: 200, description: "List of circuit breaker configurations" })
  async getAllCircuitBreakerConfigs(): Promise<CircuitBreakerConfig[]> {
    return this.configurationService.getAllCircuitBreakerConfigs();
  }

  @Get("circuit-breakers/:id")
  @ApiOperation({ summary: "Get circuit breaker configuration by ID" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 200, description: "Circuit breaker configuration" })
  async getCircuitBreakerConfig(@Param("id") id: string): Promise<CircuitBreakerConfig> {
    const config = await this.configurationService.getCircuitBreakerConfig(id);
    if (!config) {
      throw new Error("Circuit breaker configuration not found");
    }
    return config;
  }

  @Post("circuit-breakers")
  @ApiOperation({ summary: "Create new circuit breaker configuration" })
  @ApiBody({ type: CreateCircuitBreakerConfigDto })
  @ApiResponse({ status: 201, description: "Circuit breaker configuration created" })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createCircuitBreakerConfig(
    @Body() createDto: CreateCircuitBreakerConfigDto,
  ): Promise<CircuitBreakerConfig> {
    return this.configurationService.createCircuitBreakerConfig(createDto);
  }

  @Put("circuit-breakers/:id")
  @ApiOperation({ summary: "Update circuit breaker configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiBody({ type: UpdateCircuitBreakerConfigDto })
  @ApiResponse({ status: 200, description: "Circuit breaker configuration updated" })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateCircuitBreakerConfig(
    @Param("id") id: string,
    @Body() updateDto: UpdateCircuitBreakerConfigDto,
  ): Promise<CircuitBreakerConfig> {
    return this.configurationService.updateCircuitBreakerConfig(id, updateDto);
  }

  @Delete("circuit-breakers/:id")
  @ApiOperation({ summary: "Delete circuit breaker configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 204, description: "Circuit breaker configuration deleted" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCircuitBreakerConfig(@Param("id") id: string): Promise<void> {
    return this.configurationService.deleteCircuitBreakerConfig(id);
  }

  // Throttle Configuration Endpoints
  @Get("throttles")
  @ApiOperation({ summary: "Get all throttle configurations" })
  @ApiResponse({ status: 200, description: "List of throttle configurations" })
  async getAllThrottleConfigs(): Promise<ThrottleConfig[]> {
    return this.configurationService.getAllThrottleConfigs();
  }

  @Get("throttles/:id")
  @ApiOperation({ summary: "Get throttle configuration by ID" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 200, description: "Throttle configuration" })
  async getThrottleConfig(@Param("id") id: string): Promise<ThrottleConfig> {
    const config = await this.configurationService.getThrottleConfig(id);
    if (!config) {
      throw new Error("Throttle configuration not found");
    }
    return config;
  }

  @Post("throttles")
  @ApiOperation({ summary: "Create new throttle configuration" })
  @ApiBody({ type: CreateThrottleConfigDto })
  @ApiResponse({ status: 201, description: "Throttle configuration created" })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createThrottleConfig(@Body() createDto: CreateThrottleConfigDto): Promise<ThrottleConfig> {
    return this.configurationService.createThrottleConfig(createDto);
  }

  @Put("throttles/:id")
  @ApiOperation({ summary: "Update throttle configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiBody({ type: UpdateThrottleConfigDto })
  @ApiResponse({ status: 200, description: "Throttle configuration updated" })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateThrottleConfig(
    @Param("id") id: string,
    @Body() updateDto: UpdateThrottleConfigDto,
  ): Promise<ThrottleConfig> {
    return this.configurationService.updateThrottleConfig(id, updateDto);
  }

  @Delete("throttles/:id")
  @ApiOperation({ summary: "Delete throttle configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 204, description: "Throttle configuration deleted" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThrottleConfig(@Param("id") id: string): Promise<void> {
    return this.configurationService.deleteThrottleConfig(id);
  }

  // Anomaly Detection Configuration Endpoints
  @Get("anomaly-detection")
  @ApiOperation({ summary: "Get all anomaly detection configurations" })
  @ApiResponse({ status: 200, description: "List of anomaly detection configurations" })
  async getAllAnomalyDetectionConfigs(): Promise<AnomalyDetectionConfig[]> {
    return this.configurationService.getAllAnomalyDetectionConfigs();
  }

  @Get("anomaly-detection/:id")
  @ApiOperation({ summary: "Get anomaly detection configuration by ID" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 200, description: "Anomaly detection configuration" })
  async getAnomalyDetectionConfig(@Param("id") id: string): Promise<AnomalyDetectionConfig> {
    const config = await this.configurationService.getAnomalyDetectionConfig(id);
    if (!config) {
      throw new Error("Anomaly detection configuration not found");
    }
    return config;
  }

  @Post("anomaly-detection")
  @ApiOperation({ summary: "Create new anomaly detection configuration" })
  @ApiBody({ type: CreateAnomalyDetectionConfigDto })
  @ApiResponse({ status: 201, description: "Anomaly detection configuration created" })
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createAnomalyDetectionConfig(
    @Body() createDto: CreateAnomalyDetectionConfigDto,
  ): Promise<AnomalyDetectionConfig> {
    return this.configurationService.createAnomalyDetectionConfig(createDto);
  }

  @Put("anomaly-detection/:id")
  @ApiOperation({ summary: "Update anomaly detection configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiBody({ type: UpdateAnomalyDetectionConfigDto })
  @ApiResponse({ status: 200, description: "Anomaly detection configuration updated" })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateAnomalyDetectionConfig(
    @Param("id") id: string,
    @Body() updateDto: UpdateAnomalyDetectionConfigDto,
  ): Promise<AnomalyDetectionConfig> {
    return this.configurationService.updateAnomalyDetectionConfig(id, updateDto);
  }

  @Delete("anomaly-detection/:id")
  @ApiOperation({ summary: "Delete anomaly detection configuration" })
  @ApiParam({ name: "id", description: "Configuration ID" })
  @ApiResponse({ status: 204, description: "Anomaly detection configuration deleted" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAnomalyDetectionConfig(@Param("id") id: string): Promise<void> {
    return this.configurationService.deleteAnomalyDetectionConfig(id);
  }

  // Global Configuration Endpoints
  @Get("global")
  @ApiOperation({ summary: "Get global shield configuration" })
  @ApiResponse({ status: 200, description: "Global shield configuration" })
  async getGlobalConfig(): Promise<ShieldGlobalConfig> {
    return this.configurationService.getGlobalConfig();
  }

  @Put("global")
  @ApiOperation({ summary: "Update global shield configuration" })
  @ApiResponse({ status: 200, description: "Global shield configuration updated" })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateGlobalConfig(
    @Body() updateDto: Partial<ShieldGlobalConfig>,
  ): Promise<ShieldGlobalConfig> {
    return this.configurationService.updateGlobalConfig(updateDto);
  }

  // Bulk Operations
  @Get("export")
  @ApiOperation({ summary: "Export all configurations" })
  @ApiResponse({ status: 200, description: "All configurations exported" })
  async exportConfiguration() {
    return this.configurationService.exportConfiguration();
  }

  @Post("import")
  @ApiOperation({ summary: "Import configurations" })
  @ApiResponse({ status: 200, description: "Configurations imported successfully" })
  async importConfiguration(@Body() configData: any): Promise<{ message: string }> {
    await this.configurationService.importConfiguration(configData);
    return { message: "Configurations imported successfully" };
  }

  @Get("validate")
  @ApiOperation({ summary: "Validate current configurations" })
  @ApiResponse({ status: 200, description: "Configuration validation results" })
  async validateConfiguration() {
    return this.configurationService.validateConfiguration();
  }

  // Configuration Statistics
  @Get("stats")
  @ApiOperation({ summary: "Get configuration statistics" })
  @ApiResponse({ status: 200, description: "Configuration statistics" })
  async getConfigurationStats() {
    const [rateLimits, circuitBreakers, throttles, anomalyConfigs] = await Promise.all([
      this.configurationService.getAllRateLimitConfigs(),
      this.configurationService.getAllCircuitBreakerConfigs(),
      this.configurationService.getAllThrottleConfigs(),
      this.configurationService.getAllAnomalyDetectionConfigs(),
    ]);

    return {
      rateLimits: {
        total: rateLimits.length,
        enabled: rateLimits.filter((config) => config.enabled).length,
        disabled: rateLimits.filter((config) => !config.enabled).length,
      },
      circuitBreakers: {
        total: circuitBreakers.length,
        enabled: circuitBreakers.filter((config) => config.enabled).length,
        disabled: circuitBreakers.filter((config) => !config.enabled).length,
      },
      throttles: {
        total: throttles.length,
        enabled: throttles.filter((config) => config.enabled).length,
        disabled: throttles.filter((config) => !config.enabled).length,
      },
      anomalyDetection: {
        total: anomalyConfigs.length,
        enabled: anomalyConfigs.filter((config) => config.enabled).length,
        disabled: anomalyConfigs.filter((config) => !config.enabled).length,
      },
      summary: {
        totalConfigurations:
          rateLimits.length + circuitBreakers.length + throttles.length + anomalyConfigs.length,
        totalEnabled:
          rateLimits.filter((c) => c.enabled).length +
          circuitBreakers.filter((c) => c.enabled).length +
          throttles.filter((c) => c.enabled).length +
          anomalyConfigs.filter((c) => c.enabled).length,
      },
    };
  }

  // Configuration Templates
  @Get("templates/:type")
  @ApiOperation({ summary: "Get configuration templates" })
  @ApiParam({
    name: "type",
    description: "Configuration type (rateLimit, circuitBreaker, throttle, anomalyDetection)",
  })
  @ApiResponse({ status: 200, description: "Configuration templates" })
  async getConfigurationTemplates(@Param("type") type: string) {
    const templates = {
      rateLimit: [
        {
          name: "API Rate Limit",
          description: "Standard API rate limiting for authenticated users",
          template: {
            name: "API Rate Limit",
            path: "/api/*",
            method: "ALL",
            windowMs: 60000,
            maxRequests: 100,
            enabled: true,
          },
        },
        {
          name: "Authentication Rate Limit",
          description: "Strict rate limiting for authentication endpoints",
          template: {
            name: "Auth Rate Limit",
            path: "/auth/*",
            method: "POST",
            windowMs: 900000, // 15 minutes
            maxRequests: 5,
            enabled: true,
          },
        },
      ],
      circuitBreaker: [
        {
          name: "Database Circuit Breaker",
          description: "Circuit breaker for database connections",
          template: {
            name: "Database Circuit Breaker",
            service: "database",
            failureThreshold: 5,
            recoveryTimeout: 30000,
            monitoringPeriod: 60000,
            enabled: true,
          },
        },
      ],
      throttle: [
        {
          name: "Heavy Operation Throttle",
          description: "Throttle for resource-intensive operations",
          template: {
            name: "Heavy Operation Throttle",
            path: "/api/heavy/*",
            ttl: 60000,
            limit: 5,
            enabled: true,
          },
        },
      ],
      anomalyDetection: [
        {
          name: "Request Pattern Anomaly Detection",
          description: "Detect unusual request patterns",
          template: {
            name: "Request Pattern Detection",
            detectorType: "statistical",
            threshold: 0.95,
            sensitivity: "medium",
            windowSize: 100,
            features: ["request_rate", "response_time", "error_rate"],
            enabled: true,
            config: {
              method: "zscore",
              threshold: 3,
            },
          },
        },
      ],
    };

    return templates[type] || [];
  }
}
