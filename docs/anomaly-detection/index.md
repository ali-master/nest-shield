# Enterprise Anomaly Detection System

## Overview

The Enterprise Anomaly Detection System is a comprehensive, production-ready solution that provides advanced anomaly detection capabilities with enterprise-grade features including alerting, performance monitoring, auto-scaling, data collection, and security.

## 🚀 Key Features

### Core Detection Capabilities
- **7 Advanced Detectors**: Z-Score, Isolation Forest, Seasonal, Threshold, Statistical, Machine Learning, and Composite
- **Real-time Processing**: Sub-second detection latency for most use cases
- **Adaptive Thresholds**: Dynamic threshold adjustment based on data patterns
- **Business Rules Engine**: Customizable rules for anomaly suppression and escalation

### Enterprise Features
- **🔔 Advanced Alerting**: Multi-channel notifications with escalation policies
- **📊 Performance Monitoring**: Real-time performance metrics and auto-scaling
- **📈 Data Collection**: Enterprise-grade data ingestion with quality validation
- **🔒 Security**: Encryption, audit logging, and compliance features
- **🌐 Clustering**: Multi-node deployment with state synchronization
- **💾 Backup & Recovery**: Automated backup with multiple storage backends

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Detectors Guide](#detectors-guide)
4. [Enterprise Services](#enterprise-services)
5. [API Reference](#api-reference)
6. [Production Deployment](#production-deployment)
7. [Monitoring & Observability](#monitoring--observability)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { AnomalyDetectionModule } from '@usex/nest-shield';

@Module({
  imports: [
    AnomalyDetectionModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { EnterpriseAnomalyDetectionService } from '@usex/nest-shield';

@Injectable()
export class MyService {
  constructor(
    private readonly anomalyService: EnterpriseAnomalyDetectionService
  ) {}

  async detectAnomalies() {
    const data = [
      { metricName: 'cpu_usage', value: 95, timestamp: Date.now() },
      { metricName: 'memory_usage', value: 87, timestamp: Date.now() },
    ];

    const anomalies = await this.anomalyService.detectAnomalies(data);
    
    for (const anomaly of anomalies) {
      console.log(`Anomaly detected: ${anomaly.description}`);
    }
  }
}
```

## ⚙️ Configuration

### Enterprise Configuration

```typescript
const enterpriseConfig = {
  enabled: true,
  detectorType: "Composite Anomaly Detector",
  sensitivity: 0.8,
  threshold: 2.0,
  windowSize: 100,
  minDataPoints: 10,
  
  // Advanced alerting configuration
  alerting: {
    enabled: true,
    channels: [
      {
        type: "EMAIL",
        enabled: true,
        config: {
          recipients: ["ops@company.com", "oncall@company.com"],
          subject: "Anomaly Alert - {{severity}}"
        }
      },
      {
        type: "WEBHOOK",
        enabled: true,
        config: {
          url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
          method: "POST"
        }
      }
    ],
    escalationPolicy: {
      escalationLevels: [
        {
          level: 1,
          waitTime: 0,
          recipients: ["team-lead@company.com"],
          channels: ["LOG", "EMAIL"]
        },
        {
          level: 2,
          waitTime: 300000, // 5 minutes
          recipients: ["manager@company.com"],
          channels: ["EMAIL", "SMS"]
        }
      ]
    },
    rateLimiting: {
      maxAlertsPerMinute: 5,
      maxAlertsPerHour: 50
    }
  },
  
  // Performance monitoring and auto-scaling
  performance: {
    enabled: true,
    metrics: {
      cpuThreshold: 70,
      memoryThreshold: 70,
      latencyThreshold: 500,
      throughputThreshold: 100
    },
    scaling: {
      scaleUpCooldown: 300000,   // 5 minutes
      scaleDownCooldown: 600000, // 10 minutes
      maxInstances: 5,
      minInstances: 1
    }
  },
  
  // Data collection and quality
  dataCollection: {
    bufferSize: 50000,
    flushInterval: 30000,
    compressionEnabled: true,
    retentionPolicy: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    },
    qualityChecks: {
      enabled: true,
      validationRules: [
        {
          field: "value",
          type: "required",
          severity: "error"
        },
        {
          field: "timestamp",
          type: "range",
          config: { 
            min: Date.now() - 86400000, 
            max: Date.now() + 3600000 
          },
          severity: "warning"
        }
      ]
    }
  },
  
  // Security configuration
  security: {
    encryption: {
      enabled: true,
      algorithm: "aes-256-gcm",
      keyRotationDays: 90
    },
    audit: {
      enabled: true,
      logLevel: "detailed"
    }
  },
  
  // Backup and recovery
  backup: {
    enabled: true,
    interval: 3600000, // 1 hour
    retentionDays: 30,
    storageType: "s3",
    config: {
      bucket: "anomaly-detection-backups",
      region: "us-west-2"
    }
  }
};

await anomalyService.configure(enterpriseConfig);
```

## 🔍 Detectors Guide

### 1. Z-Score Detector
**Best for**: Simple statistical anomalies, real-time detection
```typescript
{
  detectorType: "Z-Score Detector",
  detectorSpecificConfig: {
    zscore: {
      threshold: 3.0,
      windowSize: 50,
      enableModifiedZScore: true,
      seasonalAdjustment: false
    }
  }
}
```

### 2. Isolation Forest Detector
**Best for**: High-dimensional data, outlier detection
```typescript
{
  detectorType: "Isolation Forest Detector",
  detectorSpecificConfig: {
    isolationForest: {
      numTrees: 100,
      subsampleSize: 256,
      maxDepth: 10,
      threshold: 0.6
    }
  }
}
```

### 3. Seasonal Anomaly Detector
**Best for**: Time-series with seasonal patterns
```typescript
{
  detectorType: "Seasonal Anomaly Detector",
  detectorSpecificConfig: {
    seasonal: {
      enableHourlyPattern: true,
      enableDailyPattern: true,
      enableWeeklyPattern: true,
      trendDetection: true
    }
  }
}
```

### 4. Machine Learning Detector
**Best for**: Complex patterns, high accuracy requirements
```typescript
{
  detectorType: "Machine Learning Detector",
  detectorSpecificConfig: {
    machineLearning: {
      algorithms: ["autoencoder", "lstm", "one-svm"],
      enableOnlineLearning: true,
      featureEngineering: {
        enableTimeFeatures: true,
        enableStatisticalFeatures: true,
        enableTrendFeatures: true
      }
    }
  }
}
```

### 5. Composite Detector (Recommended)
**Best for**: Production environments, highest accuracy
```typescript
{
  detectorType: "Composite Anomaly Detector",
  detectorSpecificConfig: {
    composite: {
      strategy: "adaptive_weighted",
      enableContextualSelection: true,
      enablePerformanceTracking: true,
      detectorWeights: {
        "Z-Score Detector": 0.2,
        "Isolation Forest Detector": 0.3,
        "Seasonal Anomaly Detector": 0.2,
        "Machine Learning Detector": 0.3
      }
    }
  }
}
```

## 🏢 Enterprise Services

### 1. Enterprise Alerting Service

```typescript
import { EnterpriseAlertingService } from '@usex/nest-shield';

// Configure alerting
await alertingService.configure({
  enabled: true,
  channels: [
    {
      type: "SLACK",
      enabled: true,
      config: {
        webhook: "https://hooks.slack.com/services/...",
        channel: "#alerts"
      }
    },
    {
      type: "PAGERDUTY",
      enabled: true,
      config: {
        integrationKey: "your-pagerduty-key",
        severity: "critical"
      }
    }
  ]
});

// Add custom alert rules
alertingService.addAlertRule({
  id: "critical-cpu",
  name: "Critical CPU Usage",
  enabled: true,
  severityThreshold: "HIGH",
  metricPatterns: ["cpu_.*"],
  conditions: [
    {
      field: "value",
      operator: "gt",
      value: 90
    }
  ]
});

// Manage alerts
const activeAlerts = alertingService.getActiveAlerts();
await alertingService.acknowledgeAlert(alertId, "john.doe");
await alertingService.resolveAlert(alertId);
```

### 2. Performance Monitoring Service

```typescript
import { EnterprisePerformanceMonitorService } from '@usex/nest-shield';

// Configure auto-scaling
await performanceService.configure({
  enabled: true,
  metrics: {
    cpuThreshold: 75,
    memoryThreshold: 80,
    latencyThreshold: 1000
  },
  scaling: {
    maxInstances: 10,
    minInstances: 2
  }
});

// Monitor detector performance
const performance = performanceService.getDetectorPerformance("Composite Anomaly Detector");
console.log(`Average latency: ${performance.averageMetrics.detectionLatency}ms`);
console.log(`Accuracy: ${performance.averageMetrics.accuracy * 100}%`);

// Get system health
const health = performanceService.getHealthStatus();
if (health.status === 'unhealthy') {
  console.log('System needs attention:', health.criticalDetectors);
}
```

### 3. Data Collection Service

```typescript
import { EnterpriseDataCollectorService } from '@usex/nest-shield';

// Register data sources
dataCollectorService.registerDataSource({
  id: "prometheus-metrics",
  name: "Prometheus Metrics",
  type: "metrics",
  enabled: true,
  config: {
    endpoint: "http://prometheus:9090/api/v1/query",
    queries: [
      "cpu_usage_percent",
      "memory_usage_percent",
      "disk_io_rate"
    ]
  },
  filters: [
    {
      field: "value",
      operator: "range",
      value: { min: 0, max: 100 }
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

// Collect data
const collected = await dataCollectorService.collectData("prometheus-metrics", rawData);
console.log(`Collected ${collected} data points`);

// Monitor data quality
const qualityMetrics = dataCollectorService.getQualityMetrics("prometheus-metrics");
console.log(`Data completeness: ${qualityMetrics[0]?.completeness * 100}%`);
```

## 📚 API Reference

### EnterpriseAnomalyDetectionService

#### Methods

##### `detectAnomalies(data: IAnomalyData[], context?: IDetectorContext): Promise<IAnomaly[]>`
Detects anomalies in the provided data using the configured detector.

**Parameters:**
- `data`: Array of anomaly data points
- `context`: Optional detection context

**Returns:** Array of detected anomalies

**Example:**
```typescript
const anomalies = await service.detectAnomalies([
  {
    metricName: "response_time",
    value: 2500,
    timestamp: Date.now(),
    labels: { service: "api", endpoint: "/users" }
  }
]);
```

##### `getSystemStatus(): Promise<SystemStatus>`
Returns comprehensive system status including health, performance, and configuration.

##### `getDetectionReport(detectorName?: string): Promise<DetectionReport>`
Generates detailed detection report for a specific detector or system-wide.

##### `switchDetector(detectorType: string): Promise<boolean>`
Switches to a different detector type at runtime.

### Alert Management

##### `acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean>`
Acknowledges an active alert.

##### `resolveAlert(alertId: string): Promise<boolean>`
Marks an alert as resolved.

##### `getActiveAlerts(): IAnomalyAlert[]`
Returns all currently active alerts.

### Performance Monitoring

##### `getDetectorPerformance(detectorName: string): IDetectorPerformance`
Returns performance metrics for a specific detector.

##### `getSystemPerformance(): SystemPerformance`
Returns system-wide performance metrics.

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY dist/ ./dist/

# Create backup directory
RUN mkdir -p /app/backups

# Set environment variables
ENV NODE_ENV=production
ENV ANOMALY_DETECTION_ENABLED=true
ENV BACKUP_ENABLED=true
ENV ENCRYPTION_ENABLED=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health/anomaly-detection || exit 1

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: anomaly-detection
spec:
  replicas: 3
  selector:
    matchLabels:
      app: anomaly-detection
  template:
    metadata:
      labels:
        app: anomaly-detection
    spec:
      containers:
      - name: anomaly-detection
        image: your-registry/anomaly-detection:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: CLUSTERING_ENABLED
          value: "true"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/anomaly-detection
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/anomaly-detection
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: backup-storage
          mountPath: /app/backups
      volumes:
      - name: backup-storage
        persistentVolumeClaim:
          claimName: anomaly-backup-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: anomaly-detection-service
spec:
  selector:
    app: anomaly-detection
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Environment Variables

```bash
# Core Configuration
NODE_ENV=production
ANOMALY_DETECTION_ENABLED=true
DETECTOR_TYPE="Composite Anomaly Detector"
SENSITIVITY=0.8
THRESHOLD=2.0

# Clustering
CLUSTERING_ENABLED=true
NODE_ID=node-1
CLUSTER_NODES=node-1,node-2,node-3
SYNC_INTERVAL=60000

# Performance
AUTO_SCALING_ENABLED=true
MAX_INSTANCES=10
MIN_INSTANCES=2
CPU_THRESHOLD=70
MEMORY_THRESHOLD=70

# Alerting
ALERTING_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
EMAIL_SMTP_HOST=smtp.company.com
EMAIL_SMTP_PORT=587
PAGERDUTY_INTEGRATION_KEY=your-key

# Data Storage
BACKUP_ENABLED=true
BACKUP_INTERVAL=3600000
BACKUP_STORAGE_TYPE=s3
AWS_S3_BUCKET=anomaly-detection-backups
AWS_REGION=us-west-2

# Security
ENCRYPTION_ENABLED=true
ENCRYPTION_ALGORITHM=aes-256-gcm
KEY_ROTATION_DAYS=90
AUDIT_ENABLED=true
AUDIT_LOG_LEVEL=detailed

# Database (if using external storage)
DATABASE_URL=postgresql://user:pass@db:5432/anomaly_detection
REDIS_URL=redis://redis:6379
```

## 📊 Monitoring & Observability

### Prometheus Metrics

The system exposes comprehensive metrics:

```yaml
# Anomaly detection metrics
anomaly_detection_total{detector="composite",severity="critical"} 45
anomaly_detection_latency_seconds{detector="composite"} 0.125
anomaly_detection_accuracy_ratio{detector="composite"} 0.94

# Performance metrics
detector_cpu_usage_percent{detector="composite"} 65
detector_memory_usage_bytes{detector="composite"} 524288000
detector_instances_total{detector="composite"} 3

# Alert metrics
alerts_total{status="open",severity="critical"} 2
alerts_response_time_seconds{channel="slack"} 1.2
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Anomaly Detection System",
    "panels": [
      {
        "title": "Anomalies Detected",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(anomaly_detection_total[5m])",
            "legendFormat": "{{detector}} - {{severity}}"
          }
        ]
      },
      {
        "title": "Detection Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "anomaly_detection_latency_seconds",
            "legendFormat": "{{detector}}"
          }
        ]
      },
      {
        "title": "System Health",
        "type": "stat",
        "targets": [
          {
            "expr": "anomaly_detection_accuracy_ratio",
            "legendFormat": "Accuracy"
          }
        ]
      }
    ]
  }
}
```

### Custom Health Checks

```typescript
import { HealthCheckService, HealthIndicator } from '@nestjs/terminus';

@Injectable()
export class AnomalyDetectionHealthIndicator extends HealthIndicator {
  constructor(
    private readonly anomalyService: EnterpriseAnomalyDetectionService
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const status = await this.anomalyService.getSystemStatus();
    const isHealthy = status.performance.status === 'healthy';
    
    const result = this.getStatus(key, isHealthy, {
      activeDetector: status.activeDetector,
      criticalAlerts: status.alerting.byStatus.open,
      accuracy: status.performance.averageMetrics.accuracy
    });

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError('Anomaly detection system unhealthy', result);
  }
}
```

## 🔒 Security

### Encryption Configuration

```typescript
const securityConfig = {
  encryption: {
    enabled: true,
    algorithm: "aes-256-gcm",
    keyRotationDays: 90,
    keyStorage: "aws-kms", // or "vault", "local"
    keyId: "arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012"
  },
  audit: {
    enabled: true,
    logLevel: "detailed",
    storage: "cloudwatch", // or "elasticsearch", "file"
    retentionDays: 365
  },
  authentication: {
    enabled: true,
    providers: ["jwt", "api-key"],
    jwtSecret: process.env.JWT_SECRET
  }
};
```

### RBAC (Role-Based Access Control)

```typescript
const roles = {
  viewer: {
    permissions: ["read:anomalies", "read:reports"]
  },
  operator: {
    permissions: ["read:anomalies", "write:alerts", "read:reports"]
  },
  admin: {
    permissions: ["*"]
  }
};
```

### Compliance Features

- **SOC 2 Type II**: Comprehensive audit logging and access controls
- **GDPR**: Data anonymization and right to deletion
- **HIPAA**: Encryption at rest and in transit, audit trails
- **PCI DSS**: Secure key management and data handling

## 🔧 Troubleshooting

### Common Issues

#### High False Positive Rate
```typescript
// Adjust sensitivity
await anomalyService.configure({
  sensitivity: 0.6, // Lower sensitivity
  businessRules: [
    {
      id: "maintenance-window",
      condition: "hour >= 2 && hour <= 4",
      action: "suppress",
      reason: "Scheduled maintenance window"
    }
  ]
});
```

#### Poor Performance
```typescript
// Enable auto-scaling
await performanceService.configure({
  enabled: true,
  metrics: {
    latencyThreshold: 500, // 500ms
    cpuThreshold: 60       // 60%
  },
  scaling: {
    maxInstances: 8,
    scaleUpCooldown: 180000 // 3 minutes
  }
});
```

#### Memory Issues
```typescript
// Optimize data retention
await dataCollectorService.configure({
  retentionPolicy: {
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    maxSize: 1 * 1024 * 1024 * 1024,  // 1GB
    compressionAfter: 6 * 60 * 60 * 1000 // 6 hours
  }
});
```

### Debug Mode

```typescript
// Enable debug logging
const debugConfig = {
  security: {
    audit: {
      enabled: true,
      logLevel: "full"
    }
  }
};

// Access internal metrics
const systemStatus = await anomalyService.getSystemStatus();
console.log('Debug Info:', JSON.stringify(systemStatus, null, 2));
```

### Performance Tuning

#### Detector Selection by Use Case

| Use Case | Recommended Detector | Configuration |
|----------|---------------------|---------------|
| Real-time monitoring | Z-Score | `sensitivity: 0.7, threshold: 2.5` |
| Complex patterns | Machine Learning | `algorithms: ["autoencoder", "lstm"]` |
| Seasonal data | Seasonal + Composite | `enableDailyPattern: true` |
| High-volume data | Isolation Forest | `subsampleSize: 512, numTrees: 50` |
| Production systems | Composite | `strategy: "adaptive_weighted"` |

#### Scaling Guidelines

| Metric Volume | Instances | CPU per Instance | Memory per Instance |
|---------------|-----------|------------------|-------------------|
| < 1K/min | 1 | 0.5 cores | 512MB |
| 1K-10K/min | 2-3 | 1 core | 1GB |
| 10K-100K/min | 3-5 | 2 cores | 2GB |
| > 100K/min | 5-10 | 4 cores | 4GB |

## 🆘 Support

### Getting Help

1. **Documentation**: Check this guide and API documentation
2. **GitHub Issues**: Report bugs and feature requests
3. **Community**: Join our Discord/Slack community
4. **Enterprise Support**: Available for commercial users

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

## 📈 Roadmap

### Upcoming Features

- **Advanced ML Models**: Integration with TensorFlow and PyTorch
- **Real-time Streaming**: Apache Kafka and Apache Pulsar support
- **Mobile Alerts**: Native mobile app for alert management
- **Federated Learning**: Cross-organization anomaly pattern sharing
- **Advanced Visualizations**: Interactive anomaly exploration tools

### Version History

- **v2.0.0**: Enterprise features, clustering, advanced alerting
- **v1.5.0**: Machine learning detectors, performance monitoring
- **v1.0.0**: Core anomaly detection, basic alerting
