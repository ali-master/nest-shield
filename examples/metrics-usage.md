# Comprehensive Metrics Usage Guide

This guide demonstrates how to use the complete metrics system in NestShield.

## Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { ShieldModule } from '@usex/nest-shield';

@Module({
  imports: [
    ShieldModule.forRoot({
      metrics: {
        enabled: true,
        type: 'prometheus', // 'prometheus', 'statsd', 'datadog', 'cloudwatch', 'custom'
        prefix: 'my_app',
        labels: {
          service: 'api',
          version: '1.0.0',
          environment: process.env.NODE_ENV,
        },
        buckets: [0.1, 0.5, 1, 2, 5, 10], // Histogram buckets
        percentiles: [50, 90, 95, 99], // Summary percentiles
        flushInterval: 5000, // For push-based collectors
        windowSize: 60000, // Time window for aggregation (1 minute)
        maxWindows: 60, // Keep 60 windows (1 hour of data)
        rollingWindowSize: 300000, // Rolling window size (5 minutes)
      }
    }),
  ],
})
export class AppModule {}
```

## Using Different Collectors

### 1. Prometheus Collector

```typescript
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'prometheus',
    prefix: 'my_app',
    labels: { service: 'api' },
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    includeTimestamp: true,
    includeHelp: true,
  }
})

// Access metrics at /metrics endpoint
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: EnhancedMetricsService) {}

  @Get('/metrics')
  async getMetrics() {
    return this.metricsService.exportPrometheus();
  }

  @Get('/metrics/json')
  async getMetricsJson() {
    return this.metricsService.exportJson();
  }
}
```

### 2. StatsD Collector

```typescript
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'statsd',
    prefix: 'my_app',
    flushInterval: 1000,
    maxBufferSize: 100,
    collectorOptions: {
      host: 'statsd.example.com',
      port: 8125,
      globalTags: ['env:production'],
    }
  }
})
```

### 3. Datadog Collector

```typescript
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'datadog',
    prefix: 'my_app',
    flushInterval: 5000,
    collectorOptions: {
      host: 'localhost',
      port: 8125,
      env: 'production',
      service: 'my-api',
      version: '1.0.0',
    }
  }
})

// Datadog-specific features
@Injectable()
export class DatadogMetricsService {
  constructor(
    @Inject('METRICS_COLLECTOR') private collector: DatadogCollector
  ) {}

  trackEvent(title: string, text: string) {
    this.collector.event(title, text, {
      alertType: 'info',
      tags: ['source:nestshield'],
    });
  }

  trackServiceHealth(status: 0 | 1 | 2 | 3) {
    this.collector.serviceCheck('api.health', status, {
      tags: ['service:api'],
      message: 'API health check',
    });
  }

  trackDistribution(metric: string, value: number) {
    this.collector.distribution(metric, value, {
      endpoint: '/api/users',
    });
  }
}
```

### 4. CloudWatch Collector

```typescript
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'cloudwatch',
    prefix: 'MyApp',
    flushInterval: 60000, // 1 minute
    collectorOptions: {
      region: 'us-east-1',
      namespace: 'MyApplication/API',
      batchSize: 20,
      storageResolution: 60, // Standard resolution
      dimensions: {
        Environment: 'production',
        Service: 'api',
      }
    }
  }
})
```

### 5. Custom Collector

```typescript
class MyCustomCollector implements IMetricsCollector {
  increment(metric: string, value?: number, labels?: Record<string, string>) {
    // Send to your custom metrics backend
    fetch('https://metrics.mycompany.com/api/increment', {
      method: 'POST',
      body: JSON.stringify({ metric, value, labels }),
    });
  }

  // ... implement other methods
}

ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'custom',
    customCollector: new MyCustomCollector(),
  }
})
```

## Advanced Usage Examples

### 1. Request Performance Tracking

```typescript
@Controller('api/users')
export class UsersController {
  constructor(private readonly metricsService: EnhancedMetricsService) {}

  @Get()
  async getUsers(@Query() query: any) {
    // Track request count
    this.metricsService.increment('http_requests_total', 1, {
      method: 'GET',
      endpoint: '/api/users',
      status: 'success',
    });

    // Track request duration
    const timer = this.metricsService.startTimer('http_request_duration', {
      method: 'GET',
      endpoint: '/api/users',
    });

    try {
      const users = await this.userService.findAll(query);
      
      // Track result size
      this.metricsService.histogram('response_size_bytes', 
        JSON.stringify(users).length, {
          endpoint: '/api/users',
        }
      );

      return users;
    } finally {
      timer(); // Record duration
    }
  }

  @Post()
  async createUser(@Body() userData: CreateUserDto) {
    this.metricsService.increment('users_created_total');
    
    try {
      const user = await this.userService.create(userData);
      
      this.metricsService.increment('http_requests_total', 1, {
        method: 'POST',
        endpoint: '/api/users',
        status: 'success',
      });
      
      return user;
    } catch (error) {
      this.metricsService.increment('http_requests_total', 1, {
        method: 'POST',
        endpoint: '/api/users',
        status: 'error',
        error_type: error.constructor.name,
      });
      throw error;
    }
  }
}
```

### 2. System Resource Monitoring

```typescript
@Injectable()
export class SystemMetricsService {
  constructor(private readonly metricsService: EnhancedMetricsService) {}

  @Cron('*/30 * * * * *') // Every 30 seconds
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.metricsService.gauge('memory_heap_used_bytes', memoryUsage.heapUsed);
    this.metricsService.gauge('memory_heap_total_bytes', memoryUsage.heapTotal);
    this.metricsService.gauge('memory_external_bytes', memoryUsage.external);
    this.metricsService.gauge('memory_rss_bytes', memoryUsage.rss);

    // CPU metrics (converted to percentage)
    this.metricsService.gauge('cpu_user_seconds', cpuUsage.user / 1000000);
    this.metricsService.gauge('cpu_system_seconds', cpuUsage.system / 1000000);

    // Process metrics
    this.metricsService.gauge('process_uptime_seconds', process.uptime());
  }
}
```

### 3. Business Metrics

```typescript
@Injectable()
export class BusinessMetricsService {
  constructor(private readonly metricsService: EnhancedMetricsService) {}

  trackUserRegistration(user: User) {
    this.metricsService.increment('user_registrations_total', 1, {
      source: user.registrationSource,
      plan: user.subscriptionPlan,
    });
  }

  trackPurchase(order: Order) {
    this.metricsService.increment('orders_total', 1, {
      product_category: order.category,
      payment_method: order.paymentMethod,
    });

    this.metricsService.histogram('order_value', order.totalAmount, {
      currency: order.currency,
      product_category: order.category,
    });

    this.metricsService.summary('order_processing_time', 
      order.processingTimeMs / 1000, {
        payment_method: order.paymentMethod,
      }
    );
  }

  trackSubscription(action: 'subscribe' | 'cancel' | 'upgrade' | 'downgrade', plan: string) {
    this.metricsService.increment(`subscription_${action}_total`, 1, {
      plan,
    });
  }
}
```

### 4. Advanced Analytics with Aggregators

```typescript
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly metricsService: EnhancedMetricsService) {}

  @Get('performance/:endpoint')
  getEndpointPerformance(@Param('endpoint') endpoint: string) {
    const stats = this.metricsService.getRollingStatistics(
      'http_request_duration',
      { endpoint }
    );

    const percentiles = this.metricsService.getPercentiles(
      'http_request_duration',
      { endpoint },
      [50, 90, 95, 99]
    );

    const timeSeries = this.metricsService.getTimeSeriesData(
      'http_request_duration',
      { endpoint },
      60 // Last 60 windows (1 hour if windows are 1 minute)
    );

    return {
      realtime: {
        ...stats,
        percentiles,
      },
      timeSeries,
      summary: {
        averageResponseTime: stats.average,
        requestRate: stats.rate,
        errorRate: this.calculateErrorRate(endpoint),
        trend: stats.trend,
      }
    };
  }

  @Get('system/health')
  getSystemHealth() {
    const cpuStats = this.metricsService.getRollingStatistics('cpu_usage_percent');
    const memoryStats = this.metricsService.getRollingStatistics('memory_usage_percent');
    const requestStats = this.metricsService.getRollingStatistics('http_requests_total');

    return {
      status: this.determineHealthStatus(cpuStats, memoryStats),
      cpu: {
        current: cpuStats.average,
        trend: cpuStats.trend,
        max: cpuStats.max,
      },
      memory: {
        current: memoryStats.average,
        trend: memoryStats.trend,
        max: memoryStats.max,
      },
      requests: {
        rate: requestStats.rate,
        trend: requestStats.trend,
      },
      timestamp: Date.now(),
    };
  }

  @Get('business/dashboard')
  getBusinessDashboard() {
    const userRegistrations = this.metricsService.getRollingStatistics('user_registrations_total');
    const orders = this.metricsService.getRollingStatistics('orders_total');
    const revenue = this.metricsService.getRollingStatistics('order_value');

    return {
      users: {
        registrationsPerHour: userRegistrations.rate * 3600,
        trend: userRegistrations.trend,
      },
      sales: {
        ordersPerHour: orders.rate * 3600,
        averageOrderValue: revenue.average,
        totalRevenue: revenue.sum,
        trend: orders.trend,
      },
      growth: {
        userGrowthRate: this.calculateGrowthRate('user_registrations_total'),
        revenueGrowthRate: this.calculateGrowthRate('order_value'),
      }
    };
  }

  private calculateErrorRate(endpoint: string): number {
    const successStats = this.metricsService.getRollingStatistics(
      'http_requests_total',
      { endpoint, status: 'success' }
    );
    const errorStats = this.metricsService.getRollingStatistics(
      'http_requests_total',
      { endpoint, status: 'error' }
    );

    const total = successStats.count + errorStats.count;
    return total > 0 ? (errorStats.count / total) * 100 : 0;
  }

  private determineHealthStatus(
    cpuStats: any, 
    memoryStats: any
  ): 'healthy' | 'warning' | 'critical' {
    if (cpuStats.average > 90 || memoryStats.average > 90) {
      return 'critical';
    }
    if (cpuStats.average > 70 || memoryStats.average > 80) {
      return 'warning';
    }
    return 'healthy';
  }

  private calculateGrowthRate(metric: string): number {
    const timeSeries = this.metricsService.getTimeSeriesData(metric, {}, 10);
    if (timeSeries.length < 2) return 0;

    const recent = timeSeries.slice(-5).reduce((sum, point) => sum + point.value, 0);
    const previous = timeSeries.slice(-10, -5).reduce((sum, point) => sum + point.value, 0);

    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  }
}
```

### 5. Custom Middleware for Automatic Tracking

```typescript
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: EnhancedMetricsService) {}

  use(req: any, res: any, next: () => void) {
    const start = Date.now();
    
    // Track active requests
    this.metricsService.increment('http_requests_active');

    const originalSend = res.send;
    res.send = function(data: any) {
      const duration = (Date.now() - start) / 1000;
      
      // Track request completion
      this.metricsService.decrement('http_requests_active');
      this.metricsService.increment('http_requests_total', 1, {
        method: req.method,
        status_code: res.statusCode.toString(),
        endpoint: req.route?.path || req.path,
      });
      
      // Track duration
      this.metricsService.histogram('http_request_duration_seconds', duration, {
        method: req.method,
        endpoint: req.route?.path || req.path,
      });
      
      // Track response size
      if (data) {
        const size = Buffer.isBuffer(data) ? data.length : JSON.stringify(data).length;
        this.metricsService.histogram('http_response_size_bytes', size, {
          endpoint: req.route?.path || req.path,
        });
      }

      return originalSend.call(this, data);
    }.bind(this);

    next();
  }
}

// Apply middleware globally
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware)
      .forRoutes('*');
  }
}
```

### 6. Metrics Health Check

```typescript
@Injectable()
export class MetricsHealthIndicator extends HealthIndicator {
  constructor(private readonly metricsService: EnhancedMetricsService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const health = this.metricsService.getHealth();
    
    const result = this.getStatus(key, health.status === 'healthy', {
      ...health.details,
    });

    if (health.status === 'unhealthy') {
      throw new HealthCheckError('Metrics service failed', result);
    }

    return result;
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private metricsHealth: MetricsHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.metricsHealth.isHealthy('metrics'),
    ]);
  }
}
```

## Export Formats

### Prometheus Format
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/api/users"} 1542

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_bucket{le="0.5"} 200
http_request_duration_seconds_sum 45.2
http_request_duration_seconds_count 250
```

### JSON Format
```json
{
  "timestamp": 1645123456789,
  "metrics": {
    "http_requests_total": {
      "type": "counter",
      "values": [
        {
          "value": 1542,
          "labels": {"method": "GET", "endpoint": "/api/users"},
          "timestamp": 1645123456789
        }
      ]
    }
  }
}
```

This comprehensive metrics system provides everything you need for monitoring, alerting, and analytics in production applications!