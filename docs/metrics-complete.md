# Complete Metrics System Documentation

## Overview

NestShield now includes a comprehensive metrics system with the following features:

### 🎯 Key Components

1. **Multiple Collectors**: Prometheus, StatsD, Datadog, CloudWatch, Custom
2. **Advanced Aggregators**: Time windows, rolling windows, percentile calculations
3. **Export Formats**: Prometheus, JSON, OpenMetrics
4. **Real-time Analytics**: Statistics, trends, health monitoring
5. **Production Ready**: Buffering, batching, error handling

### 📊 Supported Metric Types

- **Counter**: Incrementing values (requests, errors, events)
- **Gauge**: Current values (memory usage, active connections)
- **Histogram**: Distribution of values (request duration, response size)
- **Summary**: Statistical summaries with percentiles

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│ MetricsService   │───▶│   Collectors    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌──────────────────┐             │
                       │   Aggregators    │◀────────────┘
                       │                  │
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │    Exporters     │
                       │                  │
                       └──────────────────┘
```

## File Structure

```
src/metrics/
├── index.ts                           # Main exports
├── interfaces/
│   ├── metrics.interface.ts           # Core metric types
│   ├── collector.interface.ts         # Collector contracts
│   └── exporter.interface.ts          # Exporter contracts
├── collectors/
│   ├── base.collector.ts              # Abstract base collector
│   ├── prometheus.collector.ts        # Prometheus format collector
│   ├── statsd.collector.ts           # StatsD/UDP collector
│   ├── datadog.collector.ts          # Datadog extensions
│   ├── cloudwatch.collector.ts       # AWS CloudWatch collector
│   └── custom.collector.ts           # Custom implementation wrapper
├── aggregators/
│   ├── time-window.aggregator.ts     # Fixed time windows
│   ├── rolling-window.aggregator.ts  # Rolling statistics
│   └── percentile.aggregator.ts      # Efficient percentile calculation
├── exporters/
│   ├── prometheus.exporter.ts        # Prometheus format export
│   ├── json.exporter.ts             # JSON format export
│   └── openmetrics.exporter.ts      # OpenMetrics format export
└── metrics.module.ts                 # NestJS module integration
```

## Key Features

### 1. Multiple Backend Support

**Prometheus** (Pull-based)
- Native Prometheus format
- Automatic histogram buckets
- Summary percentiles
- Health check endpoint

**StatsD** (Push-based)
- UDP protocol
- Buffering and batching
- Configurable flush intervals
- Error handling

**Datadog** (StatsD + Extensions)
- Events and service checks
- Distribution metrics
- Tagging support
- Datadog-specific features

**CloudWatch** (AWS)
- Native CloudWatch metrics
- Batch sending
- Dimension support
- Custom namespaces

### 2. Advanced Aggregation

**Time Window Aggregator**
```typescript
// Aggregates metrics into fixed time windows (e.g., 1-minute buckets)
const timeSeries = metricsService.getTimeSeriesData('http_requests', {}, 60);
// Returns 60 data points (1 hour of 1-minute windows)
```

**Rolling Window Aggregator**
```typescript
// Real-time statistics over a rolling window (e.g., last 5 minutes)
const stats = metricsService.getRollingStatistics('response_time');
// Returns: count, sum, average, min, max, stdDev, rate, trend
```

**Percentile Aggregator**
```typescript
// Efficient percentile calculation using quantile sketches
const percentiles = metricsService.getPercentiles('latency', {}, [50, 90, 95, 99]);
// Returns p50, p90, p95, p99 values
```

### 3. Export Formats

**Prometheus Format**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/api/users"} 1542

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_sum 45.2
http_request_duration_seconds_count 250
```

**JSON Format**
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

### 4. Real-time Analytics

**Performance Monitoring**
```typescript
const endpointStats = metricsService.getRollingStatistics('http_request_duration', {
  endpoint: '/api/users'
});

console.log({
  averageResponseTime: endpointStats.average,
  requestRate: endpointStats.rate,
  trend: endpointStats.trend, // 'increasing' | 'decreasing' | 'stable'
  percentiles: endpointStats.percentiles,
});
```

**System Health**
```typescript
const health = metricsService.getHealth();
// Returns: { status: 'healthy' | 'unhealthy', details: {...} }
```

## Usage Examples

### Basic Setup
```typescript
import { ShieldModule } from '@usex/nest-shield';

@Module({
  imports: [
    ShieldModule.forRoot({
      metrics: {
        enabled: true,
        type: 'prometheus',
        prefix: 'my_app',
        labels: { service: 'api', version: '1.0.0' },
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        windowSize: 60000,    // 1-minute windows
        maxWindows: 60,       // Keep 1 hour of data
        rollingWindowSize: 300000, // 5-minute rolling window
      }
    }),
  ],
})
export class AppModule {}
```

### Advanced Usage
```typescript
@Injectable()
export class MyService {
  constructor(private readonly metrics: EnhancedMetricsService) {}

  async processRequest() {
    // Track request count
    this.metrics.increment('requests_total', 1, {
      endpoint: '/api/data',
      method: 'GET'
    });

    // Track processing time
    const timer = this.metrics.startTimer('processing_duration', {
      operation: 'data_fetch'
    });

    try {
      const result = await this.fetchData();
      
      // Track success
      this.metrics.increment('requests_success');
      
      // Track result size
      this.metrics.histogram('response_size', result.length);
      
      return result;
    } catch (error) {
      // Track errors
      this.metrics.increment('requests_error', 1, {
        error_type: error.constructor.name
      });
      throw error;
    } finally {
      timer(); // Record duration
    }
  }

  async getAnalytics() {
    // Get real-time statistics
    const requestStats = this.metrics.getRollingStatistics('requests_total');
    const latencyStats = this.metrics.getRollingStatistics('processing_duration');
    const percentiles = this.metrics.getPercentiles('processing_duration');
    
    return {
      requests: {
        rate: requestStats.rate,
        count: requestStats.count,
        trend: requestStats.trend,
      },
      latency: {
        average: latencyStats.average,
        min: latencyStats.min,
        max: latencyStats.max,
        p95: percentiles.p95,
        p99: percentiles.p99,
      },
      timeSeries: this.metrics.getTimeSeriesData('requests_total', {}, 24), // Last 24 windows
    };
  }
}
```

### Multiple Collectors
```typescript
// Prometheus for scraping
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'prometheus',
    // ... config
  }
})

// StatsD for real-time streaming
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'statsd',
    flushInterval: 1000,
    collectorOptions: {
      host: 'statsd.example.com',
      port: 8125,
    }
  }
})

// CloudWatch for AWS integration
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'cloudwatch',
    collectorOptions: {
      region: 'us-east-1',
      namespace: 'MyApp/Production',
    }
  }
})
```

## Performance Characteristics

### Memory Usage
- Time windows: O(n) where n = number of windows
- Rolling windows: O(m) where m = window size in data points
- Percentile sketches: O(k) where k = sketch size (configurable, default 1000)

### CPU Usage
- Metric recording: O(1) amortized
- Aggregation: O(1) for rolling windows, O(n) for percentiles
- Export: O(m) where m = number of metrics

### Network Usage
- Pull-based (Prometheus): On-demand
- Push-based (StatsD): Configurable batching
- CloudWatch: Efficient batching (up to 20 metrics per API call)

## Production Considerations

### High Throughput
```typescript
// Use buffering for high-volume metrics
ShieldModule.forRoot({
  metrics: {
    type: 'statsd',
    flushInterval: 100,    // Flush every 100ms
    maxBufferSize: 1000,   // Buffer up to 1000 metrics
  }
})
```

### Memory Management
```typescript
// Limit data retention
ShieldModule.forRoot({
  metrics: {
    windowSize: 60000,     // 1-minute windows
    maxWindows: 60,        // Keep only 1 hour
    rollingWindowSize: 300000, // 5-minute rolling window
  }
})
```

### Error Handling
```typescript
// All collectors include error handling
// Errors are logged but don't affect application performance
// Failed metrics are dropped gracefully
```

This comprehensive metrics system provides everything needed for production monitoring, alerting, and analytics!