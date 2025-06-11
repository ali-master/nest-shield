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
import { AttackType, DetectorType } from "./common.dto";

/**
 * DTO for custom metric collection in anomaly detection
 */
export class CustomMetricDto {
  @ApiProperty({ description: "Name of the custom metric" })
  @IsString()
  name: string;

  @ApiProperty({ description: "Metric value" })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ description: "Metric timestamp (defaults to current time)" })
  @IsNumber()
  @IsOptional()
  timestamp?: number;

  @ApiPropertyOptional({ description: "Additional metadata for the metric" })
  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * DTO for attack simulation
 */
export class AttackSimulationDto {
  @ApiProperty({ description: "Type of attack to simulate", enum: AttackType })
  @IsEnum(AttackType)
  attackType: AttackType;

  @ApiProperty({ description: "Duration of the attack in seconds", minimum: 1, maximum: 300 })
  @IsNumber()
  @Min(1)
  @Max(300)
  duration: number;

  @ApiProperty({ description: "Intensity of the attack (1-10)", minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  intensity: number;

  @ApiPropertyOptional({ description: "Target endpoint for the attack" })
  @IsString()
  @IsOptional()
  targetEndpoint?: string;
}

/**
 * DTO for switching active detector
 */
export class DetectorSwitchDto {
  @ApiProperty({ description: "Detector type to activate", enum: DetectorType })
  @IsEnum(DetectorType)
  detectorType: DetectorType;

  @ApiPropertyOptional({ description: "Configuration for the new detector" })
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: "Whether to preserve historical data" })
  @IsBoolean()
  @IsOptional()
  preserveHistory?: boolean = true;
}

/**
 * DTO for Z-Score detection parameters
 */
export class ZScoreDetectionDto {
  @ApiProperty({ description: "Array of data points for analysis", type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  dataPoints: number[];

  @ApiProperty({
    description: "Z-Score threshold for anomaly detection",
    minimum: 1,
    maximum: 5,
    default: 2,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  threshold?: number = 2;

  @ApiPropertyOptional({ description: "Window size for rolling analysis", minimum: 5 })
  @IsNumber()
  @Min(5)
  @IsOptional()
  windowSize?: number;
}

/**
 * DTO for threshold detection parameters
 */
export class ThresholdDetectionDto {
  @ApiProperty({ description: "Array of data points for analysis", type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  dataPoints: number[];

  @ApiProperty({ description: "Upper threshold value" })
  @IsNumber()
  upperThreshold: number;

  @ApiPropertyOptional({ description: "Lower threshold value" })
  @IsNumber()
  @IsOptional()
  lowerThreshold?: number;

  @ApiPropertyOptional({
    description: "Number of consecutive violations before alerting",
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  consecutiveViolations?: number = 1;
}

/**
 * DTO for Isolation Forest detection parameters
 */
export class IsolationForestDto {
  @ApiProperty({
    description: "Training data for the isolation forest",
    type: [Number],
    isArray: true,
  })
  @IsArray()
  trainingData: number[][];

  @ApiProperty({ description: "Test data to analyze for anomalies", type: [Number], isArray: true })
  @IsArray()
  testData: number[][];

  @ApiPropertyOptional({
    description: "Contamination factor (expected fraction of outliers)",
    minimum: 0.01,
    maximum: 0.5,
  })
  @IsNumber()
  @Min(0.01)
  @Max(0.5)
  @IsOptional()
  contamination?: number = 0.1;

  @ApiPropertyOptional({ description: "Number of trees in the forest", minimum: 10, maximum: 200 })
  @IsNumber()
  @Min(10)
  @Max(200)
  @IsOptional()
  nTrees?: number = 100;
}

/**
 * DTO for seasonal detection parameters
 */
export class SeasonalDetectionDto {
  @ApiProperty({
    description: "Time series data with timestamps and values",
    type: [Number],
    isArray: true,
  })
  @IsArray()
  timeSeries: [number, number][]; // [timestamp, value] pairs

  @ApiProperty({ description: "Expected seasonal period in data points", minimum: 2 })
  @IsNumber()
  @Min(2)
  seasonalPeriod: number;

  @ApiPropertyOptional({
    description: "Sensitivity for seasonal anomaly detection",
    minimum: 0.1,
    maximum: 1.0,
  })
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  @IsOptional()
  sensitivity?: number = 0.3;

  @ApiPropertyOptional({ description: "Whether to auto-detect seasonal patterns" })
  @IsBoolean()
  @IsOptional()
  autoDetectSeason?: boolean = false;
}

/**
 * DTO for composite detection parameters
 */
export class CompositeDetectionDto {
  @ApiProperty({ description: "Data for analysis", type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  dataPoints: number[];

  @ApiProperty({
    description: "Detectors to use in composite analysis",
    enum: DetectorType,
    isArray: true,
  })
  @IsArray()
  @IsEnum(DetectorType, { each: true })
  detectors: DetectorType[];

  @ApiPropertyOptional({
    description: "Voting strategy for composite decision",
    enum: ["majority", "unanimous", "weighted"],
  })
  @IsString()
  @IsOptional()
  votingStrategy?: "majority" | "unanimous" | "weighted" = "majority";

  @ApiPropertyOptional({
    description: "Weights for each detector (only used with weighted voting)",
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  weights?: number[];
}

/**
 * Response DTO for anomaly detection results
 */
export class AnomalyDetectionResponseDto {
  @ApiProperty({ description: "Whether anomalies were detected" })
  anomaliesDetected: boolean;

  @ApiProperty({ description: "Number of anomalies found" })
  anomalyCount: number;

  @ApiProperty({ description: "Indices of anomalous data points", type: [Number] })
  anomalyIndices: number[];

  @ApiProperty({ description: "Anomaly scores for each data point", type: [Number] })
  anomalyScores: number[];

  @ApiProperty({ description: "Detector used for analysis" })
  detector: string;

  @ApiProperty({ description: "Analysis timestamp" })
  timestamp: number;

  @ApiPropertyOptional({ description: "Additional detection metadata" })
  metadata?: Record<string, any>;
}

/**
 * Response DTO for detector status
 */
export class DetectorStatusDto {
  @ApiProperty({ description: "Active detector type", enum: DetectorType })
  activeDetector: DetectorType;

  @ApiProperty({ description: "Detector health status" })
  status: "healthy" | "degraded" | "error";

  @ApiProperty({ description: "Number of data points processed" })
  dataPointsProcessed: number;

  @ApiProperty({ description: "Number of anomalies detected" })
  anomaliesDetected: number;

  @ApiProperty({ description: "Last detection timestamp" })
  lastDetection: number;

  @ApiPropertyOptional({ description: "Detector configuration" })
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: "Recent anomaly history" })
  recentAnomalies?: Array<{
    timestamp: number;
    value: number;
    score: number;
  }>;
}
