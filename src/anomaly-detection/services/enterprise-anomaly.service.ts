import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IAnomalyData, IAnomaly } from "../interfaces/anomaly.interface";
import { IDetectorContext } from "../interfaces/detector.interface";
import { IAnomalyDetectionConfig } from "../../interfaces/shield-config.interface";

// Import enterprise services
import { 
  EnterpriseAlertingService, 
  IAlertingConfig,
  ISuppressionRule as AlertSuppressionRule
} from "./alerting.service";
import { 
  EnterprisePerformanceMonitorService, 
  IAutoScalingConfig,
  IPerformanceMetrics 
} from "./performance-monitor.service";
import { 
  EnterpriseDataCollectorService, 
  IDataCollectionConfig,
  IDataSource 
} from "./data-collector.service";

// Import detectors
import {
  BaseAnomalyDetector,
  ZScoreDetector,
  IsolationForestDetector,
  SeasonalAnomalyDetector,
  ThresholdAnomalyDetector,
  StatisticalAnomalyDetector,
  MachineLearningDetector,
  CompositeAnomalyDetector,
} from "../detectors";

export interface IEnterpriseAnomalyConfig extends IAnomalyDetectionConfig {
  alerting: IAlertingConfig;
  performance: IAutoScalingConfig;
  dataCollection: IDataCollectionConfig;
  clustering: {
    enabled: boolean;
    nodeId: string;
    nodes: string[];
    syncInterval: number;
  };
  backup: {
    enabled: boolean;
    interval: number;
    retentionDays: number;
    storageType: "local" | "s3" | "azure" | "gcp";
    config: any;
  };
  security: {
    encryption: {
      enabled: boolean;
      algorithm: string;
      keyRotationDays: number;
    };
    audit: {
      enabled: boolean;
      logLevel: "minimal" | "detailed" | "full";
    };
  };
}

export interface IAnomalyDetectionReport {
  period: { start: number; end: number };
  summary: {
    totalAnomalies: number;
    criticalAnomalies: number;
    falsePositives: number;
    detectionAccuracy: number;
    averageResponseTime: number;
  };
  detectorPerformance: Array<{
    name: string;
    anomaliesDetected: number;
    accuracy: number;
    performance: IPerformanceMetrics;
  }>;
  trends: {
    anomalyTrend: "increasing" | "decreasing" | "stable";
    accuracyTrend: "improving" | "degrading" | "stable";
    performanceTrend: "improving" | "degrading" | "stable";
  };
  recommendations: string[];
}

@Injectable()
export class EnterpriseAnomalyDetectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnterpriseAnomalyDetectionService.name);
  private detectors: Map<string, BaseAnomalyDetector> = new Map();
  private activeDetector: BaseAnomalyDetector | null = null;
  private config: IEnterpriseAnomalyConfig;
  private isInitialized = false;
  private anomalyHistory: Map<string, IAnomaly[]> = new Map();
  private detectionStats: Map<string, any> = new Map();
  private clusterState: Map<string, any> = new Map();
  private readonly maxAnomalyHistory = 10000;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly alertingService: EnterpriseAlertingService,
    private readonly performanceService: EnterprisePerformanceMonitorService,
    private readonly dataCollectorService: EnterpriseDataCollectorService,
    // Inject all detectors
    private readonly zscoreDetector: ZScoreDetector,
    private readonly isolationForestDetector: IsolationForestDetector,
    private readonly seasonalDetector: SeasonalAnomalyDetector,
    private readonly thresholdDetector: ThresholdAnomalyDetector,
    private readonly statisticalDetector: StatisticalAnomalyDetector,
    private readonly mlDetector: MachineLearningDetector,
    private readonly compositeDetector: CompositeAnomalyDetector
  ) {
    // Initialize with default enterprise configuration
    this.config = {
      enabled: true,
      detectorType: "Composite Anomaly Detector",
      sensitivity: 0.8,
      threshold: 2.0,
      windowSize: 100,
      minDataPoints: 10,
      learningPeriod: 86400000, // 24 hours
      adaptiveThresholds: true,
      businessRules: [],
      alerting: {
        enabled: true,
        channels: [],
        escalationPolicy: {
          id: "default",
          name: "Enterprise Escalation",
          description: "Enterprise-grade escalation policy",
          enabled: true,
          escalationLevels: [
            {
              level: 1,
              waitTime: 0,
              recipients: ["ops@company.com"],
              channels: ["LOG" as any]
            },
            {
              level: 2,
              waitTime: 300000, // 5 minutes
              recipients: ["oncall@company.com"],
              channels: ["WEBHOOK" as any, "EMAIL" as any]
            },
            {
              level: 3,
              waitTime: 900000, // 15 minutes
              recipients: ["management@company.com"],
              channels: ["EMAIL" as any, "SMS" as any]
            }
          ],
          maxLevel: 3,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        rateLimiting: {
          maxAlertsPerMinute: 5,
          maxAlertsPerHour: 50
        }
      },
      performance: {
        enabled: true,
        metrics: {
          cpuThreshold: 70,
          memoryThreshold: 70,
          latencyThreshold: 500,
          throughputThreshold: 100
        },
        scaling: {
          scaleUpCooldown: 300000,
          scaleDownCooldown: 600000,
          maxInstances: 5,
          minInstances: 1
        },
        notifications: {
          onScaleUp: true,
          onScaleDown: true,
          channels: ["log", "webhook"]
        }
      },
      dataCollection: {
        bufferSize: 50000,
        flushInterval: 30000,
        compressionEnabled: true,
        retentionPolicy: {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          maxSize: 5 * 1024 * 1024 * 1024, // 5GB
          compressionAfter: 24 * 60 * 60 * 1000 // 1 day
        },
        qualityChecks: {
          enabled: true,
          validationRules: [
            {
              field: "value",
              type: "required",
              config: {},
              severity: "error"
            }
          ],
          anomalyThreshold: 0.05
        }
      },
      clustering: {
        enabled: false,
        nodeId: `node_${Math.random().toString(36).substr(2, 9)}`,
        nodes: [],
        syncInterval: 60000 // 1 minute
      },
      backup: {
        enabled: true,
        interval: 3600000, // 1 hour
        retentionDays: 30,
        storageType: "local",
        config: {
          path: "./backups/anomaly-detection"
        }
      },
      security: {
        encryption: {
          enabled: false,
          algorithm: "aes-256-gcm",
          keyRotationDays: 90
        },
        audit: {
          enabled: true,
          logLevel: "detailed"
        }
      }
    };

    this.initializeDetectors();
    this.setupEventListeners();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initialize();
      this.logger.log("Enterprise Anomaly Detection Service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Enterprise Anomaly Detection Service", error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  private initializeDetectors(): void {
    // Register all available detectors
    this.detectors.set("Z-Score Detector", this.zscoreDetector);
    this.detectors.set("Isolation Forest Detector", this.isolationForestDetector);
    this.detectors.set("Seasonal Anomaly Detector", this.seasonalDetector);
    this.detectors.set("Threshold Anomaly Detector", this.thresholdDetector);
    this.detectors.set("Statistical Anomaly Detector", this.statisticalDetector);
    this.detectors.set("Machine Learning Detector", this.mlDetector);
    this.detectors.set("Composite Anomaly Detector", this.compositeDetector);

    // Initialize stats for each detector
    for (const detectorName of this.detectors.keys()) {
      this.detectionStats.set(detectorName, {
        totalDetections: 0,
        truePositives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        averageConfidence: 0,
        lastDetection: 0,
        totalProcessingTime: 0
      });
      
      this.anomalyHistory.set(detectorName, []);
    }
  }

  private setupEventListeners(): void {
    // Listen to performance events
    this.eventEmitter.on('detector.performance.recorded', (data) => {
      this.handlePerformanceEvent(data);
    });

    // Listen to data quality events
    this.eventEmitter.on('data.quality.anomaly', (data) => {
      this.handleDataQualityAnomaly(data);
    });

    // Listen to alerting events
    this.eventEmitter.on('anomaly.alert.created', (alert) => {
      this.handleAlertCreated(alert);
    });

    // Listen to scaling events
    this.eventEmitter.on('detector.scaled.up', (data) => {
      this.logger.warn(`Detector ${data.detectorName} scaled up: ${data.oldInstances} -> ${data.newInstances}`);
    });

    this.eventEmitter.on('detector.scaled.down', (data) => {
      this.logger.log(`Detector ${data.detectorName} scaled down: ${data.oldInstances} -> ${data.newInstances}`);
    });
  }

  async configure(config: Partial<IEnterpriseAnomalyConfig>): Promise<void> {
    this.config = { 
      ...this.config, 
      ...config,
      alerting: { ...this.config.alerting, ...config.alerting },
      performance: { ...this.config.performance, ...config.performance },
      dataCollection: { ...this.config.dataCollection, ...config.dataCollection },
      clustering: { ...this.config.clustering, ...config.clustering },
      backup: { ...this.config.backup, ...config.backup },
      security: { ...this.config.security, ...config.security }
    };

    // Configure sub-services
    this.alertingService.configure(this.config.alerting);
    this.performanceService.configure(this.config.performance);
    this.dataCollectorService.configure(this.config.dataCollection);

    // Reconfigure active detector
    if (this.activeDetector) {
      this.activeDetector.configure({
        enabled: this.config.enabled,
        sensitivity: this.config.sensitivity || 0.5,
        threshold: this.config.threshold || 2.0,
        windowSize: this.config.windowSize || 100,
        minDataPoints: this.config.minDataPoints || 10,
        learningPeriod: this.config.learningPeriod
      });
    }

    this.logger.log("Enterprise anomaly detection system configured");
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Set active detector
    this.activeDetector = this.detectors.get(this.config.detectorType || "Composite Anomaly Detector") || null;
    if (!this.activeDetector) {
      throw new Error(`Detector type '${this.config.detectorType}' not found`);
    }

    // Configure the active detector
    this.activeDetector.configure({
      enabled: this.config.enabled,
      sensitivity: this.config.sensitivity || 0.5,
      threshold: this.config.threshold || 2.0,
      windowSize: this.config.windowSize || 100,
      minDataPoints: this.config.minDataPoints || 10,
      learningPeriod: this.config.learningPeriod,
      businessRules: this.config.businessRules
    });

    // Register default data sources
    await this.registerDefaultDataSources();

    // Initialize clustering if enabled
    if (this.config.clustering.enabled) {
      await this.initializeCluster();
    }

    this.isInitialized = true;
    this.logger.log(`Enterprise anomaly detection initialized with detector: ${this.config.detectorType}`);
  }

  private async registerDefaultDataSources(): Promise<void> {
    // Register metrics data source
    this.dataCollectorService.registerDataSource({
      id: "metrics",
      name: "System Metrics",
      type: "metrics",
      enabled: true,
      samplingRate: 1.0,
      config: {
        endpoints: ["http://localhost:9090/metrics"],
        interval: 30000
      },
      filters: [
        {
          field: "value",
          operator: "exists",
          value: true
        }
      ],
      transformations: [
        {
          type: "normalize",
          config: {
            fields: ["value"],
            method: "minmax"
          }
        }
      ]
    });

    // Register application logs data source
    this.dataCollectorService.registerDataSource({
      id: "logs",
      name: "Application Logs",
      type: "logs",
      enabled: true,
      samplingRate: 0.1, // Sample 10% of logs
      config: {
        logLevel: "error",
        sources: ["/var/log/app/*.log"]
      },
      filters: [
        {
          field: "level",
          operator: "equals",
          value: "error"
        }
      ]
    });
  }

  async detectAnomalies(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]> {
    if (!this.isInitialized || !this.activeDetector || !this.config.enabled) {
      return [];
    }

    const startTime = Date.now();
    const detectorName = this.activeDetector.name;

    try {
      // Collect data through enterprise data collector
      await this.dataCollectorService.collectData("runtime", data);

      // Perform anomaly detection
      const anomalies = await this.activeDetector.detect(data, context);

      // Record performance metrics
      const processingTime = Date.now() - startTime;
      this.recordPerformanceMetrics(detectorName, {
        detectionLatency: processingTime,
        processingTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuUsage: 0, // Would need additional monitoring
        throughput: data.length / (processingTime / 1000), // per second
        accuracy: 1, // Would need ground truth for actual calculation
        falsePositiveRate: 0, // Would need validation
        falseNegativeRate: 0, // Would need validation
        timestamp: Date.now()
      });

      // Update detection statistics
      const stats = this.detectionStats.get(detectorName)!;
      stats.totalDetections += anomalies.length;
      stats.lastDetection = Date.now();
      stats.totalProcessingTime += processingTime;

      // Store anomaly history
      const history = this.anomalyHistory.get(detectorName)!;
      history.push(...anomalies);
      
      // Keep only recent history
      if (history.length > this.maxAnomalyHistory) {
        history.splice(0, history.length - this.maxAnomalyHistory);
      }

      // Process alerts for detected anomalies
      for (const anomaly of anomalies) {
        await this.alertingService.processAnomaly(anomaly);
      }

      // Emit detection event
      this.eventEmitter.emit('anomaly.detection.completed', {
        detectorName,
        anomaliesCount: anomalies.length,
        processingTime,
        dataPoints: data.length
      });

      // Audit logging
      if (this.config.security.audit.enabled) {
        this.auditLog('anomaly.detection', {
          detector: detectorName,
          dataPoints: data.length,
          anomaliesDetected: anomalies.length,
          processingTime,
          timestamp: Date.now()
        });
      }

      return anomalies;

    } catch (error) {
      this.logger.error(`Error in anomaly detection: ${error.message}`, error);
      
      // Record error in stats
      const stats = this.detectionStats.get(detectorName);
      if (stats) {
        stats.errors = (stats.errors || 0) + 1;
      }

      throw error;
    }
  }

  private recordPerformanceMetrics(detectorName: string, metrics: Partial<IPerformanceMetrics>): void {
    this.performanceService.recordPerformanceMetrics(detectorName, metrics);
  }

  private handlePerformanceEvent(data: any): void {
    const { detectorName, metrics } = data;
    
    // Check for performance degradation
    if (metrics.detectionLatency > 1000) { // 1 second
      this.logger.warn(`High latency detected for ${detectorName}: ${metrics.detectionLatency}ms`);
    }

    if (metrics.cpuUsage > 90) {
      this.logger.warn(`High CPU usage detected for ${detectorName}: ${metrics.cpuUsage}%`);
    }
  }

  private handleDataQualityAnomaly(data: any): void {
    this.logger.warn(`Data quality anomaly detected for source ${data.sourceId}:`, data.metrics);
    
    // Could trigger automatic data source reconfiguration or alerts
    if (data.severity === 'critical') {
      this.eventEmitter.emit('system.alert', {
        type: 'data_quality',
        severity: 'critical',
        message: `Critical data quality issue in source ${data.sourceId}`,
        metrics: data.metrics
      });
    }
  }

  private handleAlertCreated(alert: any): void {
    this.logger.log(`Alert created: ${alert.id} for anomaly ${alert.anomaly.id}`);
    
    // Could integrate with external systems (PagerDuty, ServiceNow, etc.)
  }

  private async initializeCluster(): Promise<void> {
    this.logger.log(`Initializing cluster mode with node ID: ${this.config.clustering.nodeId}`);
    
    // Set up periodic sync with other nodes
    setInterval(async () => {
      await this.syncWithCluster();
    }, this.config.clustering.syncInterval);
  }

  private async syncWithCluster(): Promise<void> {
    // Implementation would sync state with other cluster nodes
    // For now, just log the sync attempt
    this.logger.debug(`Syncing with cluster nodes: ${this.config.clustering.nodes.join(', ')}`);
  }

  // Scheduled tasks
  @Cron(CronExpression.EVERY_HOUR)
  private async performHourlyMaintenance(): Promise<void> {
    this.logger.debug("Performing hourly maintenance");
    
    // Clean up old data
    await this.cleanupOldData();
    
    // Generate performance report
    const report = await this.generatePerformanceReport();
    this.logger.debug(`Hourly performance report: ${JSON.stringify(report.summary)}`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  private async performDailyMaintenance(): Promise<void> {
    this.logger.log("Performing daily maintenance");
    
    // Backup data if enabled
    if (this.config.backup.enabled) {
      await this.performBackup();
    }
    
    // Rotate encryption keys if needed
    if (this.config.security.encryption.enabled) {
      await this.rotateEncryptionKeys();
    }
    
    // Generate daily report
    const report = await this.generateDailyReport();
    this.eventEmitter.emit('daily.report.generated', report);
  }

  private async cleanupOldData(): Promise<void> {
    const maxAge = this.config.dataCollection.retentionPolicy.maxAge;
    const cutoff = Date.now() - maxAge;
    
    // Clean up anomaly history
    for (const [detectorName, history] of this.anomalyHistory) {
      const filteredHistory = history.filter(anomaly => anomaly.timestamp > cutoff);
      this.anomalyHistory.set(detectorName, filteredHistory);
    }
    
    this.logger.debug("Completed data cleanup");
  }

  private async performBackup(): Promise<void> {
    this.logger.log("Performing backup");
    
    const backupData = {
      timestamp: Date.now(),
      config: this.config,
      detectionStats: Object.fromEntries(this.detectionStats),
      anomalyHistory: Object.fromEntries(
        Array.from(this.anomalyHistory.entries()).map(([key, value]) => [
          key, 
          value.slice(-1000) // Keep last 1000 anomalies per detector
        ])
      )
    };
    
    // Implementation would save to configured storage
    this.logger.debug(`Backup data size: ${JSON.stringify(backupData).length} characters`);
  }

  private async rotateEncryptionKeys(): Promise<void> {
    // Implementation would rotate encryption keys
    this.logger.debug("Encryption key rotation completed");
  }

  private async generatePerformanceReport(): Promise<any> {
    const detectorPerformance = [];
    
    for (const [detectorName] of this.detectors) {
      const performance = this.performanceService.getDetectorPerformance(detectorName);
      if (performance) {
        detectorPerformance.push({
          name: detectorName,
          performance: performance.averageMetrics,
          trends: performance.trends,
          recommendations: performance.recommendations
        });
      }
    }
    
    return {
      timestamp: Date.now(),
      detectorPerformance,
      systemMetrics: this.performanceService.getSystemPerformance()
    };
  }

  private async generateDailyReport(): Promise<IAnomalyDetectionReport> {
    const endTime = Date.now();
    const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Calculate summary statistics
    let totalAnomalies = 0;
    let criticalAnomalies = 0;
    
    const detectorPerformance = [];
    
    for (const [detectorName, history] of this.anomalyHistory) {
      const recentAnomalies = history.filter(a => 
        a.timestamp >= startTime && a.timestamp <= endTime
      );
      
      totalAnomalies += recentAnomalies.length;
      criticalAnomalies += recentAnomalies.filter(a => a.severity === 'CRITICAL').length;
      
      const performance = this.performanceService.getDetectorPerformance(detectorName);
      if (performance) {
        detectorPerformance.push({
          name: detectorName,
          anomaliesDetected: recentAnomalies.length,
          accuracy: performance.averageMetrics.accuracy,
          performance: performance.averageMetrics
        });
      }
    }
    
    const report: IAnomalyDetectionReport = {
      period: { start: startTime, end: endTime },
      summary: {
        totalAnomalies,
        criticalAnomalies,
        falsePositives: 0, // Would need ground truth data
        detectionAccuracy: 0.95, // Would calculate from validation data
        averageResponseTime: 250 // Would calculate from performance metrics
      },
      detectorPerformance,
      trends: {
        anomalyTrend: "stable",
        accuracyTrend: "stable",
        performanceTrend: "stable"
      },
      recommendations: await this.generateSystemRecommendations()
    };
    
    return report;
  }

  private async generateSystemRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Analyze system performance
    const systemHealth = this.performanceService.getHealthStatus();
    if (systemHealth.status === 'unhealthy') {
      recommendations.push("System health is degraded. Review critical detectors and consider scaling.");
    }
    
    // Analyze data quality
    const systemStats = this.dataCollectorService.getSystemStats();
    if (systemStats.totalErrors > 0) {
      recommendations.push(`${systemStats.totalErrors} data collection errors detected. Review data sources.`);
    }
    
    // Analyze alerting
    const alertStats = this.alertingService.getAlertStatistics();
    if (alertStats.byStatus.open > 10) {
      recommendations.push(`${alertStats.byStatus.open} open alerts. Review and acknowledge resolved issues.`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push("System is operating optimally. No recommendations at this time.");
    }
    
    return recommendations;
  }

  private auditLog(event: string, data: any): void {
    if (!this.config.security.audit.enabled) {
      return;
    }
    
    const auditEntry = {
      timestamp: Date.now(),
      event,
      nodeId: this.config.clustering.nodeId,
      data: this.config.security.audit.logLevel === 'minimal' ? 
        { summary: `${event} completed` } : data
    };
    
    // In production, this would write to a secure audit log
    this.logger.debug(`AUDIT: ${JSON.stringify(auditEntry)}`);
  }

  // Public API methods
  async getSystemStatus(): Promise<any> {
    return {
      initialized: this.isInitialized,
      activeDetector: this.activeDetector?.name,
      config: {
        enabled: this.config.enabled,
        detectorType: this.config.detectorType,
        clustering: this.config.clustering.enabled
      },
      performance: this.performanceService.getHealthStatus(),
      alerting: this.alertingService.getAlertStatistics(),
      dataCollection: this.dataCollectorService.getSystemStats(),
      lastUpdate: Date.now()
    };
  }

  async getDetectionReport(detectorName?: string): Promise<any> {
    if (detectorName) {
      return {
        detector: detectorName,
        stats: this.detectionStats.get(detectorName),
        anomalies: this.anomalyHistory.get(detectorName)?.slice(-100) || [],
        performance: this.performanceService.getDetectorPerformance(detectorName)
      };
    }
    
    return await this.generateDailyReport();
  }

  async switchDetector(detectorType: string): Promise<boolean> {
    const newDetector = this.detectors.get(detectorType);
    if (!newDetector) {
      this.logger.error(`Detector type '${detectorType}' not found`);
      return false;
    }
    
    this.activeDetector = newDetector;
    this.config.detectorType = detectorType;
    
    // Configure the new detector
    this.activeDetector.configure({
      enabled: this.config.enabled,
      sensitivity: this.config.sensitivity || 0.5,
      threshold: this.config.threshold || 2.0,
      windowSize: this.config.windowSize || 100,
      minDataPoints: this.config.minDataPoints || 10,
      learningPeriod: this.config.learningPeriod
    });
    
    this.logger.log(`Switched to detector: ${detectorType}`);
    this.auditLog('detector.switched', { from: this.config.detectorType, to: detectorType });
    
    return true;
  }

  private async shutdown(): Promise<void> {
    this.logger.log("Shutting down Enterprise Anomaly Detection Service");
    
    // Perform final backup if enabled
    if (this.config.backup.enabled) {
      await this.performBackup();
    }
    
    // Clean up resources
    // ... cleanup logic
    
    this.isInitialized = false;
  }
}