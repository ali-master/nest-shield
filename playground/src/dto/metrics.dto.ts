import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsString, IsOptional, IsObject, IsEnum, IsArray } from "class-validator";

export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram",
  SUMMARY = "summary",
}

export enum ExportFormat {
  JSON = "json",
  PROMETHEUS = "prometheus",
  CSV = "csv",
  XML = "xml",
}

/**
 * DTO for incrementing a metric
 */
export class IncrementMetricDto {
  @ApiProperty({ description: "Name of the metric to increment" })
  @IsString()
  name: string;

  @ApiProperty({ description: "Value to increment by", default: 1, minimum: 1 })
  @IsNumber()
  @IsOptional()
  value?: number = 1;

  @ApiPropertyOptional({ description: "Labels/tags for the metric" })
  @IsObject()
  @IsOptional()
  labels?: Record<string, string>;
}

/**
 * DTO for setting a gauge metric
 */
export class GaugeMetricDto {
  @ApiProperty({ description: "Name of the gauge metric" })
  @IsString()
  name: string;

  @ApiProperty({ description: "Value to set for the gauge" })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ description: "Labels/tags for the metric" })
  @IsObject()
  @IsOptional()
  labels?: Record<string, string>;
}

/**
 * DTO for recording histogram values
 */
export class HistogramMetricDto {
  @ApiProperty({ description: "Name of the histogram metric" })
  @IsString()
  name: string;

  @ApiProperty({ description: "Value to record in the histogram" })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ description: "Labels/tags for the metric" })
  @IsObject()
  @IsOptional()
  labels?: Record<string, string>;
}

/**
 * DTO for exporting metrics
 */
export class ExportMetricsDto {
  @ApiProperty({ description: "Export format", enum: ExportFormat, default: ExportFormat.JSON })
  @IsEnum(ExportFormat)
  @IsOptional()
  format?: ExportFormat = ExportFormat.JSON;

  @ApiPropertyOptional({ description: "Specific metrics to export (empty for all)" })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  metrics?: string[];

  @ApiPropertyOptional({ description: "Time range start (Unix timestamp)" })
  @IsNumber()
  @IsOptional()
  startTime?: number;

  @ApiPropertyOptional({ description: "Time range end (Unix timestamp)" })
  @IsNumber()
  @IsOptional()
  endTime?: number;
}

/**
 * DTO for time window aggregation
 */
export class TimeWindowAggregationDto {
  @ApiProperty({ description: "Metric name to aggregate" })
  @IsString()
  metricName: string;

  @ApiProperty({ description: "Window size in milliseconds", minimum: 1000 })
  @IsNumber()
  windowSize: number;

  @ApiProperty({ description: "Number of data points to generate", minimum: 1, maximum: 1000 })
  @IsNumber()
  dataPoints: number;

  @ApiPropertyOptional({
    description: "Aggregation function",
    enum: ["sum", "avg", "min", "max", "count"],
  })
  @IsString()
  @IsOptional()
  aggregationFunction?: "sum" | "avg" | "min" | "max" | "count" = "avg";
}

/**
 * DTO for rolling window aggregation
 */
export class RollingWindowAggregationDto {
  @ApiProperty({ description: "Metric name to aggregate" })
  @IsString()
  metricName: string;

  @ApiProperty({ description: "Window size in number of data points", minimum: 5, maximum: 100 })
  @IsNumber()
  windowSize: number;

  @ApiProperty({ description: "Number of values to process", minimum: 10, maximum: 1000 })
  @IsNumber()
  valueCount: number;

  @ApiPropertyOptional({ description: "Update frequency in milliseconds", minimum: 100 })
  @IsNumber()
  @IsOptional()
  updateFrequency?: number = 1000;
}

/**
 * DTO for percentile calculation
 */
export class PercentileCalculationDto {
  @ApiProperty({ description: "Metric name for percentile calculation" })
  @IsString()
  metricName: string;

  @ApiProperty({ description: "Number of sample values to generate", minimum: 10, maximum: 10000 })
  @IsNumber()
  sampleSize: number;

  @ApiPropertyOptional({
    description: "Percentiles to calculate",
    type: [Number],
    example: [50, 90, 95, 99],
    default: [50, 90, 95, 99],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  percentiles?: number[] = [50, 90, 95, 99];
}

/**
 * Response DTO for metrics export
 */
export class MetricsExportResponseDto {
  @ApiProperty({ description: "Export format used" })
  format: string;

  @ApiProperty({ description: "Number of metrics exported" })
  count: number;

  @ApiProperty({ description: "Export timestamp" })
  timestamp: number;

  @ApiProperty({ description: "Exported data (format depends on export type)" })
  data: any;

  @ApiPropertyOptional({ description: "Export metadata" })
  metadata?: Record<string, any>;
}
