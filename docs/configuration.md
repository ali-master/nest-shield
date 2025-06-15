# Configuration Guide

<p align="center">
  <img src="../assets/logo.svg" alt="NestShield" width="120">
</p>

This comprehensive guide covers all configuration options available in NestShield.

## 📋 Table of Contents

- [Configuration Overview](#configuration-overview)
- [Module Configuration](#module-configuration)
- [Global Settings](#global-settings)
- [Protection Strategies](#protection-strategies)
- [Storage Configuration](#storage-configuration)
- [Metrics Configuration](#metrics-configuration)
- [Advanced Options](#advanced-options)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)

## Configuration Overview

NestShield can be configured at multiple levels:

1. **Module Level** - Global configuration via `ShieldModule.forRoot()`
2. **Class Level** - Controller-wide configuration via `@Shield()` decorator
3. **Method Level** - Endpoint-specific configuration via individual decorators
4. **Runtime Level** - Dynamic configuration via service methods

### Configuration Priority

Configuration follows this priority (highest to lowest):
1. Method-level decorators
2. Class-level decorators
3. Module-level configuration
4. Default values

## Module Configuration

### Basic Setup

```typescript
import { ShieldModule } from '@usex/nest-shield';

@Module({
  imports: [
    ShieldModule.forRoot({
      // Your configuration here
    })
  ]
})
export class AppModule {}
```

### Async Configuration

For dynamic configuration based on services or environment:

```typescript
@Module({
  imports: [
    ShieldModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        global: {
          enabled: config.get('SHIELD_ENABLED', true),
        },
        storage: {
          type: config.get('STORAGE_TYPE', 'memory'),
          options: {
            host: config.get('REDIS_HOST'),
            port: config.get('REDIS_PORT'),
          }
        }
      })
    })
  ]
})
export class AppModule {}
```

## Global Settings

### IShieldConfig Interface

```typescript
interface IShieldConfig {
  global?: {
    enabled?: boolean;              // Enable/disable all protection
    bypassForDevelopment?: boolean; // Auto-disable in development
    errorHandler?: (error: Error) => void;
    defaultKeyGenerator?: (context: IProtectionContext) => string;
  };
  
  rateLimit?: IRateLimitConfig;
  throttle?: IThrottleConfig;
  circuitBreaker?: ICircuitBreakerConfig;
  overload?: IOverloadConfig;
  storage?: IStorageConfig;
  metrics?: IMetricsConfig;
  advanced?: IAdvancedConfig;
}
```

### Global Options Explained

```typescript
ShieldModule.forRoot({
  global: {
    // Master switch for all protection features
    enabled: true,
    
    // Automatically disable in development environment
    bypassForDevelopment: process.env.NODE_ENV === 'development',
    
    // Custom error handling
    errorHandler: (error: Error) => {
      console.error('Shield Error:', error);
      // Send to error tracking service
      Sentry.captureException(error);
    },
    
    // Default key generator for all strategies
    defaultKeyGenerator: (context: IProtectionContext) => {
      // Use API key if available, otherwise IP
      return context.headers['x-api-key'] || context.ip;
    }
  }
})
```

## Protection Strategies

### Rate Limiting Configuration

```typescript
interface IRateLimitConfig {
  enabled?: boolean;
  points?: number;              // Number of requests allowed
  duration?: number;            // Time window in seconds
  blockDuration?: number;       // Block duration for exceeded limits
  keyGenerator?: (context: IProtectionContext) => string;
  customResponseMessage?: (context: IProtectionContext) => string;
  customHeaders?: Record<string, string>;
  ignoreUserAgents?: RegExp[];
  skipIf?: (context: IProtectionContext) => boolean;
}
```

#### Example Configuration

```typescript
rateLimit: {
  enabled: true,
  points: 100,
  duration: 60, // 100 requests per minute
  blockDuration: 60, // Block for 60 seconds when exceeded
  
  // Custom key generation
  keyGenerator: (context) => {
    const userId = context.user?.id;
    const apiKey = context.headers['x-api-key'];
    
    if (userId) return `user:${userId}`;
    if (apiKey) return `api:${apiKey}`;
    return `ip:${context.ip}`;
  },
  
  // Custom error message
  customResponseMessage: (context) => {
    return `Rate limit exceeded. Try again in ${context.retryAfter} seconds.`;
  },
  
  // Additional headers
  customHeaders: {
    'X-RateLimit-Policy': 'standard',
    'X-RateLimit-Service': 'api-v1'
  },
  
  // Ignore certain user agents
  ignoreUserAgents: [
    /googlebot/i,
    /bingbot/i,
    /monitoring/i
  ],
  
  // Skip rate limiting conditionally
  skipIf: (context) => {
    return context.user?.role === 'admin' || 
           context.headers['x-bypass-key'] === process.env.BYPASS_KEY;
  }
}
```

### Throttling Configuration

```typescript
interface IThrottleConfig {
  enabled?: boolean;
  limit?: number;               // Number of requests
  ttl?: number;                 // Time window in seconds
  keyGenerator?: (context: IProtectionContext) => string;
  customResponseMessage?: (context: IProtectionContext) => string;
  ignoreUserAgents?: RegExp[];
  skipIf?: (context: IProtectionContext) => boolean;
}
```

#### Example Configuration

```typescript
throttle: {
  enabled: true,
  limit: 10,
  ttl: 60, // Max 10 requests per minute
  
  // Different limits for different endpoints
  keyGenerator: (context) => {
    return `${context.method}:${context.path}:${context.ip}`;
  },
  
  // Skip throttling for premium users
  skipIf: (context) => {
    return context.user?.subscription === 'premium';
  }
}
```

### Circuit Breaker Configuration

```typescript
interface ICircuitBreakerConfig {
  enabled?: boolean;
  timeout?: number;                    // Request timeout in ms
  errorThresholdPercentage?: number;   // Error percentage to open circuit
  volumeThreshold?: number;            // Minimum requests before opening
  resetTimeout?: number;               // Time before trying again (ms)
  rollingCountTimeout?: number;        // Rolling window for metrics (ms)
  fallback?: (error: Error, context: IProtectionContext) => any;
  healthCheck?: () => Promise<boolean>;
  halfOpenRequestCount?: number;
  allowWarmUp?: boolean;
}
```

#### Example Configuration

```typescript
circuitBreaker: {
  enabled: true,
  timeout: 5000, // 5 second timeout
  errorThresholdPercentage: 50, // Open if 50% of requests fail
  volumeThreshold: 10, // Need at least 10 requests
  resetTimeout: 30000, // Try again after 30 seconds
  
  // Fallback response
  fallback: async (error, context) => {
    console.error(`Circuit opened for ${context.path}:`, error);
    
    // Return cached data or default response
    return {
      data: await cacheService.get(context.path) || [],
      cached: true,
      error: 'Service temporarily unavailable'
    };
  },
  
  // Health check function
  healthCheck: async () => {
    try {
      const response = await fetch('http://service/health');
      return response.ok;
    } catch {
      return false;
    }
  },
  
  // Allow warm-up requests
  allowWarmUp: true,
  halfOpenRequestCount: 3
}
```

### Overload Protection Configuration

```typescript
interface IOverloadConfig {
  enabled?: boolean;
  maxConcurrentRequests?: number;
  maxQueueSize?: number;
  queueTimeout?: number;
  shedStrategy?: ShedStrategy;
  priorityFunction?: (context: IProtectionContext) => number;
  healthIndicator?: () => Promise<number>;
  adaptiveThreshold?: {
    enabled: boolean;
    minThreshold: number;
    maxThreshold: number;
    adjustmentInterval: number;
  };
}
```

#### Example Configuration

```typescript
overload: {
  enabled: true,
  maxConcurrentRequests: 100,
  maxQueueSize: 1000,
  queueTimeout: 30000, // 30 seconds
  shedStrategy: ShedStrategy.PRIORITY,
  
  // Custom priority calculation
  priorityFunction: (context) => {
    // Higher priority for authenticated users
    if (context.user) {
      switch (context.user.tier) {
        case 'enterprise': return 10;
        case 'pro': return 5;
        case 'free': return 2;
      }
    }
    
    // Priority based on endpoint
    if (context.path.includes('/critical')) return 8;
    if (context.path.includes('/admin')) return 7;
    
    return 1; // Default priority
  },
  
  // Health indicator for adaptive threshold
  healthIndicator: async () => {
    const cpu = await getCpuUsage();
    const memory = await getMemoryUsage();
    const dbConnections = await getDbConnectionCount();
    
    // Return health score between 0 and 1
    const health = 1 - Math.max(
      cpu / 100,
      memory / 100,
      dbConnections / maxDbConnections
    );
    
    return Math.max(0, Math.min(1, health));
  },
  
  // Adaptive threshold configuration
  adaptiveThreshold: {
    enabled: true,
    minThreshold: 50,
    maxThreshold: 200,
    adjustmentInterval: 5000 // Adjust every 5 seconds
  }
}
```

## Storage Configuration

### Storage Types

```typescript
type StorageType = 'memory' | 'redis' | 'memcached' | 'custom';

interface IStorageConfig {
  type: StorageType;
  options?: any;
  keyPrefix?: string;
  ttl?: number;
}
```

### Memory Storage (Default)

```typescript
storage: {
  type: 'memory',
  options: {
    maxKeys: 10000,          // Maximum number of keys
    stdTTL: 0,              // Default TTL (0 = no expiration)
    checkperiod: 600,       // Cleanup interval in seconds
    useClones: false,       // Clone values (impacts performance)
  }
}
```

### Redis Storage

```typescript
storage: {
  type: 'redis',
  keyPrefix: 'shield:prod:', // Prefix for all keys
  options: {
    // Using redis package
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0,
    
    // Connection options
    enableOfflineQueue: true,
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
    
    // Cluster mode
    // nodes: [
    //   { host: 'node1', port: 6379 },
    //   { host: 'node2', port: 6379 }
    // ],
    
    // Using existing client
    // client: existingRedisClient
  }
}
```

### Memcached Storage

```typescript
storage: {
  type: 'memcached',
  keyPrefix: 'shield:',
  options: {
    servers: ['localhost:11211', 'localhost:11212'],
    options: {
      retries: 10,
      retry: 10000,
      remove: true,
      failOverServers: ['192.168.1.100:11211']
    }
  }
}
```

### Custom Storage

```typescript
import { IStorageAdapter } from '@usex/nest-shield';

class CustomStorage implements IStorageAdapter {
  // Implement required methods
}

storage: {
  type: 'custom',
  options: {
    adapter: new CustomStorage()
  }
}
```

## Metrics Configuration

### Metrics Types

```typescript
type MetricsType = 'prometheus' | 'statsd' | 'cloudwatch' | 'datadog' | 'custom';

interface IMetricsConfig {
  enabled?: boolean;
  type?: MetricsType;
  prefix?: string;
  labels?: Record<string, string>;
  options?: any;
}
```

### Prometheus Metrics

```typescript
metrics: {
  enabled: true,
  type: 'prometheus',
  prefix: 'nestshield_',
  labels: {
    app: 'my-api',
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  options: {
    register: promClient.register, // Optional: use existing registry
    defaultLabels: {
      service: 'api'
    }
  }
}
```

### StatsD Metrics

```typescript
metrics: {
  enabled: true,
  type: 'statsd',
  prefix: 'api.',
  options: {
    host: 'localhost',
    port: 8125,
    cacheDns: true,
    globalTags: {
      env: process.env.NODE_ENV
    }
  }
}
```

### CloudWatch Metrics

```typescript
metrics: {
  enabled: true,
  type: 'cloudwatch',
  options: {
    namespace: 'MyApp/API',
    region: 'us-east-1',
    dimensions: [
      { Name: 'Environment', Value: process.env.NODE_ENV },
      { Name: 'Service', Value: 'api' }
    ]
  }
}
```

## Advanced Options

### Distributed Synchronization

```typescript
advanced: {
  distributedSync: {
    enabled: true,
    nodeId: process.env.HOSTNAME || 'node-1',
    syncInterval: 5000,
    redis: {
      // Redis connection for sync
      host: 'localhost',
      port: 6379
    },
    onNodeJoin: (nodeId: string) => {
      console.log(`Node ${nodeId} joined the cluster`);
    },
    onNodeLeave: (nodeId: string) => {
      console.log(`Node ${nodeId} left the cluster`);
    },
    onSyncError: (error: Error) => {
      console.error('Sync error:', error);
    }
  }
}
```

### Graceful Shutdown

```typescript
advanced: {
  gracefulShutdown: {
    enabled: true,
    timeout: 30000, // 30 seconds to drain requests
    signals: ['SIGTERM', 'SIGINT'],
    
    beforeShutdown: async () => {
      console.log('Starting graceful shutdown...');
      
      // Save state
      await saveApplicationState();
      
      // Notify external services
      await notifyShutdown();
    },
    
    onShutdown: async () => {
      console.log('Shutdown complete');
    }
  }
}
```

### Anomaly Detection

```typescript
advanced: {
  anomalyDetection: {
    enabled: true,
    detectors: ['statistical', 'ml'],
    sensitivity: 0.8,
    windowSize: 3600, // 1 hour
    
    onAnomaly: async (anomaly) => {
      console.error('Anomaly detected:', anomaly);
      
      // Send alert
      await alertService.send({
        type: 'anomaly',
        severity: anomaly.severity,
        data: anomaly
      });
    }
  }
}
```

## Environment Variables

### Supported Environment Variables

```bash
# General
SHIELD_ENABLED=true
SHIELD_ENV=production

# Storage
SHIELD_STORAGE_TYPE=redis
SHIELD_REDIS_HOST=localhost
SHIELD_REDIS_PORT=6379
SHIELD_REDIS_PASSWORD=secret

# Rate Limiting
SHIELD_RATE_LIMIT_POINTS=100
SHIELD_RATE_LIMIT_DURATION=60

# Circuit Breaker
SHIELD_CIRCUIT_BREAKER_TIMEOUT=5000
SHIELD_CIRCUIT_BREAKER_THRESHOLD=50

# Metrics
SHIELD_METRICS_ENABLED=true
SHIELD_METRICS_TYPE=prometheus

# Advanced
SHIELD_DISTRIBUTED_SYNC=true
SHIELD_NODE_ID=api-server-1
```

### Using Environment Variables

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';

ShieldModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    global: {
      enabled: config.get('SHIELD_ENABLED', true),
    },
    storage: {
      type: config.get('SHIELD_STORAGE_TYPE', 'memory'),
      options: {
        host: config.get('SHIELD_REDIS_HOST'),
        port: config.get('SHIELD_REDIS_PORT'),
        password: config.get('SHIELD_REDIS_PASSWORD'),
      }
    },
    rateLimit: {
      points: config.get('SHIELD_RATE_LIMIT_POINTS', 100),
      duration: config.get('SHIELD_RATE_LIMIT_DURATION', 60),
    },
    circuitBreaker: {
      timeout: config.get('SHIELD_CIRCUIT_BREAKER_TIMEOUT', 5000),
      errorThresholdPercentage: config.get('SHIELD_CIRCUIT_BREAKER_THRESHOLD', 50),
    }
  })
})
```

## Configuration Examples

### Development Configuration

```typescript
// config/shield.development.ts
export const developmentConfig: IShieldConfig = {
  global: {
    enabled: true,
    bypassForDevelopment: true,
    errorHandler: (error) => console.error('[Shield Dev]', error)
  },
  storage: {
    type: 'memory'
  },
  rateLimit: {
    points: 1000,
    duration: 60
  },
  metrics: {
    enabled: false
  }
};
```

### Production Configuration

```typescript
// config/shield.production.ts
export const productionConfig: IShieldConfig = {
  global: {
    enabled: true,
    bypassForDevelopment: false,
    errorHandler: (error) => {
      logger.error('Shield error', error);
      Sentry.captureException(error);
    }
  },
  storage: {
    type: 'redis',
    keyPrefix: 'shield:prod:',
    options: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      db: 2
    }
  },
  rateLimit: {
    enabled: true,
    points: 100,
    duration: 60,
    blockDuration: 300
  },
  throttle: {
    enabled: true,
    limit: 10,
    ttl: 60
  },
  circuitBreaker: {
    enabled: true,
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  },
  overload: {
    enabled: true,
    maxConcurrentRequests: 100,
    maxQueueSize: 1000,
    adaptiveThreshold: {
      enabled: true,
      minThreshold: 50,
      maxThreshold: 200,
      adjustmentInterval: 5000
    }
  },
  metrics: {
    enabled: true,
    type: 'prometheus',
    prefix: 'api_',
    labels: {
      app: 'my-api',
      env: 'production'
    }
  },
  advanced: {
    distributedSync: {
      enabled: true,
      nodeId: process.env.HOSTNAME
    },
    gracefulShutdown: {
      enabled: true,
      timeout: 30000
    }
  }
};
```

### Multi-Tenant Configuration

```typescript
// For SaaS applications with different tenant limits
const multiTenantConfig: IShieldConfig = {
  rateLimit: {
    keyGenerator: (context) => {
      const tenantId = context.headers['x-tenant-id'];
      const userId = context.user?.id;
      return `tenant:${tenantId}:user:${userId}`;
    },
    points: 100, // Default
    duration: 60,
    // Override in decorators based on tenant plan
  },
  overload: {
    priorityFunction: (context) => {
      const tenant = context.headers['x-tenant-id'];
      const tenantPriority = {
        'enterprise-tenant': 10,
        'pro-tenant': 5,
        'free-tenant': 1
      };
      return tenantPriority[tenant] || 1;
    }
  }
};
```

## Validation and Defaults

NestShield validates all configuration options and applies sensible defaults:

### Default Values

```typescript
const DEFAULT_CONFIG: IShieldConfig = {
  global: {
    enabled: true,
    bypassForDevelopment: false
  },
  rateLimit: {
    enabled: true,
    points: 10,
    duration: 60
  },
  throttle: {
    enabled: true,
    limit: 5,
    ttl: 60
  },
  circuitBreaker: {
    enabled: true,
    timeout: 3000,
    errorThresholdPercentage: 50,
    volumeThreshold: 10,
    resetTimeout: 30000
  },
  overload: {
    enabled: true,
    maxConcurrentRequests: 100,
    maxQueueSize: 1000,
    queueTimeout: 30000,
    shedStrategy: ShedStrategy.FIFO
  },
  storage: {
    type: 'memory',
    keyPrefix: 'shield:'
  },
  metrics: {
    enabled: false,
    type: 'prometheus',
    prefix: 'nestshield_'
  }
};
```

## Best Practices

1. **Use Environment-Specific Configs**: Different settings for dev/staging/production
2. **Monitor Your Limits**: Start conservative and adjust based on metrics
3. **Use Redis in Production**: For multi-instance deployments
4. **Enable Metrics**: Essential for monitoring and alerting
5. **Set Up Graceful Shutdown**: For zero-downtime deployments
6. **Use Circuit Breakers**: For all external service calls
7. **Configure Fallbacks**: Provide degraded service instead of errors
8. **Regular Reviews**: Review and adjust limits based on usage patterns

## Next Steps

- [Storage Backends](./storage/index.md) - Deep dive into storage options
- [Metrics & Monitoring](./features/metrics.md) - Set up observability
- [Advanced Usage](./advanced/index.md) - Custom strategies and extensions
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ali-master">Ali Torki</a> and the open source community
</p>
