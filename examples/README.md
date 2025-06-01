# NestShield Examples

This directory contains examples demonstrating how to use NestShield in your applications.

## Basic Example

The basic example shows fundamental usage of NestShield features:

- Simple rate limiting and throttling
- Circuit breaker patterns
- Request prioritization
- Decorator-based protection
- Bypass mechanisms for health checks

### Running the Basic Example

```bash
cd examples/basic
npm install
npm run start
```

### Key Features Demonstrated

1. **Global Protection**: Apply protection to entire controllers
2. **Method-Level Protection**: Fine-grained control per endpoint
3. **Quick Decorators**: Simple one-line protection
4. **Parameter Decorators**: Access protection metadata in your handlers

## Advanced Example

The advanced example demonstrates enterprise-grade features:

- Redis-based distributed rate limiting
- Custom metrics collection
- Dynamic rate limits based on user tiers
- Manual circuit breaker control
- Distributed synchronization
- Graceful shutdown handling
- Priority queue management
- Adaptive protection

### Running the Advanced Example

```bash
cd examples/advanced

# Start Redis (required for distributed features)
docker run -d -p 6379:6379 redis:alpine

# Install and run
npm install
npm run start
```

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Admin bypass token
ADMIN_TOKEN=secret-admin-token

# Node identification for clustering
NODE_ID=node-1
NODE_ENV=production
```

### Key Features Demonstrated

1. **Distributed Rate Limiting**: Share rate limit counters across multiple instances
2. **Custom Storage**: Use Redis for persistent rate limiting
3. **Dynamic Configuration**: Adjust limits based on user attributes
4. **Circuit Breaker Fallbacks**: Return cached data when services fail
5. **Priority Queues**: Handle different request priorities
6. **Cluster Awareness**: Monitor and sync across multiple nodes
7. **Custom Metrics**: Implement your own metrics collector
8. **Graceful Shutdown**: Properly drain requests on shutdown

## Testing the Examples

### Basic Endpoints

```bash
# Simple GET request
curl http://localhost:3000/

# Rate limited endpoint (5 requests per minute)
curl http://localhost:3000/limited

# Throttled endpoint (3 requests per minute)
curl http://localhost:3000/throttled

# Protected endpoint with multiple protections
curl http://localhost:3000/protected

# Bypass protection (health check)
curl http://localhost:3000/status
```

### Advanced Endpoints

```bash
# Analytics with circuit breaker
curl http://localhost:3000/api/v2/analytics?from=2024-01-01&to=2024-12-31

# Batch processing with overload protection
curl -X POST http://localhost:3000/api/v2/process/batch \
  -H "Content-Type: application/json" \
  -d '[{"id": 1}, {"id": 2}, {"id": 3}]'

# Cluster status
curl http://localhost:3000/api/v2/cluster/status

# Dynamic rate limiting based on tier
curl http://localhost:3000/api/v2/dynamic-rate-limit \
  -H "x-user-tier: premium"

# Priority queue with premium user
curl -X POST http://localhost:3000/api/v2/priority-queue \
  -H "Content-Type: application/json" \
  -H "x-priority: 8" \
  -H "x-premium-user: true" \
  -d '{"data": "important"}'
```

## Load Testing

You can test the protection mechanisms using tools like Apache Bench or k6:

```bash
# Test rate limiting
ab -n 100 -c 10 http://localhost:3000/limited

# Test overload protection
ab -n 1000 -c 100 http://localhost:3000/api/v2/process/batch
```

## Monitoring

Both examples include metrics that can be monitored:

- Request counts and rates
- Circuit breaker states
- Queue lengths and wait times
- Priority distribution
- Error rates

Access metrics at:
- Basic: Check console logs
- Advanced: Custom metrics collector exports Prometheus format

## Best Practices

1. **Start Conservative**: Begin with lower limits and increase based on monitoring
2. **Use Appropriate Storage**: Memory for single instance, Redis for distributed
3. **Monitor Everything**: Use metrics to understand your protection impact
4. **Test Fallbacks**: Ensure your circuit breaker fallbacks work correctly
5. **Plan for Shutdown**: Implement graceful shutdown for production
6. **Customize Keys**: Use appropriate key generation for rate limiting
7. **Priority Wisely**: Design priority levels based on business needs