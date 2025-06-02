import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IAnomaly } from "../interfaces/anomaly.interface";

export interface IPerformanceMetrics {
  detectionLatency: number; // Time to detect anomaly (ms)
  processingTime: number;   // Time to process data (ms)
  memoryUsage: number;      // Memory usage (MB)
  cpuUsage: number;         // CPU usage (%)
  throughput: number;       // Data points processed per second
  accuracy: number;         // Detection accuracy (0-1)
  falsePositiveRate: number; // False positive rate (0-1)
  falseNegativeRate: number; // False negative rate (0-1)
  timestamp: number;
}

export interface IAutoScalingConfig {
  enabled: boolean;
  metrics: {
    cpuThreshold: number;        // CPU usage threshold (%)
    memoryThreshold: number;     // Memory usage threshold (%)
    latencyThreshold: number;    // Max latency threshold (ms)
    throughputThreshold: number; // Min throughput threshold (per second)
  };
  scaling: {
    scaleUpCooldown: number;     // Cooldown before scaling up (ms)
    scaleDownCooldown: number;   // Cooldown before scaling down (ms)
    maxInstances: number;        // Maximum detector instances
    minInstances: number;        // Minimum detector instances
  };
  notifications: {
    onScaleUp: boolean;
    onScaleDown: boolean;
    channels: string[];
  };
}

export interface IDetectorPerformance {
  detectorName: string;
  metrics: IPerformanceMetrics[];
  averageMetrics: IPerformanceMetrics;
  trends: {
    latencyTrend: "improving" | "degrading" | "stable";
    accuracyTrend: "improving" | "degrading" | "stable";
    throughputTrend: "improving" | "degrading" | "stable";
  };
  recommendations: string[];
}

@Injectable()
export class EnterprisePerformanceMonitorService {
  private readonly logger = new Logger(EnterprisePerformanceMonitorService.name);
  private performanceHistory: Map<string, IPerformanceMetrics[]> = new Map();
  private detectorInstances: Map<string, number> = new Map();
  private lastScalingAction: Map<string, number> = new Map();
  private config: IAutoScalingConfig;
  private readonly maxHistorySize = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.config = {
      enabled: true,
      metrics: {
        cpuThreshold: 80,
        memoryThreshold: 80,
        latencyThreshold: 1000,
        throughputThreshold: 10
      },
      scaling: {
        scaleUpCooldown: 300000,   // 5 minutes
        scaleDownCooldown: 600000, // 10 minutes
        maxInstances: 10,
        minInstances: 1
      },
      notifications: {
        onScaleUp: true,
        onScaleDown: true,
        channels: ["log", "webhook"]
      }
    };
  }

  configure(config: Partial<IAutoScalingConfig>): void {
    this.config = { 
      ...this.config, 
      ...config,
      metrics: { ...this.config.metrics, ...config.metrics },
      scaling: { ...this.config.scaling, ...config.scaling },
      notifications: { ...this.config.notifications, ...config.notifications }
    };
    this.logger.log("Performance monitoring configured");
  }

  recordPerformanceMetrics(detectorName: string, metrics: Partial<IPerformanceMetrics>): void {
    const fullMetrics: IPerformanceMetrics = {
      detectionLatency: 0,
      processingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      throughput: 0,
      accuracy: 1,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
      timestamp: Date.now(),
      ...metrics
    };

    if (!this.performanceHistory.has(detectorName)) {
      this.performanceHistory.set(detectorName, []);
    }

    const history = this.performanceHistory.get(detectorName)!;
    history.push(fullMetrics);

    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }

    // Check if auto-scaling is needed
    if (this.config.enabled) {
      this.evaluateAutoScaling(detectorName, fullMetrics);
    }

    // Emit performance event
    this.eventEmitter.emit('detector.performance.recorded', {
      detectorName,
      metrics: fullMetrics
    });
  }

  private evaluateAutoScaling(detectorName: string, metrics: IPerformanceMetrics): void {
    const currentInstances = this.detectorInstances.get(detectorName) || 1;
    const lastScaling = this.lastScalingAction.get(detectorName) || 0;
    const now = Date.now();

    // Check if we need to scale up
    if (this.shouldScaleUp(metrics, currentInstances)) {
      const canScaleUp = now - lastScaling > this.config.scaling.scaleUpCooldown;
      if (canScaleUp && currentInstances < this.config.scaling.maxInstances) {
        this.scaleUp(detectorName, currentInstances);
      }
    }
    // Check if we need to scale down
    else if (this.shouldScaleDown(detectorName, currentInstances)) {
      const canScaleDown = now - lastScaling > this.config.scaling.scaleDownCooldown;
      if (canScaleDown && currentInstances > this.config.scaling.minInstances) {
        this.scaleDown(detectorName, currentInstances);
      }
    }
  }

  private shouldScaleUp(metrics: IPerformanceMetrics, currentInstances: number): boolean {
    return (
      metrics.cpuUsage > this.config.metrics.cpuThreshold ||
      metrics.memoryUsage > this.config.metrics.memoryThreshold ||
      metrics.detectionLatency > this.config.metrics.latencyThreshold ||
      metrics.throughput < this.config.metrics.throughputThreshold
    );
  }

  private shouldScaleDown(detectorName: string, currentInstances: number): boolean {
    if (currentInstances <= this.config.scaling.minInstances) {
      return false;
    }

    // Check recent metrics to ensure consistent low resource usage
    const history = this.performanceHistory.get(detectorName) || [];
    const recentMetrics = history.slice(-10); // Last 10 metrics

    if (recentMetrics.length < 5) {
      return false; // Not enough data
    }

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.detectionLatency, 0) / recentMetrics.length;
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length;

    return (
      avgCpu < this.config.metrics.cpuThreshold * 0.5 &&
      avgMemory < this.config.metrics.memoryThreshold * 0.5 &&
      avgLatency < this.config.metrics.latencyThreshold * 0.5 &&
      avgThroughput > this.config.metrics.throughputThreshold * 1.5
    );
  }

  private scaleUp(detectorName: string, currentInstances: number): void {
    const newInstances = Math.min(currentInstances + 1, this.config.scaling.maxInstances);
    this.detectorInstances.set(detectorName, newInstances);
    this.lastScalingAction.set(detectorName, Date.now());

    this.logger.warn(`Scaling UP detector ${detectorName}: ${currentInstances} -> ${newInstances} instances`);

    if (this.config.notifications.onScaleUp) {
      this.eventEmitter.emit('detector.scaled.up', {
        detectorName,
        oldInstances: currentInstances,
        newInstances,
        reason: "High resource usage or poor performance"
      });
    }
  }

  private scaleDown(detectorName: string, currentInstances: number): void {
    const newInstances = Math.max(currentInstances - 1, this.config.scaling.minInstances);
    this.detectorInstances.set(detectorName, newInstances);
    this.lastScalingAction.set(detectorName, Date.now());

    this.logger.log(`Scaling DOWN detector ${detectorName}: ${currentInstances} -> ${newInstances} instances`);

    if (this.config.notifications.onScaleDown) {
      this.eventEmitter.emit('detector.scaled.down', {
        detectorName,
        oldInstances: currentInstances,
        newInstances,
        reason: "Low resource usage and good performance"
      });
    }
  }

  getDetectorPerformance(detectorName: string): IDetectorPerformance | null {
    const history = this.performanceHistory.get(detectorName);
    if (!history || history.length === 0) {
      return null;
    }

    const averageMetrics = this.calculateAverageMetrics(history);
    const trends = this.calculateTrends(history);
    const recommendations = this.generateRecommendations(detectorName, history);

    return {
      detectorName,
      metrics: history.slice(-50), // Return last 50 metrics
      averageMetrics,
      trends,
      recommendations
    };
  }

  private calculateAverageMetrics(history: IPerformanceMetrics[]): IPerformanceMetrics {
    const count = history.length;
    
    return {
      detectionLatency: history.reduce((sum, m) => sum + m.detectionLatency, 0) / count,
      processingTime: history.reduce((sum, m) => sum + m.processingTime, 0) / count,
      memoryUsage: history.reduce((sum, m) => sum + m.memoryUsage, 0) / count,
      cpuUsage: history.reduce((sum, m) => sum + m.cpuUsage, 0) / count,
      throughput: history.reduce((sum, m) => sum + m.throughput, 0) / count,
      accuracy: history.reduce((sum, m) => sum + m.accuracy, 0) / count,
      falsePositiveRate: history.reduce((sum, m) => sum + m.falsePositiveRate, 0) / count,
      falseNegativeRate: history.reduce((sum, m) => sum + m.falseNegativeRate, 0) / count,
      timestamp: Date.now()
    };
  }

  private calculateTrends(history: IPerformanceMetrics[]): any {
    if (history.length < 10) {
      return {
        latencyTrend: "stable",
        accuracyTrend: "stable",
        throughputTrend: "stable"
      };
    }

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);

    const recentAvgLatency = recent.reduce((sum, m) => sum + m.detectionLatency, 0) / recent.length;
    const olderAvgLatency = older.reduce((sum, m) => sum + m.detectionLatency, 0) / older.length;

    const recentAvgAccuracy = recent.reduce((sum, m) => sum + m.accuracy, 0) / recent.length;
    const olderAvgAccuracy = older.reduce((sum, m) => sum + m.accuracy, 0) / older.length;

    const recentAvgThroughput = recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length;
    const olderAvgThroughput = older.reduce((sum, m) => sum + m.throughput, 0) / older.length;

    return {
      latencyTrend: this.getTrend(recentAvgLatency, olderAvgLatency, true), // Lower is better
      accuracyTrend: this.getTrend(recentAvgAccuracy, olderAvgAccuracy, false), // Higher is better
      throughputTrend: this.getTrend(recentAvgThroughput, olderAvgThroughput, false) // Higher is better
    };
  }

  private getTrend(recent: number, older: number, lowerIsBetter: boolean): "improving" | "degrading" | "stable" {
    const threshold = 0.05; // 5% change threshold
    const percentChange = (recent - older) / older;

    if (Math.abs(percentChange) < threshold) {
      return "stable";
    }

    if (lowerIsBetter) {
      return percentChange < 0 ? "improving" : "degrading";
    } else {
      return percentChange > 0 ? "improving" : "degrading";
    }
  }

  private generateRecommendations(detectorName: string, history: IPerformanceMetrics[]): string[] {
    const recommendations: string[] = [];
    const recent = history.slice(-10);
    
    if (recent.length === 0) {
      return recommendations;
    }

    const avgLatency = recent.reduce((sum, m) => sum + m.detectionLatency, 0) / recent.length;
    const avgAccuracy = recent.reduce((sum, m) => sum + m.accuracy, 0) / recent.length;
    const avgCpu = recent.reduce((sum, m) => sum + m.cpuUsage, 0) / recent.length;
    const avgMemory = recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;
    const avgFalsePositive = recent.reduce((sum, m) => sum + m.falsePositiveRate, 0) / recent.length;

    // Performance recommendations
    if (avgLatency > this.config.metrics.latencyThreshold) {
      recommendations.push("High detection latency detected. Consider optimizing algorithms or increasing instances.");
    }

    if (avgCpu > this.config.metrics.cpuThreshold) {
      recommendations.push("High CPU usage detected. Consider scaling up or optimizing processing logic.");
    }

    if (avgMemory > this.config.metrics.memoryThreshold) {
      recommendations.push("High memory usage detected. Consider optimizing data structures or implementing data retention policies.");
    }

    // Accuracy recommendations
    if (avgAccuracy < 0.85) {
      recommendations.push("Low detection accuracy. Consider retraining models with more recent data.");
    }

    if (avgFalsePositive > 0.1) {
      recommendations.push("High false positive rate. Consider adjusting sensitivity or improving feature selection.");
    }

    // Operational recommendations
    const instances = this.detectorInstances.get(detectorName) || 1;
    if (instances === this.config.scaling.maxInstances) {
      recommendations.push("Maximum instances reached. Consider optimizing algorithms or increasing resource limits.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Detector performance is optimal. No recommendations at this time.");
    }

    return recommendations;
  }

  // System-wide performance overview
  getSystemPerformance(): any {
    const allDetectors = Array.from(this.performanceHistory.keys());
    const systemMetrics = {
      totalDetectors: allDetectors.length,
      totalInstances: Array.from(this.detectorInstances.values()).reduce((sum, count) => sum + count, 0),
      averageMetrics: this.calculateSystemAverageMetrics(),
      detectorStatus: allDetectors.map(name => ({
        name,
        instances: this.detectorInstances.get(name) || 1,
        status: this.getDetectorStatus(name)
      })),
      recommendations: this.getSystemRecommendations()
    };

    return systemMetrics;
  }

  private calculateSystemAverageMetrics(): IPerformanceMetrics {
    const allMetrics: IPerformanceMetrics[] = [];
    
    for (const history of this.performanceHistory.values()) {
      allMetrics.push(...history.slice(-10)); // Last 10 from each detector
    }

    if (allMetrics.length === 0) {
      return {
        detectionLatency: 0,
        processingTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        throughput: 0,
        accuracy: 1,
        falsePositiveRate: 0,
        falseNegativeRate: 0,
        timestamp: Date.now()
      };
    }

    return this.calculateAverageMetrics(allMetrics);
  }

  private getDetectorStatus(detectorName: string): "healthy" | "degraded" | "critical" {
    const performance = this.getDetectorPerformance(detectorName);
    if (!performance) {
      return "critical";
    }

    const { averageMetrics } = performance;
    
    // Critical conditions
    if (
      averageMetrics.detectionLatency > this.config.metrics.latencyThreshold * 2 ||
      averageMetrics.cpuUsage > 95 ||
      averageMetrics.memoryUsage > 95 ||
      averageMetrics.accuracy < 0.7
    ) {
      return "critical";
    }

    // Degraded conditions
    if (
      averageMetrics.detectionLatency > this.config.metrics.latencyThreshold ||
      averageMetrics.cpuUsage > this.config.metrics.cpuThreshold ||
      averageMetrics.memoryUsage > this.config.metrics.memoryThreshold ||
      averageMetrics.accuracy < 0.85
    ) {
      return "degraded";
    }

    return "healthy";
  }

  private getSystemRecommendations(): string[] {
    const recommendations: string[] = [];
    const systemMetrics = this.calculateSystemAverageMetrics();
    const totalInstances = Array.from(this.detectorInstances.values()).reduce((sum, count) => sum + count, 0);

    if (systemMetrics.cpuUsage > 80) {
      recommendations.push("System-wide high CPU usage. Consider horizontal scaling or resource optimization.");
    }

    if (systemMetrics.memoryUsage > 80) {
      recommendations.push("System-wide high memory usage. Consider implementing data cleanup policies.");
    }

    if (systemMetrics.accuracy < 0.85) {
      recommendations.push("System-wide accuracy degradation. Consider retraining models or updating algorithms.");
    }

    if (totalInstances >= this.config.scaling.maxInstances * 0.8) {
      recommendations.push("Approaching maximum capacity. Consider increasing resource limits or optimizing algorithms.");
    }

    return recommendations;
  }

  // Health check endpoint
  getHealthStatus(): any {
    const systemMetrics = this.calculateSystemAverageMetrics();
    const criticalDetectors = Array.from(this.performanceHistory.keys())
      .filter(name => this.getDetectorStatus(name) === "critical");

    return {
      status: criticalDetectors.length === 0 ? "healthy" : "unhealthy",
      timestamp: Date.now(),
      systemMetrics,
      criticalDetectors,
      totalDetectors: this.performanceHistory.size,
      totalInstances: Array.from(this.detectorInstances.values()).reduce((sum, count) => sum + count, 0)
    };
  }
}