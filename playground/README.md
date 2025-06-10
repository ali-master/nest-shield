# NestShield Playground

A comprehensive demonstration environment showcasing all NestShield protection features and scenarios.

## 🚀 Quick Start

```bash
# Navigate to playground directory
cd playground

# Install dependencies (if not already installed)
npm install

# Start the playground application
npm run start:playground

# Or run in development mode
npm run start:dev:playground
```

The playground will be available at: **http://localhost:3000/api**

## 📊 Available Endpoints

### Basic Protection (`/api/basic`)
- `GET /api/basic` - Basic rate limiting and throttling
- `GET /api/basic/quick` - Quick rate limiting demo
- `GET /api/basic/bypass` - Bypassed endpoint (no protection)
- `GET /api/basic/health` - Health check endpoint

### Rate Limiting (`/api/rate-limit`)
- `GET /api/rate-limit/strict` - Strict rate limiting (3 req/min)
- `GET /api/rate-limit/generous` - Generous rate limiting (100 req/min)
- `GET /api/rate-limit/burst` - Burst rate limiting (10 req/sec)
- `GET /api/rate-limit/custom-key` - Custom key generation
- `POST /api/rate-limit/skip-successful` - Skip successful requests
- `POST /api/rate-limit/skip-failed` - Skip failed requests
- `GET /api/rate-limit/per-ip` - Per-IP rate limiting
- `GET /api/rate-limit/per-user-agent` - Per-User-Agent rate limiting
- `GET /api/rate-limit/with-headers` - Custom response headers

### Throttling (`/api/throttle`)
- `GET /api/throttle/basic` - Basic throttling (5 req/min)
- `GET /api/throttle/strict` - Strict throttling (1 req/10sec)
- `GET /api/throttle/burst` - Burst throttling (10 req/sec)
- `GET /api/throttle/custom-key-user` - User-based throttling
- `GET /api/throttle/custom-key-endpoint` - Endpoint-based throttling
- `GET /api/throttle/ignore-user-agents` - Ignore bots/crawlers
- `GET /api/throttle/per-session` - Session-based throttling
- `GET /api/throttle/adaptive` - Adaptive throttling with custom messages

### Circuit Breaker (`/api/circuit-breaker`)
- `GET /api/circuit-breaker/basic` - Basic circuit breaker
- `GET /api/circuit-breaker/fast-fail` - Fast fail (500ms timeout)
- `GET /api/circuit-breaker/tolerant` - Tolerant (80% error threshold)
- `GET /api/circuit-breaker/with-fallback` - With fallback response
- `GET /api/circuit-breaker/with-health-check` - With health check
- `GET /api/circuit-breaker/volume-threshold` - Volume threshold
- `GET /api/circuit-breaker/warmup` - Warm-up period
- `POST /api/circuit-breaker/simulate-failure` - Simulate failures
- `GET /api/circuit-breaker/stress-test` - Stress test for circuit breaker

### Overload Protection (`/api/overload`)
- `GET /api/overload/basic` - Basic overload protection
- `GET /api/overload/strict` - Strict limits (1 concurrent)
- `GET /api/overload/generous` - Generous limits (10 concurrent)
- `GET /api/overload/priority-high` - High priority endpoint
- `GET /api/overload/priority-medium` - Medium priority endpoint
- `GET /api/overload/priority-low` - Low priority endpoint
- `POST /api/overload/fifo-shedding` - FIFO shedding strategy
- `POST /api/overload/lifo-shedding` - LIFO shedding strategy
- `POST /api/overload/priority-shedding` - Priority-based shedding
- `GET /api/overload/adaptive-threshold` - Adaptive threshold adjustment
- `GET /api/overload/stress-test` - Overload stress test

### Metrics Collection (`/api/metrics`)
- `GET /api/metrics/current` - Current metrics snapshot
- `GET /api/metrics/prometheus` - Prometheus-formatted metrics
- `GET /api/metrics/json` - JSON-formatted metrics
- `POST /api/metrics/increment` - Increment counter metric
- `POST /api/metrics/gauge` - Set gauge metric
- `POST /api/metrics/histogram` - Record histogram value
- `GET /api/metrics/response-time-distribution` - Response time distribution
- `GET /api/metrics/request-rate-simulation` - Request rate simulation
- `GET /api/metrics/error-rate-tracking` - Error rate tracking
- `GET /api/metrics/circuit-breaker-metrics` - Circuit breaker metrics
- `GET /api/metrics/system-metrics` - System metrics (CPU, memory)
- `GET /api/metrics/custom-business-metrics` - Business metrics
- `POST /api/metrics/export` - Export metrics in various formats

### Anomaly Detection (`/api/anomaly-detection`)
- `GET /api/anomaly-detection/generate-normal-data` - Generate normal data
- `GET /api/anomaly-detection/generate-anomaly` - Generate anomaly data
- `GET /api/anomaly-detection/zscore-detection` - Z-Score detection test
- `GET /api/anomaly-detection/isolation-forest` - Isolation Forest test
- `GET /api/anomaly-detection/seasonal-detection` - Seasonal pattern test
- `GET /api/anomaly-detection/threshold-detection` - Threshold detection test
- `POST /api/anomaly-detection/custom-metric` - Collect custom metric
- `GET /api/anomaly-detection/detection-status` - Detection system status
- `POST /api/anomaly-detection/simulate-attack` - Simulate attack patterns
- `GET /api/anomaly-detection/composite-detection` - Composite detector test

### Configuration Examples (`/api/config`)
- `GET /api/config/memory-storage` - Memory storage configuration
- `GET /api/config/redis-storage` - Redis storage configuration
- `GET /api/config/memcached-storage` - Memcached storage configuration
- `GET /api/config/async-configuration` - Async configuration example
- `GET /api/config/comprehensive-config` - Complete configuration
- `GET /api/config/microservices-config` - Microservices configuration
- `GET /api/config/high-traffic-config` - High-traffic configuration
- `GET /api/config/development-config` - Development configuration
- `POST /api/config/validate-config` - Configuration validation
- `GET /api/config/custom-storage-adapter` - Custom storage adapter

### Combined Protection (`/api/combined`)
- `GET /api/combined/full-protection` - All protections enabled
- `POST /api/combined/api-gateway-simulation` - API gateway simulation
- `GET /api/combined/high-priority-endpoint` - High priority with protection
- `GET /api/combined/low-priority-endpoint` - Low priority with protection
- `POST /api/combined/payment-processing` - Payment processing simulation
- `GET /api/combined/file-upload-endpoint` - File upload simulation
- `POST /api/combined/user-registration` - User registration flow
- `GET /api/combined/public-api` - Public API with key-based limiting
- `GET /api/combined/admin-endpoint` - Admin operations
- `POST /api/combined/batch-operation` - Batch operation processing
- `GET /api/combined/stress-test-endpoint` - Stress testing
- `GET /api/combined/protection-status` - Protection status overview

### Advanced Features (`/api/advanced`)
- `GET /api/advanced/graceful-shutdown-info` - Graceful shutdown information
- `GET /api/advanced/distributed-sync-status` - Distributed sync status
- `GET /api/advanced/priority-management` - Priority management system
- `POST /api/advanced/adaptive-protection` - Adaptive protection demo
- `GET /api/advanced/anomaly-detection-advanced` - Advanced anomaly detection
- `POST /api/advanced/business-rules` - Business rules application
- `GET /api/advanced/custom-key-generators` - Custom key generation
- `POST /api/advanced/fallback-strategies` - Fallback strategies
- `GET /api/advanced/health-indicators` - Health indicator system
- `GET /api/advanced/performance-monitoring` - Performance monitoring
- `POST /api/advanced/custom-protection-logic` - Custom protection logic

## 🧪 Testing Scenarios

### 1. Rate Limiting Test
```bash
# Test strict rate limiting (should block after 3 requests)
for i in {1..5}; do
  curl -w "\\n" http://localhost:3000/api/rate-limit/strict
done
```

### 2. Circuit Breaker Test
```bash
# Trigger circuit breaker with failures
curl -X POST http://localhost:3000/api/circuit-breaker/simulate-failure \\
  -H "Content-Type: application/json" \\
  -d '{"shouldFail": true}'
```

### 3. Overload Protection Test
```bash
# Test concurrent requests (use multiple terminals)
curl http://localhost:3000/api/overload/strict &
curl http://localhost:3000/api/overload/strict &
curl http://localhost:3000/api/overload/strict &
```

### 4. Priority Testing
```bash
# High priority request
curl -H "X-Request-Priority: 10" http://localhost:3000/api/combined/high-priority-endpoint

# Low priority request
curl -H "X-Request-Priority: 1" http://localhost:3000/api/combined/low-priority-endpoint
```

### 5. Custom Key Generation
```bash
# User-based rate limiting
curl -H "X-User-ID: user123" http://localhost:3000/api/rate-limit/custom-key

# API key-based rate limiting
curl -H "X-API-Key: api-key-123" -H "X-Customer-Tier: premium" \\
  http://localhost:3000/api/advanced/custom-key-generators
```

### 6. Metrics Testing
```bash
# Generate metrics data
curl -X POST http://localhost:3000/api/metrics/increment \\
  -H "Content-Type: application/json" \\
  -d '{"metric": "test_counter", "value": 5, "labels": {"env": "playground"}}'

# View metrics
curl http://localhost:3000/api/metrics/current
curl http://localhost:3000/api/metrics/prometheus
```

### 7. Anomaly Detection Test
```bash
# Generate normal data
curl http://localhost:3000/api/anomaly-detection/generate-normal-data?count=100

# Generate anomaly
curl http://localhost:3000/api/anomaly-detection/generate-anomaly?type=spike

# Check detection status
curl http://localhost:3000/api/anomaly-detection/detection-status
```

## 🔧 Configuration Testing

### Memory Storage (Development)
```typescript
ShieldModule.forRoot({
  storage: { type: 'memory' },
  rateLimit: { points: 10, duration: 60 },
  throttle: { limit: 5, ttl: 30 },
})
```

### Redis Storage (Production)
```typescript
ShieldModule.forRoot({
  storage: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'nest-shield:',
    },
  },
})
```

### Comprehensive Configuration
```typescript
ShieldModule.forRoot({
  global: {
    enabled: true,
    excludePaths: ['/health', '/metrics'],
    logging: { enabled: true, level: 'info' },
  },
  circuitBreaker: {
    enabled: true,
    timeout: 3000,
    errorThresholdPercentage: 50,
  },
  rateLimit: {
    enabled: true,
    points: 100,
    duration: 60,
  },
  // ... more configuration options
})
```

## 📈 Monitoring & Observability

### Prometheus Metrics
The playground exposes Prometheus-compatible metrics at `/api/metrics/prometheus`:

- `nest_shield_requests_total` - Total requests processed
- `nest_shield_request_duration_ms` - Request duration histogram
- `nest_shield_rate_limit_hits_total` - Rate limit violations
- `nest_shield_circuit_breaker_state` - Circuit breaker states
- `nest_shield_overload_rejections_total` - Overload rejections

### Health Checks
- `GET /api/basic/health` - Basic health check
- `GET /api/advanced/health-indicators` - Detailed health indicators

### System Metrics
- `GET /api/metrics/system-metrics` - Node.js process metrics
- `GET /api/advanced/performance-monitoring` - Performance metrics

## 🛠️ Development Tips

### Adding Custom Scenarios
1. Create a new controller in `controllers/`
2. Add the controller to `app.module.ts`
3. Implement your scenarios with appropriate decorators
4. Update this README with new endpoints

### Testing Custom Configurations
1. Modify `app.module.ts` to test different configurations
2. Use `/api/config/validate-config` to validate configurations
3. Monitor behavior through metrics endpoints

### Debugging Protection Issues
1. Enable debug logging in configuration
2. Use `/api/combined/protection-status` for current state
3. Check metrics for detailed information
4. Use bypass endpoints for comparison

## 📝 Example Use Cases

### API Gateway Scenario
```bash
# Simulate different services with varying protection levels
curl -X POST http://localhost:3000/api/combined/api-gateway-simulation \\
  -H "Content-Type: application/json" \\
  -d '{"serviceId": "user-service", "data": {"operation": "create"}}'
```

### Payment Processing
```bash
# Test payment with protection
curl -X POST http://localhost:3000/api/combined/payment-processing \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "currency": "USD", "userId": "user123"}'
```

### File Upload Simulation
```bash
# Test file upload limits
curl "http://localhost:3000/api/combined/file-upload-endpoint?fileSize=5000"
```

### Batch Operations
```bash
# Test batch processing with protection
curl -X POST http://localhost:3000/api/combined/batch-operation \\
  -H "Content-Type: application/json" \\
  -d '{"items": [1,2,3,4,5], "batchSize": 2}'
```

## 🚨 Security Testing

### DDoS Simulation
```bash
curl -X POST http://localhost:3000/api/anomaly-detection/simulate-attack \\
  -H "Content-Type: application/json" \\
  -d '{"attackType": "ddos", "duration": 30000}'
```

### Slowloris Attack
```bash
curl -X POST http://localhost:3000/api/anomaly-detection/simulate-attack \\
  -H "Content-Type: application/json" \\
  -d '{"attackType": "slowloris", "duration": 20000}'
```

### Error Flood
```bash
curl -X POST http://localhost:3000/api/anomaly-detection/simulate-attack \\
  -H "Content-Type: application/json" \\
  -d '{"attackType": "error-flood", "duration": 15000}'
```

## 📚 Learn More

- [NestShield Documentation](../README.md)
- [Advanced Configuration Examples](../docs/usage-summary.md)
- [Anomaly Detection Science](../docs/anomaly-detection/science.md)
- [Metrics Documentation](../docs/metrics-complete.md)

## 🤝 Contributing

To add new playground scenarios:

1. Fork the repository
2. Create your feature branch
3. Add comprehensive examples
4. Update documentation
5. Submit a pull request

---

**Happy testing with NestShield! 🛡️**