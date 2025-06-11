import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  Max,
} from "class-validator";
import { ProtectionLevel } from "./common.dto";

export enum SheddingStrategy {
  FIFO = "fifo",
  LIFO = "lifo",
  PRIORITY = "priority",
  RANDOM = "random",
  CUSTOM = "custom",
}

export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

/**
 * DTO for fallback testing in circuit breaker
 */
export class FallbackTestDto {
  @ApiProperty({ description: "Fallback message to return when circuit is open" })
  @IsString()
  fallbackMessage: string;

  @ApiPropertyOptional({ description: "Simulate failure to trigger fallback" })
  @IsBoolean()
  @IsOptional()
  simulateFailure?: boolean = false;

  @ApiPropertyOptional({ description: "Delay before fallback in milliseconds" })
  @IsNumber()
  @Min(0)
  @Max(5000)
  @IsOptional()
  fallbackDelay?: number = 0;
}

/**
 * DTO for shedding strategy testing
 */
export class SheddingTestDto {
  @ApiProperty({ description: "Shedding strategy to test", enum: SheddingStrategy })
  @IsEnum(SheddingStrategy)
  strategy: SheddingStrategy;

  @ApiProperty({ description: "Number of requests to simulate", minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  requestCount: number;

  @ApiPropertyOptional({ description: "Request priority (1-10)", minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  priority?: number = 5;

  @ApiPropertyOptional({ description: "Interval between requests in milliseconds" })
  @IsNumber()
  @Min(10)
  @Max(10000)
  @IsOptional()
  interval?: number = 100;
}

/**
 * DTO for selective protection configuration
 */
export class SelectiveProtectionDto {
  @ApiProperty({ description: "Enable rate limiting" })
  @IsBoolean()
  rateLimit: boolean;

  @ApiProperty({ description: "Enable throttling" })
  @IsBoolean()
  throttle: boolean;

  @ApiProperty({ description: "Enable overload protection" })
  @IsBoolean()
  overload: boolean;

  @ApiProperty({ description: "Enable circuit breaker" })
  @IsBoolean()
  circuitBreaker: boolean;

  @ApiPropertyOptional({ description: "Protection level", enum: ProtectionLevel })
  @IsEnum(ProtectionLevel)
  @IsOptional()
  level?: ProtectionLevel = ProtectionLevel.MEDIUM;

  @ApiPropertyOptional({ description: "Custom configuration overrides" })
  @IsOptional()
  customConfig?: Record<string, any>;
}

/**
 * DTO for adaptive protection configuration
 */
export class AdaptiveProtectionDto {
  @ApiProperty({ description: "Enable adaptive behavior" })
  @IsBoolean()
  adaptive: boolean;

  @ApiProperty({ description: "Base protection level", enum: ProtectionLevel })
  @IsEnum(ProtectionLevel)
  baseLevel: ProtectionLevel;

  @ApiPropertyOptional({ description: "Adaptation threshold (0.0-1.0)", minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  threshold?: number = 0.8;

  @ApiPropertyOptional({ description: "Monitoring window in seconds" })
  @IsNumber()
  @Min(10)
  @Max(3600)
  @IsOptional()
  monitoringWindow?: number = 60;

  @ApiPropertyOptional({ description: "Auto-scaling enabled" })
  @IsBoolean()
  @IsOptional()
  autoScale?: boolean = true;
}

/**
 * DTO for stress testing configuration
 */
export class StressTestDto {
  @ApiProperty({ description: "Number of concurrent requests", minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  concurrency: number;

  @ApiProperty({ description: "Total number of requests to send", minimum: 1, maximum: 10000 })
  @IsNumber()
  @Min(1)
  @Max(10000)
  totalRequests: number;

  @ApiProperty({ description: "Duration of stress test in seconds", minimum: 1, maximum: 300 })
  @IsNumber()
  @Min(1)
  @Max(300)
  duration: number;

  @ApiPropertyOptional({ description: "Request rate per second" })
  @IsNumber()
  @Min(1)
  @Max(1000)
  @IsOptional()
  requestRate?: number;

  @ApiPropertyOptional({ description: "Include error simulation" })
  @IsBoolean()
  @IsOptional()
  simulateErrors?: boolean = false;
}

/**
 * DTO for rate limit testing
 */
export class RateLimitTestDto {
  @ApiProperty({ description: "Requests per time window", minimum: 1, maximum: 1000 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit: number;

  @ApiProperty({ description: "Time window in seconds", minimum: 1, maximum: 3600 })
  @IsNumber()
  @Min(1)
  @Max(3600)
  windowSize: number;

  @ApiPropertyOptional({ description: "Custom key for rate limiting" })
  @IsString()
  @IsOptional()
  customKey?: string;

  @ApiPropertyOptional({ description: "Burst allowance" })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  burstSize?: number = 0;
}

/**
 * DTO for skip requests configuration
 */
export class SkipRequestsDto {
  @ApiProperty({ description: "Skip successful requests (HTTP 2xx)" })
  @IsBoolean()
  skipSuccessful: boolean;

  @ApiProperty({ description: "Skip failed requests (HTTP 4xx/5xx)" })
  @IsBoolean()
  skipFailed: boolean;

  @ApiPropertyOptional({ description: "Specific status codes to skip", type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  skipStatusCodes?: number[];

  @ApiPropertyOptional({ description: "Test duration in seconds" })
  @IsNumber()
  @Min(1)
  @Max(300)
  @IsOptional()
  testDuration?: number = 30;
}

/**
 * DTO for method-specific throttling
 */
export class MethodSpecificDto {
  @ApiProperty({
    description: "HTTP method to test",
    enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
  @IsEnum(["GET", "POST", "PUT", "DELETE", "PATCH"])
  method: string;

  @ApiProperty({ description: "Throttle limit for this method", minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number;

  @ApiProperty({ description: "Time window in seconds", minimum: 1, maximum: 300 })
  @IsNumber()
  @Min(1)
  @Max(300)
  ttl: number;

  @ApiPropertyOptional({ description: "Test request count" })
  @IsNumber()
  @Min(1)
  @Max(1000)
  @IsOptional()
  testRequests?: number = 10;
}

/**
 * Response DTO for circuit breaker status
 */
export class CircuitBreakerStatusDto {
  @ApiProperty({ description: "Current circuit breaker state", enum: CircuitBreakerState })
  state: CircuitBreakerState;

  @ApiProperty({ description: "Failure count" })
  failureCount: number;

  @ApiProperty({ description: "Success count" })
  successCount: number;

  @ApiProperty({ description: "Total request count" })
  totalRequests: number;

  @ApiProperty({ description: "Failure rate percentage" })
  failureRate: number;

  @ApiProperty({ description: "Next allowed attempt timestamp" })
  nextAttemptTime: number;

  @ApiPropertyOptional({ description: "Circuit breaker configuration" })
  configuration?: Record<string, any>;
}

/**
 * Response DTO for protection test results
 */
export class ProtectionTestResultDto {
  @ApiProperty({ description: "Test completed successfully" })
  success: boolean;

  @ApiProperty({ description: "Total requests sent" })
  totalRequests: number;

  @ApiProperty({ description: "Requests allowed through" })
  allowedRequests: number;

  @ApiProperty({ description: "Requests blocked" })
  blockedRequests: number;

  @ApiProperty({ description: "Average response time in milliseconds" })
  avgResponseTime: number;

  @ApiProperty({ description: "Protection mechanisms that were triggered", type: [String] })
  triggeredProtections: string[];

  @ApiProperty({ description: "Test duration in milliseconds" })
  testDuration: number;

  @ApiPropertyOptional({ description: "Error messages if any" })
  errors?: string[];

  @ApiPropertyOptional({ description: "Additional test metadata" })
  metadata?: Record<string, any>;
}
