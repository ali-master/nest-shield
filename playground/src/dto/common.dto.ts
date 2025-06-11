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

export enum ProtectionLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum AttackType {
  DOS = "dos",
  BRUTE_FORCE = "brute_force",
  RATE_ABUSE = "rate_abuse",
  RESOURCE_EXHAUSTION = "resource_exhaustion",
  CIRCUIT_OVERLOAD = "circuit_overload",
}

export enum DetectorType {
  ZSCORE = "zscore",
  THRESHOLD = "threshold",
  ISOLATION_FOREST = "isolation_forest",
  SEASONAL = "seasonal",
  COMPOSITE = "composite",
}

/**
 * Standard response for protection status
 */
export class ProtectionResponseDto {
  @ApiProperty({ description: "Indicates if the request was allowed" })
  allowed: boolean;

  @ApiProperty({ description: "Current timestamp of the response" })
  timestamp: string;

  @ApiProperty({ description: "Request ID for tracing" })
  requestId: string;

  @ApiPropertyOptional({ description: "Reason for rejection if blocked" })
  reason?: string;

  @ApiPropertyOptional({ description: "Retry after seconds if rate limited" })
  retryAfter?: number;

  @ApiPropertyOptional({ description: "Additional metadata about the protection" })
  metadata?: Record<string, any>;
}

/**
 * Standard error response for rate limiting and protection
 */
export class ErrorResponseDto {
  @ApiProperty({ description: "HTTP status code" })
  statusCode: number;

  @ApiProperty({ description: "Error message" })
  message: string;

  @ApiProperty({ description: "Error type identifier" })
  error: string;

  @ApiProperty({ description: "Timestamp when error occurred" })
  timestamp: string;

  @ApiProperty({ description: "Request path that triggered the error" })
  path: string;

  @ApiPropertyOptional({ description: "Request ID for tracing" })
  requestId?: string;

  @ApiPropertyOptional({ description: "Retry after seconds for rate limiting" })
  retryAfter?: number;
}

/**
 * Metrics data structure
 */
export class MetricDataDto {
  @ApiProperty({ description: "Metric name" })
  name: string;

  @ApiProperty({ description: "Metric value" })
  value: number;

  @ApiProperty({ description: "Timestamp when metric was recorded" })
  timestamp: number;

  @ApiPropertyOptional({ description: "Metric labels/tags" })
  labels?: Record<string, string>;
}

/**
 * Health status response
 */
export class HealthStatusDto {
  @ApiProperty({ description: "Overall health status", enum: ["healthy", "degraded", "unhealthy"] })
  status: "healthy" | "degraded" | "unhealthy";

  @ApiProperty({ description: "Service uptime in milliseconds" })
  uptime: number;

  @ApiProperty({ description: "Number of requests processed" })
  requestsProcessed: number;

  @ApiProperty({ description: "Number of errors encountered" })
  errors: number;

  @ApiPropertyOptional({ description: "Additional health details" })
  details?: Record<string, any>;
}

/**
 * Configuration validation response
 */
export class ConfigValidationDto {
  @ApiProperty({ description: "Whether configuration is valid" })
  valid: boolean;

  @ApiPropertyOptional({ description: "Validation errors if any" })
  errors?: string[];

  @ApiPropertyOptional({ description: "Configuration warnings" })
  warnings?: string[];

  @ApiPropertyOptional({ description: "Validated configuration object" })
  config?: Record<string, any>;
}
