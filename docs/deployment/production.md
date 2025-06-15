# Production Deployment Guide

<p align="center">
  <img src="../../assets/logo.svg" alt="NestShield" width="120">
</p>

Comprehensive guide for deploying NestShield in production environments with best practices, optimization strategies, and monitoring setup.

## 📋 Table of Contents

- [Production Checklist](#production-checklist)
- [Infrastructure Setup](#infrastructure-setup)
- [Configuration for Production](#configuration-for-production)
- [Storage Backends](#storage-backends)
- [Monitoring & Alerting](#monitoring--alerting)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [High Availability](#high-availability)
- [Troubleshooting](#troubleshooting)

## Production Checklist

### ✅ Pre-Deployment Checklist

- [ ] **Storage Backend**: Configure Redis/Memcached for distributed storage
- [ ] **Metrics**: Set up Prometheus, StatsD, or CloudWatch
- [ ] **Monitoring**: Configure dashboards and alerts
- [ ] **Load Testing**: Validate limits under expected load
- [ ] **Fallbacks**: Implement circuit breaker fallbacks
- [ ] **Health Checks**: Set up health monitoring endpoints
- [ ] **Logging**: Configure structured logging
- [ ] **Security**: Review and secure all endpoints
- [ ] **Documentation**: Document limits and escalation procedures
- [ ] **Runbooks**: Create operational runbooks

### 🔧 Configuration Validation

```typescript
// production-config.validator.ts
import { validateConfig } from '@usex/nest-shield';

export function validateProductionConfig(config: IShieldConfig): void {
  const errors: string[] = [];
  
  // Validate storage
  if (config.storage?.type === 'memory') {
    errors.push('Memory storage is not recommended for production');
  }
  
  // Validate metrics
  if (!config.metrics?.enabled) {
    errors.push('Metrics should be enabled in production');
  }
  
  // Validate rate limits
  if (config.rateLimit?.points && config.rateLimit.points > 10000) {
    errors.push('Rate limits seem too high, review for security');
  }
  
  if (errors.length > 0) {
    throw new Error(`Production config validation failed:\n${errors.join('\n')}`);
  }
}
```

## Infrastructure Setup

### Container Deployment (Docker)

**Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY dist/ ./dist/
COPY node_modules/ ./node_modules/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**docker-compose.yml**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
      - prometheus
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
  
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

volumes:
  redis_data:
  prometheus_data:
```

### Kubernetes Deployment

**deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nest-shield-app
  labels:
    app: nest-shield-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nest-shield-app
  template:
    metadata:
      labels:
        app: nest-shield-app
    spec:
      containers:
      - name: app
        image: your-registry/nest-shield-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        - name: REDIS_PORT
          value: "6379"
        - name: METRICS_ENABLED
          value: "true"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: nest-shield-service
spec:
  selector:
    app: nest-shield-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

**Redis StatefulSet**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
  volumeClaimTemplates:
  - metadata:
      name: redis-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

## Configuration for Production

### Environment-Based Configuration

```typescript
// config/production.ts
import { IShieldConfig } from '@usex/nest-shield';

export const productionConfig: IShieldConfig = {
  global: {
    enabled: true,
    bypassForDevelopment: false,
    errorHandler: (error, context) => {
      // Structured logging
      logger.error('Shield protection error', {
        error: error.message,
        stack: error.stack,
        context: {
          ip: context?.ip,
          path: context?.path,
          method: context?.method,
          timestamp: context?.timestamp
        }
      });
      
      // Error tracking
      Sentry.captureException(error, {
        tags: { component: 'nest-shield' },
        extra: { context }
      });
    }
  },
  
  storage: {
    type: 'redis',
    keyPrefix: `shield:${process.env.APP_NAME}:${process.env.NODE_ENV}:`,
    options: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000
    }
  },
  
  rateLimit: {
    enabled: true,
    points: parseInt(process.env.RATE_LIMIT_POINTS || '1000'),
    duration: parseInt(process.env.RATE_LIMIT_DURATION || '3600'),
    blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '300'),
    
    keyGenerator: (context) => {
      // Multi-factor key generation
      const apiKey = context.headers['x-api-key'];
      const userId = context.user?.id;
      const tenantId = context.headers['x-tenant-id'];
      
      if (tenantId && userId) return `tenant:${tenantId}:user:${userId}`;
      if (apiKey) return `api:${apiKey}`;
      if (userId) return `user:${userId}`;
      return `ip:${context.ip}`;
    },
    
    customHeaders: {
      'X-RateLimit-Policy': process.env.RATE_LIMIT_POLICY || 'standard',
      'X-Service-Version': process.env.APP_VERSION || '1.0.0'
    }
  },
  
  circuitBreaker: {
    enabled: true,
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '5000'),
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '50'),
    volumeThreshold: parseInt(process.env.CIRCUIT_BREAKER_VOLUME || '10'),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
    
    fallback: async (error, context) => {
      // Log circuit breaker activation
      logger.warn('Circuit breaker activated', {
        path: context.path,
        error: error.message,
        timestamp: Date.now()
      });
      
      // Increment circuit breaker metrics
      metrics.increment('circuit_breaker_fallback', 1, {
        path: context.path,
        service: process.env.SERVICE_NAME
      });
      
      return {
        error: 'Service temporarily unavailable',
        retryAfter: 30,
        timestamp: Date.now()
      };
    }
  },
  
  overload: {
    enabled: true,
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '100'),
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '1000'),
    queueTimeout: parseInt(process.env.QUEUE_TIMEOUT || '30000'),
    shedStrategy: (process.env.SHED_STRATEGY as any) || 'priority',
    
    healthIndicator: async () => {
      try {
        const [cpu, memory, dbConnections] = await Promise.all([
          getCpuUsage(),
          getMemoryUsage(),
          getDatabaseConnectionCount()
        ]);
        
        // Calculate health score (0-1)
        const health = 1 - Math.max(
          cpu / 100,
          memory / 100,
          dbConnections / maxDbConnections
        );
        
        return Math.max(0, Math.min(1, health));
      } catch (error) {
        logger.error('Health check failed', error);
        return 0.5; // Default moderate health
      }
    },
    
    adaptiveThreshold: {
      enabled: true,
      minThreshold: parseInt(process.env.ADAPTIVE_MIN_THRESHOLD || '50'),
      maxThreshold: parseInt(process.env.ADAPTIVE_MAX_THRESHOLD || '200'),
      adjustmentInterval: parseInt(process.env.ADAPTIVE_INTERVAL || '5000')
    }
  },
  
  metrics: {
    enabled: true,
    type: (process.env.METRICS_TYPE as any) || 'prometheus',
    prefix: `${process.env.SERVICE_NAME || 'api'}_`,
    labels: {
      service: process.env.SERVICE_NAME || 'api',
      environment: process.env.NODE_ENV || 'production',
      version: process.env.APP_VERSION || '1.0.0',
      region: process.env.AWS_REGION || 'us-east-1',
      pod: process.env.HOSTNAME || 'unknown'
    }
  },
  
  advanced: {
    distributedSync: {
      enabled: true,
      nodeId: process.env.HOSTNAME || process.env.POD_NAME || 'node-1',
      syncInterval: 5000,
      
      onNodeJoin: (nodeId) => {
        logger.info('Node joined cluster', { nodeId });
        metrics.increment('cluster_node_join', 1, { nodeId });
      },
      
      onNodeLeave: (nodeId) => {
        logger.info('Node left cluster', { nodeId });
        metrics.increment('cluster_node_leave', 1, { nodeId });
      }
    },
    
    gracefulShutdown: {
      enabled: true,
      timeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000'),
      
      beforeShutdown: async () => {
        logger.info('Starting graceful shutdown');
        
        // Stop health checks
        await healthService.stop();
        
        // Notify load balancer
        await notifyLoadBalancer('draining');
        
        // Wait for connections to drain
        await wait(5000);
      },
      
      onShutdown: async () => {
        logger.info('Shutdown complete');
        await metrics.flush();
      }
    }
  }
};
```

### Environment Variables

Create a comprehensive `.env` file for production:

```bash
# Application
NODE_ENV=production
APP_NAME=api-service
APP_VERSION=1.2.3
SERVICE_NAME=api

# Redis Configuration
REDIS_HOST=redis.production.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_POINTS=1000
RATE_LIMIT_DURATION=3600
RATE_LIMIT_BLOCK_DURATION=300
RATE_LIMIT_POLICY=production

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=5000
CIRCUIT_BREAKER_THRESHOLD=50
CIRCUIT_BREAKER_VOLUME=10
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Overload Protection
MAX_CONCURRENT_REQUESTS=100
MAX_QUEUE_SIZE=1000
QUEUE_TIMEOUT=30000
SHED_STRATEGY=priority

# Adaptive Thresholds
ADAPTIVE_MIN_THRESHOLD=50
ADAPTIVE_MAX_THRESHOLD=200
ADAPTIVE_INTERVAL=5000

# Metrics
METRICS_ENABLED=true
METRICS_TYPE=prometheus

# Monitoring
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_API_KEY=your-pagerduty-key

# Security
JWT_SECRET=your-jwt-secret
API_KEY_SALT=your-api-key-salt

# Infrastructure
AWS_REGION=us-east-1
HOSTNAME=api-server-01
```

## Storage Backends

### Redis Configuration

**High Availability Redis Setup**

```yaml
# redis-cluster.yml
version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --replica-read-only no
    ports:
      - "6379:6379"
    volumes:
      - redis_master_data:/data
    environment:
      - REDIS_REPLICATION_MODE=master

  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --appendonly yes --slaveof redis-master 6379
    volumes:
      - redis_replica1_data:/data
    depends_on:
      - redis-master

  redis-replica-2:
    image: redis:7-alpine
    command: redis-server --appendonly yes --slaveof redis-master 6379
    volumes:
      - redis_replica2_data:/data
    depends_on:
      - redis-master

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master

volumes:
  redis_master_data:
  redis_replica1_data:
  redis_replica2_data:
```

**Redis Sentinel Configuration**

```conf
# sentinel.conf
port 26379
sentinel monitor mymaster redis-master 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1
```

**Application Redis Configuration**

```typescript
// redis.config.ts
export const redisConfig = {
  sentinels: [
    { host: 'sentinel-1', port: 26379 },
    { host: 'sentinel-2', port: 26379 },
    { host: 'sentinel-3', port: 26379 }
  ],
  name: 'mymaster',
  
  // Connection options
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  
  // Performance tuning
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  
  // Security
  password: process.env.REDIS_PASSWORD,
  
  // Monitoring
  showFriendlyErrorStack: process.env.NODE_ENV === 'development'
};
```

### Memcached Configuration

```typescript
// memcached.config.ts
export const memcachedConfig = {
  servers: [
    'memcached-1:11211',
    'memcached-2:11211',
    'memcached-3:11211'
  ],
  options: {
    retries: 10,
    retry: 10000,
    remove: true,
    failOverServers: [
      'memcached-backup-1:11211',
      'memcached-backup-2:11211'
    ],
    reconnect: 18000000,
    timeout: 5000,
    idle: 5000
  }
};
```

## Monitoring & Alerting

### Prometheus Configuration

**prometheus.yml**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "shield_rules.yml"

scrape_configs:
  - job_name: 'nest-shield-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

**Alert Rules (shield_rules.yml)**
```yaml
groups:
  - name: nest-shield
    rules:
      # High rate limit violations
      - alert: HighRateLimitViolations
        expr: rate(nestshield_rate_limit_exceeded_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High rate limit violations detected"
          description: "Rate limit violations are {{ $value }} per second"

      # Circuit breaker open
      - alert: CircuitBreakerOpen
        expr: nestshield_circuit_breaker_state{state="open"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker is open"
          description: "Circuit breaker {{ $labels.key }} is open"

      # High queue size
      - alert: HighQueueSize
        expr: nestshield_overload_queue_size > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Request queue is getting full"
          description: "Queue size is {{ $value }}"

      # Low health score
      - alert: LowHealthScore
        expr: nestshield_overload_health_score < 0.3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "System health is degraded"
          description: "Health score is {{ $value }}"

      # Redis connection issues
      - alert: RedisConnectionFailed
        expr: nestshield_storage_errors_total > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis connection issues detected"
          description: "Storage errors detected"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "NestShield Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(nestshield_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Rate Limit Violations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(nestshield_rate_limit_exceeded_total[5m])",
            "legendFormat": "Violations/sec"
          }
        ]
      },
      {
        "title": "Circuit Breaker States",
        "type": "stat",
        "targets": [
          {
            "expr": "nestshield_circuit_breaker_state",
            "legendFormat": "{{key}} - {{state}}"
          }
        ]
      },
      {
        "title": "Queue Metrics",
        "type": "graph",
        "targets": [
          {
            "expr": "nestshield_overload_queue_size",
            "legendFormat": "Queue Size"
          },
          {
            "expr": "nestshield_overload_concurrent_requests",
            "legendFormat": "Concurrent Requests"
          }
        ]
      }
    ]
  }
}
```

## Performance Optimization

### Application-Level Optimization

```typescript
// performance.config.ts
export const performanceConfig = {
  // Connection pooling
  redis: {
    family: 4,
    keepAlive: true,
    keepAliveInitialDelay: 0,
    
    // Pool settings
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    
    // Memory optimization
    keyPrefix: 'shield:',
    compression: 'gzip',
    
    // Performance monitoring
    monitorCommands: true,
    enableReadyCheck: true
  },
  
  // Memory management
  nodeOptions: [
    '--max-old-space-size=2048',
    '--gc-interval=100',
    '--optimize-for-size'
  ],
  
  // Cluster mode
  cluster: {
    enabled: process.env.NODE_ENV === 'production',
    workers: process.env.CLUSTER_WORKERS || 0, // 0 = auto (CPU cores)
    maxMemory: '1GB'
  }
};
```

### Resource Limits

```yaml
# kubernetes resource limits
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# JVM-style tuning for Node.js
env:
  - name: NODE_OPTIONS
    value: "--max-old-space-size=512 --gc-interval=100"
```

### Caching Strategy

```typescript
// caching.service.ts
@Injectable()
export class CachingService {
  private readonly cache = new Map<string, { value: any; expires: number }>();
  
  // Cache expensive operations
  @CircuitBreaker({
    timeout: 5000,
    fallback: async (error, context) => {
      // Return cached data on circuit breaker open
      return this.getCached(context.path) || { error: 'Service unavailable' };
    }
  })
  async getExpensiveData(key: string) {
    const cached = this.getCached(key);
    if (cached) return cached;
    
    const data = await this.fetchExpensiveData(key);
    this.setCached(key, data, 300000); // 5 minutes
    
    return data;
  }
  
  private getCached(key: string) {
    const item = this.cache.get(key);
    if (item && item.expires > Date.now()) {
      return item.value;
    }
    this.cache.delete(key);
    return null;
  }
  
  private setCached(key: string, value: any, ttl: number) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }
}
```

## Security Considerations

### API Key Management

```typescript
// security.config.ts
export const securityConfig = {
  apiKeys: {
    // Hash API keys in storage
    hashAlgorithm: 'sha256',
    salt: process.env.API_KEY_SALT,
    
    // Key rotation
    rotationInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
    
    // Rate limiting per key
    defaultLimits: {
      free: { points: 1000, duration: 3600 },
      pro: { points: 10000, duration: 3600 },
      enterprise: { points: 100000, duration: 3600 }
    }
  },
  
  // IP whitelisting
  trustedProxies: [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ],
  
  // Security headers
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
};
```

### Secure Configuration

```typescript
// config validation
export function validateSecureConfig(config: IShieldConfig): void {
  const issues: string[] = [];
  
  // Check for insecure defaults
  if (config.rateLimit?.points && config.rateLimit.points > 10000) {
    issues.push('Rate limit might be too high for security');
  }
  
  // Validate storage security
  if (config.storage?.type === 'redis' && !config.storage.options?.password) {
    issues.push('Redis should use authentication in production');
  }
  
  // Check metrics exposure
  if (config.metrics?.enabled && !config.metrics.options?.authentication) {
    issues.push('Metrics endpoint should be protected');
  }
  
  if (issues.length > 0) {
    logger.warn('Security configuration issues found', { issues });
  }
}
```

## High Availability

### Load Balancer Configuration

**NGINX Configuration**
```nginx
upstream nest_shield_app {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.example.com;
    
    # Rate limiting at load balancer level
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req zone=api burst=20 nodelay;
    
    location / {
        proxy_pass http://nest_shield_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Health checks
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
    
    location /health {
        proxy_pass http://nest_shield_app/health;
        access_log off;
    }
}
```

### Database High Availability

```typescript
// database.config.ts
export const databaseConfig = {
  // Primary database
  primary: {
    host: process.env.DB_PRIMARY_HOST,
    port: parseInt(process.env.DB_PRIMARY_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    
    // Connection pooling
    pool: {
      min: 5,
      max: 20,
      acquire: 30000,
      idle: 10000
    }
  },
  
  // Read replicas
  replicas: [
    {
      host: process.env.DB_REPLICA1_HOST,
      port: parseInt(process.env.DB_REPLICA1_PORT || '5432')
    },
    {
      host: process.env.DB_REPLICA2_HOST,
      port: parseInt(process.env.DB_REPLICA2_PORT || '5432')
    }
  ],
  
  // Failover configuration
  failover: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 5000
  }
};
```

## Troubleshooting

### Common Production Issues

**1. Memory Leaks**
```typescript
// memory-monitor.service.ts
@Injectable()
export class MemoryMonitorService {
  private memoryUsage = new Map<string, number>();
  
  @Cron('*/30 * * * * *') // Every 30 seconds
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    
    // Track memory growth
    const key = Date.now().toString();
    this.memoryUsage.set(key, usage.heapUsed);
    
    // Clean old entries
    const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes
    for (const [timestamp] of this.memoryUsage) {
      if (parseInt(timestamp) < cutoff) {
        this.memoryUsage.delete(timestamp);
      }
    }
    
    // Check for memory leaks
    if (this.memoryUsage.size > 1) {
      const values = Array.from(this.memoryUsage.values());
      const growth = values[values.length - 1] - values[0];
      const growthRate = growth / values.length;
      
      if (growthRate > 1024 * 1024) { // 1MB per measurement
        logger.warn('Potential memory leak detected', {
          growthRate: Math.round(growthRate / 1024) + 'KB per 30s',
          currentUsage: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
        });
      }
    }
  }
}
```

**2. Redis Connection Issues**
```typescript
// redis-health.service.ts
@Injectable()
export class RedisHealthService {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}
  
  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }
  
  async getConnectionInfo() {
    try {
      const info = await this.redis.info('clients');
      const lines = info.split('\r\n');
      const stats = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get Redis connection info', error);
      return null;
    }
  }
}
```

**3. Performance Monitoring**
```typescript
// performance-monitor.service.ts
@Injectable()
export class PerformanceMonitorService {
  private readonly performanceLog = new Array<{
    timestamp: number;
    endpoint: string;
    duration: number;
    statusCode: number;
  }>();
  
  logRequest(endpoint: string, duration: number, statusCode: number) {
    this.performanceLog.push({
      timestamp: Date.now(),
      endpoint,
      duration,
      statusCode
    });
    
    // Keep only last 1000 entries
    if (this.performanceLog.length > 1000) {
      this.performanceLog.splice(0, 100);
    }
    
    // Alert on slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        endpoint,
        duration,
        statusCode
      });
    }
  }
  
  getPerformanceStats() {
    const recent = this.performanceLog.filter(
      entry => Date.now() - entry.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );
    
    if (recent.length === 0) return null;
    
    const durations = recent.map(entry => entry.duration);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
    
    return {
      requestCount: recent.length,
      averageResponseTime: Math.round(avg),
      p95ResponseTime: p95,
      errorRate: recent.filter(entry => entry.statusCode >= 400).length / recent.length
    };
  }
}
```

### Health Check Endpoints

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisHealth: RedisHealthService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly circuitBreakerService: CircuitBreakerService
  ) {}
  
  @Get()
  @BypassShield()
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION
    };
  }
  
  @Get('ready')
  @BypassShield()
  async readinessCheck() {
    const checks = await Promise.allSettled([
      this.redisHealth.checkHealth(),
      this.checkDatabaseConnection(),
      this.checkExternalServices()
    ]);
    
    const isReady = checks.every(check => 
      check.status === 'fulfilled' && check.value === true
    );
    
    return {
      ready: isReady,
      checks: {
        redis: checks[0].status === 'fulfilled' ? checks[0].value : false,
        database: checks[1].status === 'fulfilled' ? checks[1].value : false,
        external: checks[2].status === 'fulfilled' ? checks[2].value : false
      }
    };
  }
  
  @Get('metrics')
  @BypassShield()
  async getMetrics() {
    return {
      performance: this.performanceMonitor.getPerformanceStats(),
      circuitBreakers: this.circuitBreakerService.getAllStats(),
      redis: await this.redisHealth.getConnectionInfo(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }
}
```

## Best Practices Summary

1. **Always use Redis/Memcached in production**
2. **Enable comprehensive monitoring and alerting**
3. **Set appropriate resource limits**
4. **Implement proper health checks**
5. **Use structured logging**
6. **Plan for graceful shutdown**
7. **Test under load before deployment**
8. **Monitor key metrics continuously**
9. **Have runbooks for common issues**
10. **Implement proper security measures**

---

<p align="center">
  Need help? <a href="https://discord.gg/nestshield">Join our Discord</a> • <a href="https://github.com/ali-master/nest-shield/issues">Report an Issue</a>
</p>