# Anomaly Detection: Practical Examples

## Table of Contents

1. [API Performance Monitoring](#api-performance)
2. [Database Connection Pool Monitoring](#database-monitoring)
3. [E-commerce Fraud Detection](#fraud-detection)
4. [Infrastructure Health Monitoring](#infrastructure-monitoring)
5. [IoT Sensor Monitoring](#iot-monitoring)
6. [Security Threat Detection](#security-detection)
7. [Business Metrics Monitoring](#business-metrics)
8. [Custom Implementations](#custom-implementations)

## 1. API Performance Monitoring {#api-performance}

### Scenario
Monitor API endpoints for performance anomalies including response time spikes, error rate increases, and unusual traffic patterns.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { 
  EnterpriseAnomalyDetectionService,
  IAnomalyData 
} from '@usex/nest-shield';

@Injectable()
export class ApiMonitoringService {
  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureAnomalyDetection();
  }

  private async configureAnomalyDetection() {
    await this.anomalyService.configure({
      enabled: true,
      detectorType: "Composite Anomaly Detector",
      sensitivity: 0.8,
      windowSize: 300, // 5 minutes
      businessRules: [
        {
          name: "Ignore health checks",
          condition: "metric === 'response_time' && endpoint === '/health'",
          action: "suppress",
          reason: "Health check endpoints have different patterns"
        },
        {
          name: "Critical endpoint escalation",
          condition: "endpoint.includes('/payment') && severity === 'HIGH'",
          action: "escalate",
          reason: "Payment endpoints are business critical"
        }
      ],
      alerting: {
        enabled: true,
        channels: [
          {
            type: "SLACK",
            enabled: true,
            config: {
              webhook: process.env.SLACK_WEBHOOK,
              channel: "#api-alerts",
              template: `
🚨 API Performance Anomaly Detected
Endpoint: {{endpoint}}
Metric: {{metric}}
Current: {{value}}
Expected: {{expected}}
Severity: {{severity}}
              `
            }
          }
        ]
      }
    });
  }

  async monitorEndpoint(
    endpoint: string,
    responseTime: number,
    errorRate: number,
    requestRate: number
  ) {
    const timestamp = Date.now();
    const metrics: IAnomalyData[] = [
      {
        metricName: 'response_time',
        value: responseTime,
        timestamp,
        labels: { endpoint, service: 'api' },
        metadata: { unit: 'ms' }
      },
      {
        metricName: 'error_rate',
        value: errorRate,
        timestamp,
        labels: { endpoint, service: 'api' },
        metadata: { unit: 'percentage' }
      },
      {
        metricName: 'request_rate',
        value: requestRate,
        timestamp,
        labels: { endpoint, service: 'api' },
        metadata: { unit: 'requests_per_second' }
      }
    ];

    const anomalies = await this.anomalyService.detectAnomalies(metrics, {
      endpoint,
      isBusinessHours: this.isBusinessHours(),
      dayOfWeek: new Date().getDay()
    });

    // Handle detected anomalies
    for (const anomaly of anomalies) {
      await this.handleApiAnomaly(anomaly, endpoint);
    }
  }

  private async handleApiAnomaly(anomaly: any, endpoint: string) {
    // Log for debugging
    console.log(`API Anomaly: ${endpoint}`, {
      metric: anomaly.data.metricName,
      severity: anomaly.severity,
      score: anomaly.score,
      description: anomaly.description
    });

    // Take action based on severity and type
    if (anomaly.severity === 'CRITICAL' && 
        anomaly.data.metricName === 'error_rate') {
      // Circuit breaker activation
      await this.activateCircuitBreaker(endpoint);
    }

    if (anomaly.type === 'SPIKE' && 
        anomaly.data.metricName === 'request_rate') {
      // Possible DDoS - activate rate limiting
      await this.enhanceRateLimiting(endpoint);
    }

    // Store for analysis
    await this.storeAnomaly(anomaly);
  }

  private isBusinessHours(): boolean {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }
}
```

### Middleware Integration

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ApiMonitoringMiddleware implements NestMiddleware {
  constructor(private monitoringService: ApiMonitoringService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const endpoint = req.path;

    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      res.send = originalSend;
      
      // Calculate metrics
      const responseTime = Date.now() - startTime;
      const errorRate = res.statusCode >= 400 ? 1 : 0;
      
      // Monitor asynchronously
      setImmediate(() => {
        this.monitoringService.monitorEndpoint(
          endpoint,
          responseTime,
          errorRate,
          this.getRequestRate(endpoint)
        );
      });

      return res.send(data);
    }.bind(this);

    next();
  }

  private requestCounts = new Map<string, number[]>();
  
  private getRequestRate(endpoint: string): number {
    const now = Date.now();
    const window = 60000; // 1 minute
    
    if (!this.requestCounts.has(endpoint)) {
      this.requestCounts.set(endpoint, []);
    }
    
    const counts = this.requestCounts.get(endpoint)!;
    counts.push(now);
    
    // Remove old entries
    const cutoff = now - window;
    const filtered = counts.filter(t => t > cutoff);
    this.requestCounts.set(endpoint, filtered);
    
    return filtered.length / (window / 1000); // requests per second
  }
}
```

## 2. Database Connection Pool Monitoring {#database-monitoring}

### Scenario
Monitor database connection pools for anomalies such as connection leaks, unusual query patterns, and performance degradation.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseMonitoringService {
  private readonly checkInterval = 30000; // 30 seconds

  constructor(
    private dataSource: DataSource,
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureDetection();
  }

  private async configureDetection() {
    await this.anomalyService.configure({
      detectorType: "Statistical Anomaly Detector",
      sensitivity: 0.85,
      windowSize: 120, // 1 hour of 30-second samples
      detectorSpecificConfig: {
        statistical: {
          methods: ["modified-zscore", "iqr", "grubbs"],
          enableDataQualityAnalysis: true
        }
      }
    });
  }

  @Cron('*/30 * * * * *') // Every 30 seconds
  async monitorConnectionPool() {
    const pool = this.dataSource.driver.pool;
    const metrics: IAnomalyData[] = [
      {
        metricName: 'db_active_connections',
        value: pool.numUsed(),
        timestamp: Date.now(),
        labels: { database: this.dataSource.options.database as string }
      },
      {
        metricName: 'db_idle_connections',
        value: pool.numFree(),
        timestamp: Date.now(),
        labels: { database: this.dataSource.options.database as string }
      },
      {
        metricName: 'db_pending_connections',
        value: pool.numPendingCreates(),
        timestamp: Date.now(),
        labels: { database: this.dataSource.options.database as string }
      },
      {
        metricName: 'db_connection_wait_time',
        value: await this.measureConnectionTime(),
        timestamp: Date.now(),
        labels: { database: this.dataSource.options.database as string }
      }
    ];

    // Add query performance metrics
    const queryMetrics = await this.getQueryMetrics();
    metrics.push(...queryMetrics);

    const anomalies = await this.anomalyService.detectAnomalies(metrics);

    for (const anomaly of anomalies) {
      await this.handleDatabaseAnomaly(anomaly);
    }
  }

  private async measureConnectionTime(): Promise<number> {
    const start = Date.now();
    try {
      const connection = await this.dataSource.createQueryRunner();
      await connection.release();
      return Date.now() - start;
    } catch (error) {
      return -1; // Error indicator
    }
  }

  private async getQueryMetrics(): Promise<IAnomalyData[]> {
    // Get slow query statistics
    const slowQueries = await this.dataSource.query(`
      SELECT 
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration,
        MAX(duration_ms) as max_duration
      FROM pg_stat_statements
      WHERE duration_ms > 1000
      AND query_start > NOW() - INTERVAL '5 minutes'
    `);

    return [
      {
        metricName: 'db_slow_query_count',
        value: slowQueries[0].count || 0,
        timestamp: Date.now(),
        labels: { database: this.dataSource.options.database as string }
      },
      {
        metricName: 'db_avg_query_time',
        value: slowQueries[0].avg_duration || 0,
        timestamp: Date.now(),
        labels: { database: this.dataSource.options.database as string }
      }
    ];
  }

  private async handleDatabaseAnomaly(anomaly: any) {
    const metric = anomaly.data.metricName;
    
    switch (metric) {
      case 'db_active_connections':
        if (anomaly.severity === 'CRITICAL') {
          // Possible connection leak
          console.error('Possible database connection leak detected');
          await this.investigateConnectionLeak();
        }
        break;
        
      case 'db_connection_wait_time':
        if (anomaly.data.value > 5000) { // 5 seconds
          // Pool exhaustion
          console.error('Database pool exhaustion detected');
          await this.expandConnectionPool();
        }
        break;
        
      case 'db_slow_query_count':
        if (anomaly.score > 0.8) {
          // Performance degradation
          console.warn('Database performance degradation detected');
          await this.analyzeSlowQueries();
        }
        break;
    }
  }

  private async investigateConnectionLeak() {
    // Find long-running connections
    const longRunning = await this.dataSource.query(`
      SELECT pid, usename, application_name, state, 
             state_change, query_start, query
      FROM pg_stat_activity
      WHERE state != 'idle'
      AND query_start < NOW() - INTERVAL '10 minutes'
    `);

    console.log('Long-running connections:', longRunning);
    
    // Terminate extremely long connections (> 1 hour)
    for (const conn of longRunning) {
      const duration = Date.now() - new Date(conn.query_start).getTime();
      if (duration > 3600000) { // 1 hour
        await this.dataSource.query(
          'SELECT pg_terminate_backend($1)',
          [conn.pid]
        );
      }
    }
  }
}
```

## 3. E-commerce Fraud Detection {#fraud-detection}

### Scenario
Detect fraudulent transactions in real-time using behavioral patterns and transaction characteristics.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantCategory: string;
  country: string;
  timestamp: number;
  paymentMethod: string;
}

@Injectable()
export class FraudDetectionService {
  private userProfiles = new Map<string, UserProfile>();

  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureFraudDetection();
  }

  private async configureFraudDetection() {
    await this.anomalyService.configure({
      detectorType: "Machine Learning Detector",
      sensitivity: 0.9, // High sensitivity for fraud
      detectorSpecificConfig: {
        machineLearning: {
          algorithms: ["isolation-forest-ml", "autoencoder", "one-svm"],
          enableOnlineLearning: true,
          featureEngineering: {
            enableTimeFeatures: true,
            enableStatisticalFeatures: true,
            enableTrendFeatures: true
          }
        }
      },
      businessRules: [
        {
          name: "Velocity check",
          condition: "transactionCount > 5 && timeWindow < 300000", // 5 txns in 5 min
          action: "escalate",
          reason: "High transaction velocity"
        },
        {
          name: "Amount threshold",
          condition: "amount > userDailyAverage * 10",
          action: "escalate", 
          reason: "Unusually high amount"
        },
        {
          name: "Geographic impossibility",
          condition: "distanceFromLastTxn > 500 && timeSinceLastTxn < 3600000", // 500km in 1hr
          action: "escalate",
          reason: "Geographic impossibility"
        }
      ]
    });
  }

  async analyzeTransaction(transaction: Transaction): Promise<FraudAnalysis> {
    const userProfile = this.getUserProfile(transaction.userId);
    const features = this.extractFeatures(transaction, userProfile);
    
    const anomalyData: IAnomalyData = {
      metricName: 'transaction_risk_score',
      value: this.calculateRiskScore(features),
      timestamp: transaction.timestamp,
      labels: {
        userId: transaction.userId,
        merchantCategory: transaction.merchantCategory,
        country: transaction.country
      },
      metadata: {
        transactionId: transaction.id,
        amount: transaction.amount,
        features
      }
    };

    const anomalies = await this.anomalyService.detectAnomalies(
      [anomalyData],
      {
        userProfile,
        recentTransactions: userProfile.recentTransactions,
        merchantRiskScore: await this.getMerchantRiskScore(transaction.merchantId)
      }
    );

    const isFraudulent = anomalies.some(a => a.severity === 'CRITICAL');
    const riskScore = anomalies.length > 0 ? anomalies[0].score : 0;

    // Update user profile
    this.updateUserProfile(transaction, isFraudulent);

    return {
      transactionId: transaction.id,
      isFraudulent,
      riskScore,
      reasons: anomalies.map(a => a.description),
      recommendedAction: this.getRecommendedAction(riskScore),
      additionalChecks: this.getAdditionalChecks(features, anomalies)
    };
  }

  private extractFeatures(
    transaction: Transaction, 
    profile: UserProfile
  ): TransactionFeatures {
    const now = Date.now();
    const recentTxns = profile.recentTransactions;
    
    // Time-based features
    const hourOfDay = new Date(transaction.timestamp).getHours();
    const dayOfWeek = new Date(transaction.timestamp).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isNightTime = hourOfDay < 6 || hourOfDay > 22;
    
    // Amount-based features
    const amountZScore = (transaction.amount - profile.avgAmount) / 
                        (profile.stdAmount || 1);
    const amountPercentile = this.getPercentile(
      transaction.amount, 
      profile.amountHistory
    );
    
    // Velocity features
    const txnsLastHour = recentTxns.filter(
      t => now - t.timestamp < 3600000
    ).length;
    const txnsLastDay = recentTxns.filter(
      t => now - t.timestamp < 86400000
    ).length;
    
    // Merchant features
    const isNewMerchant = !profile.merchantHistory.has(transaction.merchantId);
    const merchantFrequency = profile.merchantHistory.get(transaction.merchantId) || 0;
    
    // Geographic features
    const lastTxn = recentTxns[recentTxns.length - 1];
    const geographicVelocity = lastTxn ? 
      this.calculateGeographicVelocity(lastTxn, transaction) : 0;
    
    return {
      // Temporal
      hourOfDay,
      dayOfWeek,
      isWeekend,
      isNightTime,
      timeSinceLastTxn: lastTxn ? 
        transaction.timestamp - lastTxn.timestamp : 0,
      
      // Amount
      amount: transaction.amount,
      amountZScore,
      amountPercentile,
      amountToLimitRatio: transaction.amount / profile.creditLimit,
      
      // Velocity
      txnsLastHour,
      txnsLastDay,
      amountLastHour: this.sumRecentAmount(recentTxns, 3600000),
      amountLastDay: this.sumRecentAmount(recentTxns, 86400000),
      
      // Merchant
      isNewMerchant,
      merchantFrequency,
      merchantCategoryRisk: this.merchantCategoryRisk[transaction.merchantCategory] || 0.5,
      
      // Geographic
      isInternational: transaction.country !== profile.homeCountry,
      geographicVelocity,
      countryRisk: this.countryRisk[transaction.country] || 0.5,
      
      // User behavior
      daysSinceAccountCreation: (now - profile.accountCreatedAt) / 86400000,
      totalTransactionCount: profile.totalTransactions,
      fraudHistoryScore: profile.fraudHistory.length / 
                        Math.max(profile.totalTransactions, 1)
    };
  }

  private calculateRiskScore(features: TransactionFeatures): number {
    let score = 0;
    
    // Amount risk
    score += Math.min(features.amountZScore / 3, 1) * 0.2;
    
    // Velocity risk
    score += Math.min(features.txnsLastHour / 10, 1) * 0.15;
    
    // Merchant risk
    score += (features.isNewMerchant ? 0.5 : 0) * 0.1;
    score += features.merchantCategoryRisk * 0.1;
    
    // Geographic risk
    score += (features.isInternational ? 0.3 : 0) * 0.15;
    score += Math.min(features.geographicVelocity / 1000, 1) * 0.1;
    
    // Time risk
    score += (features.isNightTime ? 0.3 : 0) * 0.1;
    
    // Account risk
    score += features.fraudHistoryScore * 0.1;
    
    return Math.min(score, 1);
  }

  private getRecommendedAction(riskScore: number): string {
    if (riskScore > 0.8) return 'BLOCK';
    if (riskScore > 0.6) return 'MANUAL_REVIEW';
    if (riskScore > 0.4) return 'ADDITIONAL_VERIFICATION';
    if (riskScore > 0.2) return 'MONITOR';
    return 'APPROVE';
  }

  private readonly merchantCategoryRisk = {
    'gambling': 0.9,
    'money_transfer': 0.8,
    'cryptocurrency': 0.8,
    'jewelry': 0.7,
    'electronics': 0.6,
    'travel': 0.5,
    'grocery': 0.2,
    'utilities': 0.1
  };

  private readonly countryRisk = {
    'high_risk_country_1': 0.9,
    'high_risk_country_2': 0.8,
    // ... more countries
    'low_risk_country': 0.1
  };
}
```

## 4. Infrastructure Health Monitoring {#infrastructure-monitoring}

### Scenario
Monitor server infrastructure for anomalies in CPU, memory, disk, and network usage.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';
import * as os from 'os';
import * as diskusage from 'diskusage';

@Injectable()
export class InfrastructureMonitoringService {
  private readonly monitoringInterval = 10000; // 10 seconds
  
  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureMonitoring();
    this.startMonitoring();
  }

  private async configureMonitoring() {
    await this.anomalyService.configure({
      detectorType: "Seasonal Anomaly Detector",
      sensitivity: 0.75,
      windowSize: 360, // 1 hour of 10-second samples
      detectorSpecificConfig: {
        seasonal: {
          enableHourlyPattern: true,
          enableDailyPattern: true,
          enableWeeklyPattern: true,
          trendDetection: true,
          volatilityModeling: true
        }
      },
      performance: {
        enabled: true,
        scaling: {
          maxInstances: 3,
          minInstances: 1,
          scaleUpCooldown: 300000,
          scaleDownCooldown: 600000
        }
      }
    });
  }

  private startMonitoring() {
    setInterval(() => {
      this.collectAndAnalyzeMetrics();
    }, this.monitoringInterval);
  }

  private async collectAndAnalyzeMetrics() {
    const metrics = await this.collectSystemMetrics();
    const anomalies = await this.anomalyService.detectAnomalies(metrics);
    
    for (const anomaly of anomalies) {
      await this.handleInfrastructureAnomaly(anomaly);
    }
  }

  private async collectSystemMetrics(): Promise<IAnomalyData[]> {
    const cpuUsage = this.getCpuUsage();
    const memoryInfo = this.getMemoryInfo();
    const diskInfo = await this.getDiskInfo();
    const networkInfo = this.getNetworkInfo();
    const processInfo = this.getProcessInfo();
    
    return [
      // CPU Metrics
      {
        metricName: 'cpu_usage_percent',
        value: cpuUsage.total,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      {
        metricName: 'cpu_load_average',
        value: os.loadavg()[0], // 1-minute average
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      
      // Memory Metrics
      {
        metricName: 'memory_usage_percent',
        value: memoryInfo.usagePercent,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      {
        metricName: 'memory_available_mb',
        value: memoryInfo.availableMB,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      
      // Disk Metrics
      {
        metricName: 'disk_usage_percent',
        value: diskInfo.usagePercent,
        timestamp: Date.now(),
        labels: { host: os.hostname(), disk: diskInfo.path }
      },
      {
        metricName: 'disk_io_read_mb',
        value: diskInfo.readMBps,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      {
        metricName: 'disk_io_write_mb',
        value: diskInfo.writeMBps,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      
      // Network Metrics
      {
        metricName: 'network_rx_mb',
        value: networkInfo.rxMBps,
        timestamp: Date.now(),
        labels: { host: os.hostname(), interface: networkInfo.interface }
      },
      {
        metricName: 'network_tx_mb',
        value: networkInfo.txMBps,
        timestamp: Date.now(),
        labels: { host: os.hostname(), interface: networkInfo.interface }
      },
      {
        metricName: 'network_connections_active',
        value: networkInfo.activeConnections,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      
      // Process Metrics
      {
        metricName: 'process_count',
        value: processInfo.totalProcesses,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      },
      {
        metricName: 'zombie_processes',
        value: processInfo.zombieProcesses,
        timestamp: Date.now(),
        labels: { host: os.hostname() }
      }
    ];
  }

  private getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      total: usage,
      cores: cpus.length
    };
  }

  private getMemoryInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      totalMB: Math.round(totalMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      availableMB: Math.round(freeMem / 1024 / 1024),
      usagePercent: Math.round((usedMem / totalMem) * 100)
    };
  }

  private async handleInfrastructureAnomaly(anomaly: any) {
    const metric = anomaly.data.metricName;
    const severity = anomaly.severity;
    
    // Log the anomaly
    console.warn(`Infrastructure anomaly detected:`, {
      metric,
      value: anomaly.data.value,
      severity,
      description: anomaly.description
    });

    // Take action based on metric and severity
    switch (metric) {
      case 'cpu_usage_percent':
        if (severity === 'CRITICAL' && anomaly.data.value > 90) {
          await this.handleHighCpu(anomaly);
        }
        break;
        
      case 'memory_usage_percent':
        if (severity === 'HIGH' && anomaly.data.value > 85) {
          await this.handleHighMemory(anomaly);
        }
        break;
        
      case 'disk_usage_percent':
        if (anomaly.data.value > 90) {
          await this.handleHighDiskUsage(anomaly);
        }
        break;
        
      case 'zombie_processes':
        if (anomaly.data.value > 0) {
          await this.handleZombieProcesses(anomaly);
        }
        break;
    }
    
    // Send alerts for critical issues
    if (severity === 'CRITICAL') {
      await this.sendCriticalAlert(anomaly);
    }
  }

  private async handleHighCpu(anomaly: any) {
    // Find top CPU consuming processes
    const exec = require('util').promisify(require('child_process').exec);
    
    try {
      const { stdout } = await exec('ps aux --sort=-%cpu | head -10');
      console.log('Top CPU processes:', stdout);
      
      // Auto-restart if specific service is consuming too much
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('node') && line.includes('worker')) {
          const pid = line.split(/\s+/)[1];
          console.log(`Restarting high CPU worker process ${pid}`);
          process.kill(parseInt(pid), 'SIGTERM');
        }
      }
    } catch (error) {
      console.error('Failed to analyze CPU usage:', error);
    }
  }

  private async handleHighMemory(anomaly: any) {
    // Force garbage collection if available
    if (global.gc) {
      console.log('Forcing garbage collection');
      global.gc();
    }
    
    // Clear caches
    await this.clearApplicationCaches();
    
    // Check for memory leaks
    const memoryUsage = process.memoryUsage();
    console.log('Process memory usage:', {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
    });
  }
}
```

## 5. IoT Sensor Monitoring {#iot-monitoring}

### Scenario
Monitor IoT sensors for anomalies including sensor failures, drift, and environmental anomalies.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';

interface SensorReading {
  sensorId: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'air_quality';
  value: number;
  unit: string;
  timestamp: number;
  location: {
    building: string;
    floor: string;
    room: string;
  };
  metadata?: {
    battery: number;
    signalStrength: number;
    firmware: string;
  };
}

@Injectable()
export class IoTMonitoringService {
  private sensorProfiles = new Map<string, SensorProfile>();
  private environmentalBaselines = new Map<string, EnvironmentalBaseline>();

  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureIoTMonitoring();
  }

  private async configureIoTMonitoring() {
    await this.anomalyService.configure({
      detectorType: "Composite Anomaly Detector",
      sensitivity: 0.85,
      windowSize: 720, // 12 hours for hourly patterns
      detectorSpecificConfig: {
        composite: {
          strategy: "adaptive_weighted",
          detectorWeights: {
            "Threshold Anomaly Detector": 0.3, // For boundary violations
            "Seasonal Anomaly Detector": 0.3, // For pattern anomalies
            "Statistical Anomaly Detector": 0.2, // For statistical outliers
            "Isolation Forest Detector": 0.2 // For multivariate anomalies
          }
        }
      },
      businessRules: [
        {
          name: "Temperature safety",
          condition: "type === 'temperature' && (value < -10 || value > 50)",
          action: "escalate",
          reason: "Temperature outside safe operating range"
        },
        {
          name: "Sensor failure",
          condition: "value === lastValue && readingCount > 10",
          action: "escalate",
          reason: "Sensor appears to be stuck"
        },
        {
          name: "Battery low",
          condition: "metadata.battery < 20",
          action: "escalate",
          reason: "Sensor battery critically low"
        }
      ]
    });
  }

  async processSensorReading(reading: SensorReading) {
    // Get sensor profile
    const profile = this.getSensorProfile(reading.sensorId);
    
    // Check for sensor health issues
    const healthAnomalies = await this.checkSensorHealth(reading, profile);
    
    // Check for environmental anomalies
    const envAnomalies = await this.checkEnvironmentalAnomaly(reading);
    
    // Combine all anomaly data
    const anomalyData: IAnomalyData[] = [
      {
        metricName: `sensor_${reading.type}`,
        value: reading.value,
        timestamp: reading.timestamp,
        labels: {
          sensorId: reading.sensorId,
          location: `${reading.location.building}_${reading.location.floor}_${reading.location.room}`,
          type: reading.type
        },
        metadata: {
          ...reading.metadata,
          expectedRange: profile.expectedRange,
          lastCalibration: profile.lastCalibration
        }
      }
    ];

    // Add derived metrics
    anomalyData.push(...this.calculateDerivedMetrics(reading, profile));

    // Detect anomalies
    const anomalies = await this.anomalyService.detectAnomalies(
      anomalyData,
      {
        sensorProfile: profile,
        environmentalContext: this.getEnvironmentalContext(reading.location),
        timeOfDay: new Date(reading.timestamp).getHours(),
        dayOfWeek: new Date(reading.timestamp).getDay()
      }
    );

    // Handle detected anomalies
    for (const anomaly of anomalies) {
      await this.handleSensorAnomaly(anomaly, reading);
    }

    // Update profiles
    this.updateSensorProfile(reading, anomalies.length > 0);
  }

  private calculateDerivedMetrics(
    reading: SensorReading,
    profile: SensorProfile
  ): IAnomalyData[] {
    const derived: IAnomalyData[] = [];
    
    // Rate of change
    if (profile.lastReading) {
      const timeDiff = reading.timestamp - profile.lastReading.timestamp;
      const valueDiff = reading.value - profile.lastReading.value;
      const rateOfChange = valueDiff / (timeDiff / 1000); // per second
      
      derived.push({
        metricName: `sensor_${reading.type}_rate_of_change`,
        value: rateOfChange,
        timestamp: reading.timestamp,
        labels: { sensorId: reading.sensorId }
      });
    }
    
    // Deviation from baseline
    const baseline = this.getEnvironmentalBaseline(reading.location, reading.type);
    if (baseline) {
      const deviation = Math.abs(reading.value - baseline.expected);
      
      derived.push({
        metricName: `sensor_${reading.type}_deviation`,
        value: deviation,
        timestamp: reading.timestamp,
        labels: { sensorId: reading.sensorId }
      });
    }
    
    // Cross-sensor correlation
    const nearbySensors = this.getNearbySensors(reading.location, reading.type);
    if (nearbySensors.length > 0) {
      const avgNearby = nearbySensors.reduce((sum, s) => sum + s.lastValue, 0) / 
                       nearbySensors.length;
      const correlation = Math.abs(reading.value - avgNearby);
      
      derived.push({
        metricName: `sensor_${reading.type}_correlation`,
        value: correlation,
        timestamp: reading.timestamp,
        labels: { sensorId: reading.sensorId }
      });
    }
    
    return derived;
  }

  private async checkSensorHealth(
    reading: SensorReading,
    profile: SensorProfile
  ): Promise<HealthAnomaly[]> {
    const anomalies: HealthAnomaly[] = [];
    
    // Check for stuck sensor
    if (profile.lastReading && 
        reading.value === profile.lastReading.value &&
        profile.consecutiveSameReadings > 10) {
      anomalies.push({
        type: 'STUCK_SENSOR',
        severity: 'HIGH',
        message: `Sensor ${reading.sensorId} reporting constant value`
      });
    }
    
    // Check for drift
    if (profile.calibrationData) {
      const drift = this.calculateDrift(reading, profile.calibrationData);
      if (drift > 0.1) { // 10% drift
        anomalies.push({
          type: 'SENSOR_DRIFT',
          severity: 'MEDIUM',
          message: `Sensor ${reading.sensorId} showing ${drift * 100}% drift`
        });
      }
    }
    
    // Check for impossible values
    const physicalLimits = this.getPhysicalLimits(reading.type);
    if (reading.value < physicalLimits.min || reading.value > physicalLimits.max) {
      anomalies.push({
        type: 'IMPOSSIBLE_VALUE',
        severity: 'CRITICAL',
        message: `Sensor ${reading.sensorId} reporting impossible value: ${reading.value}`
      });
    }
    
    // Check metadata health
    if (reading.metadata) {
      if (reading.metadata.battery < 10) {
        anomalies.push({
          type: 'CRITICAL_BATTERY',
          severity: 'CRITICAL',
          message: `Sensor ${reading.sensorId} battery at ${reading.metadata.battery}%`
        });
      }
      
      if (reading.metadata.signalStrength < -80) { // dBm
        anomalies.push({
          type: 'WEAK_SIGNAL',
          severity: 'MEDIUM',
          message: `Sensor ${reading.sensorId} weak signal: ${reading.metadata.signalStrength}dBm`
        });
      }
    }
    
    return anomalies;
  }

  private async handleSensorAnomaly(anomaly: any, reading: SensorReading) {
    console.log(`IoT Anomaly detected:`, {
      sensor: reading.sensorId,
      type: reading.type,
      value: reading.value,
      anomalyType: anomaly.type,
      severity: anomaly.severity,
      description: anomaly.description
    });

    // Take action based on anomaly type
    switch (anomaly.type) {
      case 'THRESHOLD_BREACH':
        if (reading.type === 'temperature' && anomaly.severity === 'CRITICAL') {
          await this.triggerTemperatureAlert(reading, anomaly);
        }
        break;
        
      case 'PATTERN_BREAK':
        // Possible environmental issue
        await this.investigateEnvironmentalIssue(reading, anomaly);
        break;
        
      case 'OUTLIER':
        // Possible sensor malfunction
        await this.scheduleSensorMaintenance(reading.sensorId, anomaly);
        break;
    }
    
    // Update sensor status
    await this.updateSensorStatus(reading.sensorId, {
      status: anomaly.severity === 'CRITICAL' ? 'ERROR' : 'WARNING',
      lastAnomaly: anomaly,
      timestamp: Date.now()
    });
  }

  private getPhysicalLimits(sensorType: string) {
    const limits = {
      temperature: { min: -273.15, max: 1000 }, // Celsius
      humidity: { min: 0, max: 100 }, // Percentage
      pressure: { min: 0, max: 2000 }, // hPa
      motion: { min: 0, max: 1 }, // Binary
      air_quality: { min: 0, max: 500 } // AQI
    };
    
    return limits[sensorType] || { min: -Infinity, max: Infinity };
  }
}
```

## 6. Security Threat Detection {#security-detection}

### Scenario
Detect security threats including DDoS attacks, brute force attempts, and suspicious access patterns.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

interface SecurityEvent {
  type: 'login' | 'api_call' | 'file_access' | 'admin_action';
  userId?: string;
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  metadata?: {
    country?: string;
    asn?: string;
    loginAttempts?: number;
    sessionId?: string;
  };
}

@Injectable()
export class SecurityThreatDetectionService {
  private ipProfiles = new Map<string, IpProfile>();
  private userProfiles = new Map<string, UserSecurityProfile>();
  private blacklist = new Set<string>();

  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureSecurityDetection();
  }

  private async configureSecurityDetection() {
    await this.anomalyService.configure({
      detectorType: "Composite Anomaly Detector",
      sensitivity: 0.95, // Very high sensitivity for security
      windowSize: 300, // 5 minutes
      detectorSpecificConfig: {
        composite: {
          strategy: "hierarchical",
          enableContextualSelection: true,
          detectorWeights: {
            "Statistical Anomaly Detector": 0.3,
            "Isolation Forest Detector": 0.3,
            "Machine Learning Detector": 0.4
          }
        }
      },
      businessRules: [
        {
          name: "Brute force detection",
          condition: "loginAttempts > 5 && timeWindow < 60000",
          action: "escalate",
          reason: "Multiple failed login attempts"
        },
        {
          name: "DDoS detection",
          condition: "requestRate > 100 && uniqueIps < 10",
          action: "escalate",
          reason: "High request rate from limited IPs"
        },
        {
          name: "Privilege escalation",
          condition: "endpoint.includes('/admin') && !userRoles.includes('admin')",
          action: "escalate",
          reason: "Unauthorized admin access attempt"
        }
      ],
      alerting: {
        enabled: true,
        channels: [
          {
            type: "WEBHOOK",
            enabled: true,
            config: {
              url: process.env.SECURITY_WEBHOOK,
              headers: {
                'X-Security-Key': process.env.SECURITY_KEY
              }
            }
          },
          {
            type: "EMAIL",
            enabled: true,
            config: {
              recipients: ["security@company.com"],
              priority: "high"
            }
          }
        ]
      }
    });
  }

  async analyzeSecurityEvent(event: SecurityEvent): Promise<ThreatAnalysis> {
    // Check blacklist first
    if (this.blacklist.has(event.ip)) {
      return {
        blocked: true,
        reason: "IP blacklisted",
        threatLevel: "CRITICAL"
      };
    }

    // Get profiles
    const ipProfile = this.getIpProfile(event.ip);
    const userProfile = event.userId ? 
      this.getUserProfile(event.userId) : null;

    // Extract features
    const features = this.extractSecurityFeatures(event, ipProfile, userProfile);
    
    // Create anomaly data
    const anomalyData: IAnomalyData[] = [
      {
        metricName: 'security_risk_score',
        value: this.calculateSecurityRiskScore(features),
        timestamp: event.timestamp,
        labels: {
          eventType: event.type,
          ip: this.hashIp(event.ip),
          endpoint: event.endpoint
        },
        metadata: features
      }
    ];

    // Add specific security metrics
    anomalyData.push(...this.getSecurityMetrics(event, ipProfile));

    // Detect anomalies
    const anomalies = await this.anomalyService.detectAnomalies(
      anomalyData,
      {
        ipProfile,
        userProfile,
        geoLocation: await this.getGeoLocation(event.ip),
        threatIntelligence: await this.checkThreatIntelligence(event.ip)
      }
    );

    // Analyze threats
    const threats = this.analyzeThreats(anomalies, features);
    
    // Take action
    if (threats.length > 0) {
      await this.handleSecurityThreats(threats, event);
    }

    // Update profiles
    this.updateProfiles(event, threats);

    return {
      blocked: threats.some(t => t.severity === 'CRITICAL'),
      threats,
      riskScore: anomalies.length > 0 ? anomalies[0].score : 0,
      recommendedAction: this.getSecurityAction(threats)
    };
  }

  private extractSecurityFeatures(
    event: SecurityEvent,
    ipProfile: IpProfile,
    userProfile: UserSecurityProfile | null
  ): SecurityFeatures {
    const now = Date.now();
    
    return {
      // Request features
      isFailedRequest: event.statusCode >= 400,
      isServerError: event.statusCode >= 500,
      responseTime: event.responseTime,
      
      // IP features
      requestsFromIpLastMinute: ipProfile.getRequestCount(60000),
      requestsFromIpLastHour: ipProfile.getRequestCount(3600000),
      uniqueEndpointsFromIp: ipProfile.uniqueEndpoints.size,
      failureRateFromIp: ipProfile.getFailureRate(),
      isNewIp: ipProfile.firstSeen > now - 86400000, // New in last 24h
      
      // User features (if authenticated)
      isNewUser: userProfile ? userProfile.createdAt > now - 604800000 : false, // New in last week
      userFailedLogins: userProfile ? userProfile.failedLoginCount : 0,
      userRiskScore: userProfile ? userProfile.riskScore : 0.5,
      
      // Pattern features
      isUnusualTime: this.isUnusualTime(event.timestamp),
      isUnusualGeo: userProfile ? 
        !userProfile.knownLocations.has(event.metadata?.country || '') : true,
      isUnusualUserAgent: userProfile ?
        !userProfile.knownUserAgents.has(event.userAgent) : true,
      
      // Endpoint features
      endpointSensitivity: this.getEndpointSensitivity(event.endpoint),
      isAdminEndpoint: event.endpoint.includes('/admin'),
      isAuthEndpoint: event.endpoint.includes('/auth') || event.endpoint.includes('/login'),
      
      // Behavioral features
      requestVelocity: this.calculateRequestVelocity(ipProfile),
      endpointDiversity: this.calculateEndpointDiversity(ipProfile),
      temporalConsistency: this.calculateTemporalConsistency(ipProfile)
    };
  }

  private getSecurityMetrics(
    event: SecurityEvent,
    ipProfile: IpProfile
  ): IAnomalyData[] {
    return [
      {
        metricName: 'request_rate_per_ip',
        value: ipProfile.getRequestCount(60000), // Last minute
        timestamp: event.timestamp,
        labels: { ip: this.hashIp(event.ip) }
      },
      {
        metricName: 'failed_request_rate',
        value: ipProfile.getFailureRate(),
        timestamp: event.timestamp,
        labels: { ip: this.hashIp(event.ip) }
      },
      {
        metricName: 'endpoint_diversity',
        value: ipProfile.uniqueEndpoints.size,
        timestamp: event.timestamp,
        labels: { ip: this.hashIp(event.ip) }
      },
      {
        metricName: 'response_time_anomaly',
        value: event.responseTime,
        timestamp: event.timestamp,
        labels: { 
          endpoint: event.endpoint,
          method: event.method
        }
      }
    ];
  }

  private analyzeThreats(
    anomalies: any[],
    features: SecurityFeatures
  ): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // Analyze each anomaly
    for (const anomaly of anomalies) {
      const threat = this.classifyThreat(anomaly, features);
      if (threat) {
        threats.push(threat);
      }
    }

    // Check for specific threat patterns
    if (features.requestsFromIpLastMinute > 100) {
      threats.push({
        type: 'RATE_LIMIT_ABUSE',
        severity: 'HIGH',
        confidence: 0.9,
        description: 'Excessive request rate detected'
      });
    }

    if (features.failureRateFromIp > 0.8 && features.isAuthEndpoint) {
      threats.push({
        type: 'BRUTE_FORCE',
        severity: 'CRITICAL',
        confidence: 0.95,
        description: 'Brute force attack pattern detected'
      });
    }

    if (features.endpointDiversity > 50 && features.requestsFromIpLastMinute > 50) {
      threats.push({
        type: 'SCANNING',
        severity: 'HIGH',
        confidence: 0.85,
        description: 'Endpoint scanning behavior detected'
      });
    }

    return threats;
  }

  private async handleSecurityThreats(
    threats: SecurityThreat[],
    event: SecurityEvent
  ) {
    const criticalThreats = threats.filter(t => t.severity === 'CRITICAL');
    
    if (criticalThreats.length > 0) {
      // Immediate blocking
      this.blacklist.add(event.ip);
      console.error(`CRITICAL SECURITY THREAT from ${event.ip}:`, criticalThreats);
      
      // Trigger incident response
      await this.triggerIncidentResponse({
        threats: criticalThreats,
        event,
        timestamp: Date.now()
      });
    }

    // Log all threats
    for (const threat of threats) {
      await this.logSecurityThreat(threat, event);
    }

    // Update threat intelligence
    await this.updateThreatIntelligence(event.ip, threats);
  }

  private calculateSecurityRiskScore(features: SecurityFeatures): number {
    let score = 0;

    // Request pattern risk
    score += Math.min(features.requestsFromIpLastMinute / 100, 1) * 0.2;
    score += features.failureRateFromIp * 0.3;
    
    // Authentication risk
    if (features.isAuthEndpoint) {
      score += features.userFailedLogins > 3 ? 0.3 : 0;
    }
    
    // Endpoint sensitivity
    score += features.endpointSensitivity * 0.2;
    
    // Behavioral risk
    score += features.isUnusualTime ? 0.1 : 0;
    score += features.isUnusualGeo ? 0.1 : 0;
    score += features.isNewIp ? 0.05 : 0;
    
    return Math.min(score, 1);
  }

  private hashIp(ip: string): string {
    // Hash IP for privacy
    return createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }

  private getEndpointSensitivity(endpoint: string): number {
    const sensitivities = {
      '/admin': 1.0,
      '/api/users': 0.8,
      '/api/payments': 0.9,
      '/api/auth': 0.7,
      '/health': 0.1,
      '/public': 0.1
    };

    for (const [pattern, sensitivity] of Object.entries(sensitivities)) {
      if (endpoint.includes(pattern)) {
        return sensitivity;
      }
    }

    return 0.5; // Default medium sensitivity
  }
}
```

## 7. Business Metrics Monitoring {#business-metrics}

### Scenario
Monitor business KPIs for anomalies that could indicate problems or opportunities.

### Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

interface BusinessMetric {
  name: string;
  value: number;
  timestamp: number;
  dimensions: {
    product?: string;
    region?: string;
    channel?: string;
    customerSegment?: string;
  };
  metadata?: {
    currency?: string;
    unit?: string;
    source?: string;
  };
}

@Injectable()
export class BusinessMetricsMonitoringService {
  private metricBaselines = new Map<string, MetricBaseline>();
  private alertThresholds = new Map<string, AlertThreshold>();

  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {
    this.configureBusinessMonitoring();
  }

  private async configureBusinessMonitoring() {
    await this.anomalyService.configure({
      detectorType: "Composite Anomaly Detector",
      sensitivity: 0.7,
      windowSize: 168, // 1 week of hourly data
      detectorSpecificConfig: {
        composite: {
          strategy: "adaptive_weighted",
          detectorWeights: {
            "Seasonal Anomaly Detector": 0.4, // Business patterns
            "Statistical Anomaly Detector": 0.3, // Statistical significance
            "Threshold Anomaly Detector": 0.3 // Business rules
          }
        }
      },
      businessRules: [
        {
          name: "Revenue drop alert",
          condition: "metricName === 'revenue' && percentChange < -20",
          action: "escalate",
          reason: "Significant revenue drop detected"
        },
        {
          name: "Conversion rate alert",
          condition: "metricName === 'conversion_rate' && value < 0.01",
          action: "escalate",
          reason: "Conversion rate below 1%"
        },
        {
          name: "Inventory alert",
          condition: "metricName === 'inventory_days' && value < 7",
          action: "escalate",
          reason: "Low inventory warning"
        }
      ]
    });
  }

  @Cron('0 * * * *') // Every hour
  async monitorBusinessMetrics() {
    const metrics = await this.collectBusinessMetrics();
    
    for (const metric of metrics) {
      await this.analyzeBusinessMetric(metric);
    }
  }

  private async collectBusinessMetrics(): Promise<BusinessMetric[]> {
    // In real implementation, these would come from various data sources
    return [
      // Revenue metrics
      {
        name: 'revenue',
        value: await this.getHourlyRevenue(),
        timestamp: Date.now(),
        dimensions: { channel: 'online' },
        metadata: { currency: 'USD' }
      },
      {
        name: 'average_order_value',
        value: await this.getAverageOrderValue(),
        timestamp: Date.now(),
        dimensions: { channel: 'online' },
        metadata: { currency: 'USD' }
      },
      
      // Customer metrics
      {
        name: 'conversion_rate',
        value: await this.getConversionRate(),
        timestamp: Date.now(),
        dimensions: { channel: 'online' },
        metadata: { unit: 'percentage' }
      },
      {
        name: 'customer_acquisition_cost',
        value: await this.getCAC(),
        timestamp: Date.now(),
        dimensions: { channel: 'online' },
        metadata: { currency: 'USD' }
      },
      
      // Operational metrics
      {
        name: 'order_fulfillment_time',
        value: await this.getFulfillmentTime(),
        timestamp: Date.now(),
        dimensions: { region: 'US' },
        metadata: { unit: 'hours' }
      },
      {
        name: 'inventory_turnover',
        value: await this.getInventoryTurnover(),
        timestamp: Date.now(),
        dimensions: {},
        metadata: { unit: 'times_per_year' }
      }
    ];
  }

  private async analyzeBusinessMetric(metric: BusinessMetric) {
    // Get baseline for comparison
    const baseline = this.getMetricBaseline(metric);
    
    // Calculate derived metrics
    const derivedMetrics = this.calculateDerivedMetrics(metric, baseline);
    
    // Create anomaly data
    const anomalyData: IAnomalyData[] = [
      {
        metricName: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        labels: {
          ...metric.dimensions,
          metricType: 'business'
        },
        metadata: {
          ...metric.metadata,
          baseline: baseline.value,
          percentChange: derivedMetrics.percentChange
        }
      },
      ...derivedMetrics.anomalyData
    ];

    // Detect anomalies
    const anomalies = await this.anomalyService.detectAnomalies(
      anomalyData,
      {
        isBusinessHours: this.isBusinessHours(),
        dayOfWeek: new Date().getDay(),
        isMonthEnd: this.isMonthEnd(),
        isQuarterEnd: this.isQuarterEnd(),
        seasonalFactors: this.getSeasonalFactors(metric)
      }
    );

    // Handle anomalies
    for (const anomaly of anomalies) {
      await this.handleBusinessAnomaly(anomaly, metric);
    }

    // Update baselines
    this.updateBaseline(metric);
  }

  private calculateDerivedMetrics(
    metric: BusinessMetric,
    baseline: MetricBaseline
  ): DerivedMetrics {
    const anomalyData: IAnomalyData[] = [];
    
    // Percent change from baseline
    const percentChange = baseline.value > 0 ?
      ((metric.value - baseline.value) / baseline.value) * 100 : 0;
    
    anomalyData.push({
      metricName: `${metric.name}_percent_change`,
      value: percentChange,
      timestamp: metric.timestamp,
      labels: metric.dimensions
    });

    // Moving averages
    const ma7 = baseline.movingAverage7Day;
    const ma30 = baseline.movingAverage30Day;
    
    if (ma7) {
      const deviationFrom7MA = ((metric.value - ma7) / ma7) * 100;
      anomalyData.push({
        metricName: `${metric.name}_deviation_7ma`,
        value: deviationFrom7MA,
        timestamp: metric.timestamp,
        labels: metric.dimensions
      });
    }

    // Trend analysis
    const trend = this.calculateTrend(baseline.historicalValues);
    anomalyData.push({
      metricName: `${metric.name}_trend_strength`,
      value: trend.strength,
      timestamp: metric.timestamp,
      labels: metric.dimensions
    });

    // Volatility
    const volatility = this.calculateVolatility(baseline.historicalValues);
    anomalyData.push({
      metricName: `${metric.name}_volatility`,
      value: volatility,
      timestamp: metric.timestamp,
      labels: metric.dimensions
    });

    return {
      percentChange,
      trend,
      volatility,
      anomalyData
    };
  }

  private async handleBusinessAnomaly(
    anomaly: any,
    metric: BusinessMetric
  ) {
    console.log(`Business anomaly detected:`, {
      metric: metric.name,
      value: metric.value,
      severity: anomaly.severity,
      description: anomaly.description
    });

    // Determine impact
    const impact = this.assessBusinessImpact(anomaly, metric);
    
    // Create alert with business context
    const alert = {
      title: `${metric.name} Anomaly Detected`,
      severity: anomaly.severity,
      metric: metric.name,
      currentValue: metric.value,
      expectedRange: anomaly.expectedValue ? 
        `${anomaly.expectedValue * 0.8} - ${anomaly.expectedValue * 1.2}` : 
        'Unknown',
      impact: impact.description,
      potentialRevenueLoss: impact.revenueLoss,
      recommendedActions: this.getRecommendedActions(metric, anomaly),
      timestamp: Date.now()
    };

    // Send to appropriate channels based on severity and impact
    if (anomaly.severity === 'CRITICAL' || impact.revenueLoss > 10000) {
      await this.sendExecutiveAlert(alert);
    } else if (anomaly.severity === 'HIGH') {
      await this.sendManagerAlert(alert);
    } else {
      await this.sendAnalystAlert(alert);
    }

    // Trigger automated responses
    await this.triggerAutomatedResponses(metric, anomaly);
  }

  private assessBusinessImpact(anomaly: any, metric: BusinessMetric): BusinessImpact {
    let revenueLoss = 0;
    let description = '';
    
    switch (metric.name) {
      case 'revenue':
        revenueLoss = Math.abs(anomaly.deviation || 0);
        description = `Direct revenue impact of $${revenueLoss.toFixed(2)}`;
        break;
        
      case 'conversion_rate':
        const avgOrderValue = 150; // Would get from data
        const dailyVisitors = 10000; // Would get from data
        const conversionDrop = Math.abs(anomaly.deviation || 0);
        revenueLoss = avgOrderValue * dailyVisitors * conversionDrop;
        description = `Potential daily revenue loss of $${revenueLoss.toFixed(2)}`;
        break;
        
      case 'customer_acquisition_cost':
        if (anomaly.data.value > anomaly.expectedValue) {
          const increase = anomaly.data.value - anomaly.expectedValue;
          const dailyAcquisitions = 100; // Would get from data
          revenueLoss = increase * dailyAcquisitions;
          description = `Increased acquisition costs of $${revenueLoss.toFixed(2)} per day`;
        }
        break;
    }
    
    return { revenueLoss, description };
  }

  private getRecommendedActions(
    metric: BusinessMetric,
    anomaly: any
  ): string[] {
    const actions: string[] = [];
    
    switch (metric.name) {
      case 'revenue':
        if (anomaly.type === 'DROP') {
          actions.push('Check for website/app outages');
          actions.push('Verify payment gateway functionality');
          actions.push('Review recent pricing changes');
          actions.push('Check competitor activities');
        }
        break;
        
      case 'conversion_rate':
        if (anomaly.data.value < anomaly.expectedValue) {
          actions.push('Review recent website changes');
          actions.push('Check page load times');
          actions.push('Analyze user journey drop-off points');
          actions.push('A/B test checkout process');
        }
        break;
        
      case 'inventory_turnover':
        if (anomaly.data.value < anomaly.expectedValue) {
          actions.push('Review slow-moving inventory');
          actions.push('Consider promotional activities');
          actions.push('Analyze demand forecasting accuracy');
        }
        break;
    }
    
    return actions;
  }

  private async triggerAutomatedResponses(
    metric: BusinessMetric,
    anomaly: any
  ) {
    // Examples of automated responses
    
    if (metric.name === 'inventory_days' && anomaly.data.value < 7) {
      // Trigger automatic reorder
      console.log('Triggering automatic inventory reorder');
      // await this.inventoryService.createAutomaticOrder();
    }
    
    if (metric.name === 'conversion_rate' && anomaly.severity === 'CRITICAL') {
      // Scale up customer support
      console.log('Scaling up customer support team');
      // await this.supportService.scaleUp();
    }
    
    if (metric.name === 'revenue' && anomaly.type === 'SPIKE') {
      // Scale infrastructure
      console.log('Scaling infrastructure to handle increased load');
      // await this.infrastructureService.scaleUp();
    }
  }
}
```

## 8. Custom Implementations {#custom-implementations}

### Creating a Custom Detector

```typescript
import { Injectable } from '@nestjs/common';
import { BaseAnomalyDetector } from '@usex/nest-shield';

@Injectable()
export class CustomBusinessRuleDetector extends BaseAnomalyDetector {
  readonly name = "Custom Business Rule Detector";
  readonly version = "1.0.0";
  readonly description = "Domain-specific anomaly detection based on business rules";

  private rules: BusinessRule[] = [];

  async detect(
    data: IAnomalyData[],
    context?: IDetectorContext
  ): Promise<IAnomaly[]> {
    const anomalies: IAnomaly[] = [];

    for (const dataPoint of data) {
      for (const rule of this.rules) {
        if (this.evaluateRule(rule, dataPoint, context)) {
          const anomaly = this.createAnomaly(
            dataPoint,
            AnomalyType.THRESHOLD_BREACH,
            rule.severity,
            0.9, // High confidence for rule-based
            rule.description,
            rule.expectedValue
          );
          
          anomalies.push(anomaly);
        }
      }
    }

    return anomalies;
  }

  addRule(rule: BusinessRule): void {
    this.rules.push(rule);
  }

  private evaluateRule(
    rule: BusinessRule,
    data: IAnomalyData,
    context?: IDetectorContext
  ): boolean {
    // Implement rule evaluation logic
    return rule.condition(data, context);
  }
}
```

### Combining Multiple Data Sources

```typescript
@Injectable()
export class MultiSourceAnomalyService {
  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService,
    private metricsService: MetricsService,
    private logService: LogAnalysisService,
    private traceService: TraceAnalysisService
  ) {}

  async detectCrossSourceAnomalies(): Promise<CrossSourceAnomaly[]> {
    // Collect data from multiple sources
    const [metrics, logs, traces] = await Promise.all([
      this.metricsService.getRecentMetrics(),
      this.logService.getRecentErrors(),
      this.traceService.getRecentTraces()
    ]);

    // Convert to common format
    const anomalyData: IAnomalyData[] = [
      ...this.convertMetrics(metrics),
      ...this.convertLogs(logs),
      ...this.convertTraces(traces)
    ];

    // Detect anomalies with cross-source context
    const anomalies = await this.anomalyService.detectAnomalies(
      anomalyData,
      {
        sources: ['metrics', 'logs', 'traces'],
        correlationWindow: 300000 // 5 minutes
      }
    );

    // Correlate anomalies across sources
    return this.correlateAnomalies(anomalies);
  }

  private correlateAnomalies(anomalies: IAnomaly[]): CrossSourceAnomaly[] {
    const correlated: CrossSourceAnomaly[] = [];
    const timeWindow = 60000; // 1 minute

    // Group anomalies by time window
    const groups = this.groupByTimeWindow(anomalies, timeWindow);

    // Analyze each group for correlations
    for (const group of groups) {
      if (group.length > 1) {
        const correlation = this.analyzeCorrelation(group);
        if (correlation.score > 0.7) {
          correlated.push({
            anomalies: group,
            correlationScore: correlation.score,
            rootCause: correlation.rootCause,
            impact: correlation.impact
          });
        }
      }
    }

    return correlated;
  }
}
```

## Best Practices

### 1. Data Quality
- Always validate input data before analysis
- Handle missing values appropriately
- Remove or flag obvious data errors

### 2. Configuration Tuning
- Start with lower sensitivity and increase gradually
- Use business hours and seasonal contexts
- Implement feedback loops to improve accuracy

### 3. Alert Management
- Implement alert suppression during maintenance
- Use escalation policies for critical issues
- Provide clear, actionable alert messages

### 4. Performance Optimization
- Use appropriate detectors for your use case
- Implement caching for expensive calculations
- Consider sampling for high-volume data

### 5. Monitoring and Feedback
- Track false positive/negative rates
- Implement user feedback mechanisms
- Continuously refine detection algorithms

## Conclusion

These examples demonstrate how to implement anomaly detection for various real-world scenarios. The key to success is:

1. **Understanding your data**: Know the normal patterns and expected anomalies
2. **Choosing the right detector**: Match the algorithm to your specific use case
3. **Proper configuration**: Tune sensitivity and thresholds based on feedback
4. **Actionable responses**: Ensure detected anomalies trigger appropriate actions
5. **Continuous improvement**: Monitor performance and refine over time

Remember that anomaly detection is not a one-size-fits-all solution. Start with simple approaches and gradually add complexity as you understand your specific requirements better.