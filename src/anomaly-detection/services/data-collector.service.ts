import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IAnomalyData } from "../interfaces/anomaly.interface";

export interface IDataSource {
  id: string;
  name: string;
  type: "metrics" | "logs" | "traces" | "custom";
  config: any;
  enabled: boolean;
  samplingRate?: number; // 0-1, percentage of data to collect
  filters?: IDataFilter[];
  transformations?: IDataTransformation[];
}

export interface IDataFilter {
  field: string;
  operator: "equals" | "contains" | "regex" | "range" | "exists";
  value: any;
  negate?: boolean;
}

export interface IDataTransformation {
  type: "normalize" | "aggregate" | "derive" | "enrich";
  config: any;
}

export interface IDataQualityMetrics {
  completeness: number; // Percentage of non-null values
  accuracy: number; // Estimated accuracy based on validation rules
  consistency: number; // Consistency across time periods
  timeliness: number; // How recent the data is
  validity: number; // Percentage of values that pass validation
  uniqueness: number; // Percentage of unique values where expected
  timestamp: number;
}

export interface IDataCollectionConfig {
  bufferSize: number; // Max items in memory buffer
  flushInterval: number; // How often to flush buffer (ms)
  compressionEnabled: boolean; // Enable data compression
  retentionPolicy: {
    maxAge: number; // Max age in ms
    maxSize: number; // Max storage size in bytes
    compressionAfter: number; // Compress data older than this (ms)
  };
  qualityChecks: {
    enabled: boolean;
    validationRules: IValidationRule[];
    anomalyThreshold: number; // Threshold for data quality anomalies
  };
}

export interface IValidationRule {
  field: string;
  type: "required" | "range" | "regex" | "custom";
  config: any;
  severity: "warning" | "error";
}

export interface IDataBatch {
  id: string;
  sourceId: string;
  data: IAnomalyData[];
  qualityMetrics: IDataQualityMetrics;
  timestamp: number;
  size: number;
}

@Injectable()
export class DataCollectorService {
  private readonly logger = new Logger(DataCollectorService.name);
  private dataSources: Map<string, IDataSource> = new Map();
  private dataBuffer: Map<string, IAnomalyData[]> = new Map();
  private qualityMetrics: Map<string, IDataQualityMetrics[]> = new Map();
  private config: IDataCollectionConfig;
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private collectionStats: Map<string, any> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.config = {
      bufferSize: 10000,
      flushInterval: 30000, // 30 seconds
      compressionEnabled: true,
      retentionPolicy: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxSize: 1024 * 1024 * 1024, // 1GB
        compressionAfter: 24 * 60 * 60 * 1000, // 1 day
      },
      qualityChecks: {
        enabled: true,
        validationRules: [
          {
            field: "value",
            type: "required",
            config: {},
            severity: "error",
          },
          {
            field: "timestamp",
            type: "range",
            config: { min: Date.now() - 86400000, max: Date.now() + 3600000 }, // 1 day ago to 1 hour future
            severity: "warning",
          },
        ],
        anomalyThreshold: 0.1, // 10% threshold for quality issues
      },
    };
  }

  configure(config: Partial<IDataCollectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      retentionPolicy: { ...this.config.retentionPolicy, ...config.retentionPolicy },
      qualityChecks: { ...this.config.qualityChecks, ...config.qualityChecks },
    };
    this.logger.log("Data collector configured");
  }

  registerDataSource(source: IDataSource): void {
    this.dataSources.set(source.id, source);
    this.dataBuffer.set(source.id, []);
    this.qualityMetrics.set(source.id, []);
    this.collectionStats.set(source.id, {
      totalCollected: 0,
      totalFiltered: 0,
      totalTransformed: 0,
      totalErrors: 0,
      lastCollection: 0,
      averageLatency: 0,
    });

    // Start flush timer for this source
    this.startFlushTimer(source.id);

    this.logger.log(`Registered data source: ${source.name} (${source.id})`);
  }

  async collectData(sourceId: string, rawData: any[]): Promise<number> {
    const source = this.dataSources.get(sourceId);
    if (!source || !source.enabled) {
      return 0;
    }

    const startTime = Date.now();
    let processedCount = 0;
    const stats = this.collectionStats.get(sourceId)!;

    try {
      // Apply sampling if configured
      const sampledData = this.applySampling(rawData, source.samplingRate || 1.0);

      // Apply filters
      const filteredData = this.applyFilters(sampledData, source.filters || []);
      stats.totalFiltered += rawData.length - filteredData.length;

      // Transform data
      const transformedData = await this.applyTransformations(
        filteredData,
        source.transformations || [],
      );
      stats.totalTransformed += transformedData.length;

      // Convert to IAnomalyData format
      const anomalyData = this.convertToAnomalyData(sourceId, transformedData);

      // Validate data quality
      const qualityMetrics = this.validateDataQuality(sourceId, anomalyData);

      // Add to buffer
      const buffer = this.dataBuffer.get(sourceId)!;
      buffer.push(...anomalyData);
      processedCount = anomalyData.length;

      // Check buffer size and flush if needed
      if (buffer.length >= this.config.bufferSize) {
        await this.flushBuffer(sourceId);
      }

      // Update statistics
      stats.totalCollected += processedCount;
      stats.lastCollection = Date.now();
      stats.averageLatency =
        (stats.averageLatency * (stats.totalCollected - processedCount) +
          (Date.now() - startTime)) /
        stats.totalCollected;

      // Emit collection event
      this.eventEmitter.emit("data.collected", {
        sourceId,
        count: processedCount,
        qualityMetrics,
        latency: Date.now() - startTime,
      });
    } catch (error) {
      stats.totalErrors++;
      this.logger.error(`Error collecting data from source ${sourceId}: ${error.message}`, error);
      throw error;
    }

    return processedCount;
  }

  private applySampling(data: any[], samplingRate: number): any[] {
    if (samplingRate >= 1.0) {
      return data;
    }

    return data.filter(() => Math.random() < samplingRate);
  }

  private applyFilters(data: any[], filters: IDataFilter[]): any[] {
    if (filters.length === 0) {
      return data;
    }

    return data.filter((item) => {
      return filters.every((filter) => {
        const value = this.getNestedValue(item, filter.field);
        const matches = this.evaluateFilter(value, filter);
        return filter.negate ? !matches : matches;
      });
    });
  }

  private evaluateFilter(value: any, filter: IDataFilter): boolean {
    switch (filter.operator) {
      case "equals":
        return value === filter.value;

      case "contains":
        return typeof value === "string" && value.includes(filter.value);

      case "regex":
        return typeof value === "string" && new RegExp(filter.value).test(value);

      case "range":
        return value >= filter.value.min && value <= filter.value.max;

      case "exists":
        return value !== null && value !== undefined;

      default:
        return true;
    }
  }

  private async applyTransformations(
    data: any[],
    transformations: IDataTransformation[],
  ): Promise<any[]> {
    let result = data;

    for (const transformation of transformations) {
      try {
        switch (transformation.type) {
          case "normalize":
            result = this.normalizeData(result, transformation.config);
            break;

          case "aggregate":
            result = this.aggregateData(result, transformation.config);
            break;

          case "derive":
            result = this.deriveFields(result, transformation.config);
            break;

          case "enrich":
            result = await this.enrichData(result, transformation.config);
            break;
        }
      } catch (error) {
        this.logger.error(`Error applying transformation ${transformation.type}: ${error.message}`);
      }
    }

    return result;
  }

  private normalizeData(data: any[], config: any): any[] {
    const { fields, method = "minmax" } = config;

    if (!fields || fields.length === 0) {
      return data;
    }

    // Calculate normalization parameters
    const stats = this.calculateFieldStats(data, fields);

    return data.map((item) => {
      const normalized = { ...item };

      for (const field of fields) {
        const value = this.getNestedValue(item, field);
        if (typeof value === "number") {
          const fieldStats = stats[field];

          switch (method) {
            case "minmax":
              normalized[field] = (value - fieldStats.min) / (fieldStats.max - fieldStats.min);
              break;
            case "zscore":
              normalized[field] = (value - fieldStats.mean) / fieldStats.stdDev;
              break;
          }
        }
      }

      return normalized;
    });
  }

  private aggregateData(data: any[], config: any): any[] {
    const { groupBy, aggregations, timeWindow } = config;

    if (!groupBy || !aggregations) {
      return data;
    }

    const groups = new Map();

    for (const item of data) {
      const groupKey = groupBy.map((field: string) => this.getNestedValue(item, field)).join("|");

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey).push(item);
    }

    const result: any[] = [];

    for (const [groupKey, groupData] of groups) {
      const aggregated: any = {};

      // Copy group by fields
      const firstItem = groupData[0];
      for (const field of groupBy) {
        aggregated[field] = this.getNestedValue(firstItem, field);
      }

      // Apply aggregations
      for (const [field, aggType] of Object.entries(aggregations)) {
        const values = groupData
          .map((item: any) => this.getNestedValue(item, field))
          .filter((v: any) => typeof v === "number");

        switch (aggType) {
          case "sum":
            aggregated[`${field}_sum`] = values.reduce((a: number, b: number) => a + b, 0);
            break;
          case "avg":
            aggregated[`${field}_avg`] =
              values.reduce((a: number, b: number) => a + b, 0) / values.length;
            break;
          case "count":
            aggregated[`${field}_count`] = values.length;
            break;
          case "min":
            aggregated[`${field}_min`] = Math.min(...values);
            break;
          case "max":
            aggregated[`${field}_max`] = Math.max(...values);
            break;
        }
      }

      result.push(aggregated);
    }

    return result;
  }

  private deriveFields(data: any[], config: any): any[] {
    const { derivations } = config;

    return data.map((item) => {
      const enhanced = { ...item };

      for (const [newField, expression] of Object.entries(derivations)) {
        try {
          enhanced[newField] = this.evaluateExpression(expression as string, item);
        } catch (error) {
          this.logger.warn(`Error deriving field ${newField}: ${error.message}`);
        }
      }

      return enhanced;
    });
  }

  private async enrichData(data: any[], config: any): Promise<any[]> {
    // This would typically fetch additional data from external sources
    // For now, just add some basic enrichment
    const { enrichments } = config;

    return data.map((item) => {
      const enriched = { ...item };

      // Add timestamp if not present
      if (!enriched.timestamp) {
        enriched.timestamp = Date.now();
      }

      // Add data source metadata
      enriched._metadata = {
        enrichedAt: Date.now(),
        version: "1.0.0",
      };

      return enriched;
    });
  }

  private convertToAnomalyData(sourceId: string, data: any[]): IAnomalyData[] {
    return data.map((item) => ({
      metricName: item.metricName || item.metric || `${sourceId}_metric`,
      value: typeof item.value === "number" ? item.value : 0,
      timestamp: item.timestamp || Date.now(),
      type: item.type || "gauge",
      labels: item.labels || {},
      metadata: {
        sourceId,
        originalData: item,
        ...item.metadata,
      },
    }));
  }

  private validateDataQuality(sourceId: string, data: IAnomalyData[]): IDataQualityMetrics {
    const rules = this.config.qualityChecks.validationRules;
    let validCount = 0;
    let totalChecks = 0;

    const qualityChecks = {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      timeliness: 0,
      validity: 0,
      uniqueness: 0,
    };

    for (const item of data) {
      for (const rule of rules) {
        totalChecks++;
        const value = this.getNestedValue(item, rule.field);
        const isValid = this.validateField(value, rule);

        if (isValid) {
          validCount++;
        }
      }

      // Check completeness (non-null values)
      const fields = ["metricName", "value", "timestamp"];
      const completeFields = fields.filter(
        (field) =>
          this.getNestedValue(item, field) !== null &&
          this.getNestedValue(item, field) !== undefined,
      );
      qualityChecks.completeness += completeFields.length / fields.length;

      // Check timeliness (data recency)
      const age = Date.now() - item.timestamp;
      const maxAge = 60 * 60 * 1000; // 1 hour
      qualityChecks.timeliness += Math.max(0, 1 - age / maxAge);
    }

    // Calculate averages
    const count = data.length || 1;
    qualityChecks.completeness /= count;
    qualityChecks.timeliness /= count;
    qualityChecks.validity = totalChecks > 0 ? validCount / totalChecks : 1;
    qualityChecks.accuracy = qualityChecks.validity; // Simplified
    qualityChecks.consistency = this.calculateConsistency(data);
    qualityChecks.uniqueness = this.calculateUniqueness(data);

    const metrics: IDataQualityMetrics = {
      ...qualityChecks,
      timestamp: Date.now(),
    };

    // Store quality metrics
    const history = this.qualityMetrics.get(sourceId)!;
    history.push(metrics);

    // Keep only recent metrics
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    // Check for quality anomalies
    if (metrics.validity < 1 - this.config.qualityChecks.anomalyThreshold) {
      this.eventEmitter.emit("data.quality.anomaly", {
        sourceId,
        metrics,
        severity: metrics.validity < 0.5 ? "critical" : "warning",
      });
    }

    return metrics;
  }

  private validateField(value: any, rule: IValidationRule): boolean {
    switch (rule.type) {
      case "required":
        return value !== null && value !== undefined && value !== "";

      case "range":
        return typeof value === "number" && value >= rule.config.min && value <= rule.config.max;

      case "regex":
        return typeof value === "string" && new RegExp(rule.config.pattern).test(value);

      case "custom":
        // Would implement custom validation logic
        return true;

      default:
        return true;
    }
  }

  private calculateConsistency(data: IAnomalyData[]): number {
    if (data.length < 2) return 1;

    // Check consistency of data types and ranges
    const metricNames = new Set(data.map((d) => d.metricName));
    const typeConsistency = metricNames.size === 1 ? 1 : 0.5;

    // Check value range consistency
    const values = data.map((d) => d.value).filter((v) => typeof v === "number");
    if (values.length === 0) return typeConsistency;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length,
    );
    const outliers = values.filter((v) => Math.abs(v - mean) > 3 * stdDev);
    const rangeConsistency = 1 - outliers.length / values.length;

    return (typeConsistency + rangeConsistency) / 2;
  }

  private calculateUniqueness(data: IAnomalyData[]): number {
    const timestamps = data.map((d) => d.timestamp);
    const uniqueTimestamps = new Set(timestamps);
    return uniqueTimestamps.size / timestamps.length;
  }

  private async flushBuffer(sourceId: string): Promise<void> {
    const buffer = this.dataBuffer.get(sourceId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const source = this.dataSources.get(sourceId);
    if (!source) return;

    const batchId = `${sourceId}_${Date.now()}`;
    const qualityMetrics = this.getLatestQualityMetrics(sourceId);

    const batch: IDataBatch = {
      id: batchId,
      sourceId,
      data: [...buffer],
      qualityMetrics,
      timestamp: Date.now(),
      size: JSON.stringify(buffer).length,
    };

    // Clear buffer
    buffer.length = 0;

    // Emit batch ready event
    this.eventEmitter.emit("data.batch.ready", batch);

    this.logger.debug(`Flushed buffer for source ${sourceId}: ${batch.data.length} items`);
  }

  private startFlushTimer(sourceId: string): void {
    const timer = setInterval(async () => {
      await this.flushBuffer(sourceId);
    }, this.config.flushInterval);

    this.flushTimers.set(sourceId, timer);
  }

  private getLatestQualityMetrics(sourceId: string): IDataQualityMetrics {
    const history = this.qualityMetrics.get(sourceId);
    if (!history || history.length === 0) {
      return {
        completeness: 1,
        accuracy: 1,
        consistency: 1,
        timeliness: 1,
        validity: 1,
        uniqueness: 1,
        timestamp: Date.now(),
      };
    }

    return history[history.length - 1];
  }

  // Utility methods
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private calculateFieldStats(data: any[], fields: string[]): any {
    const stats: any = {};

    for (const field of fields) {
      const values = data
        .map((item) => this.getNestedValue(item, field))
        .filter((v) => typeof v === "number");

      if (values.length === 0) continue;

      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const variance =
        values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;

      stats[field] = {
        min: Math.min(...values),
        max: Math.max(...values),
        mean,
        stdDev: Math.sqrt(variance),
        count: values.length,
      };
    }

    return stats;
  }

  private evaluateExpression(expression: string, context: any): any {
    // Simple expression evaluator - in production use a proper expression library
    try {
      // Replace variables with actual values
      let evaluableExpression = expression;
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, "g");
        evaluableExpression = evaluableExpression.replace(regex, JSON.stringify(value));
      }

      return Function(`"use strict"; return (${evaluableExpression})`)();
    } catch (error) {
      this.logger.error(`Error evaluating expression: ${expression}`, error);
      return null;
    }
  }

  // Public API methods
  getDataSourceStats(sourceId: string): any {
    return this.collectionStats.get(sourceId);
  }

  getQualityMetrics(sourceId: string): IDataQualityMetrics[] {
    return this.qualityMetrics.get(sourceId) || [];
  }

  getAllDataSources(): IDataSource[] {
    return Array.from(this.dataSources.values());
  }

  removeDataSource(sourceId: string): boolean {
    const timer = this.flushTimers.get(sourceId);
    if (timer) {
      clearInterval(timer);
      this.flushTimers.delete(sourceId);
    }

    this.dataSources.delete(sourceId);
    this.dataBuffer.delete(sourceId);
    this.qualityMetrics.delete(sourceId);
    this.collectionStats.delete(sourceId);

    this.logger.log(`Removed data source: ${sourceId}`);
    return true;
  }

  getSystemStats(): any {
    const sources = Array.from(this.dataSources.values());
    const totalStats = Array.from(this.collectionStats.values());

    return {
      totalSources: sources.length,
      enabledSources: sources.filter((s) => s.enabled).length,
      totalCollected: totalStats.reduce((sum, stats) => sum + stats.totalCollected, 0),
      totalErrors: totalStats.reduce((sum, stats) => sum + stats.totalErrors, 0),
      averageLatency:
        totalStats.reduce((sum, stats) => sum + stats.averageLatency, 0) / totalStats.length,
      bufferSizes: Object.fromEntries(
        Array.from(this.dataBuffer.entries()).map(([id, buffer]) => [id, buffer.length]),
      ),
    };
  }
}
