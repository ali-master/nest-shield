# Troubleshooting Guide

<p align="center">
  <img src="../assets/logo.svg" alt="NestShield" width="120">
</p>

Comprehensive troubleshooting guide for common issues, debugging techniques, and solutions when working with NestShield.

## 📋 Table of Contents

- [Common Issues](#common-issues)
- [Configuration Problems](#configuration-problems)
- [Performance Issues](#performance-issues)
- [Storage Backend Issues](#storage-backend-issues)
- [Circuit Breaker Problems](#circuit-breaker-problems)
- [Debugging Techniques](#debugging-techniques)
- [Monitoring and Diagnostics](#monitoring-and-diagnostics)
- [Error Messages](#error-messages)
- [FAQ](#faq)

## Common Issues

### 1. Protection Not Working

**Symptoms:**
- Requests are not being rate limited
- Circuit breaker is not activating
- No protection errors are thrown

**Possible Causes & Solutions:**

**A. Shield Guard Not Applied**
```typescript
// ❌ Problem: Guard not registered globally
@Module({
  imports: [ShieldModule.forRoot(config)]
})

// ✅ Solution: Apply guard globally
// main.ts
app.useGlobalGuards(app.get(ShieldGuard));

// OR apply to specific controllers
@UseGuards(ShieldGuard)
@Controller('api')
export class ApiController {}
```

**B. Protection Disabled**
```typescript
// ❌ Problem: Protection disabled globally
ShieldModule.forRoot({
  global: { enabled: false }
})

// ✅ Solution: Enable protection
ShieldModule.forRoot({
  global: { enabled: true }
})
```

**C. Development Bypass Active**
```typescript
// ❌ Problem: Bypass enabled in production
ShieldModule.forRoot({
  global: { 
    enabled: true,
    bypassForDevelopment: true // This bypasses in NODE_ENV=development
  }
})

// ✅ Solution: Proper environment handling
ShieldModule.forRoot({
  global: { 
    enabled: true,
    bypassForDevelopment: process.env.NODE_ENV === 'development'
  }
})
```

**D. @BypassShield Applied**
```typescript
// ❌ Problem: Accidental bypass
@Get('api/data')
@BypassShield() // This disables all protection
getData() {}

// ✅ Solution: Remove unnecessary bypass
@Get('api/data')
@RateLimit({ points: 100, duration: 60 })
getData() {}
```

### 2. High Memory Usage

**Symptoms:**
- Application memory usage grows over time
- Out of memory errors
- Performance degradation

**Investigation Steps:**

```typescript
// Memory monitoring utility
@Injectable()
export class MemoryDiagnosticService {
  @Cron('*/60 * * * * *') // Every minute
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const formatMB = (bytes: number) => Math.round(bytes / 1024 / 1024 * 100) / 100;
    
    console.log({
      rss: formatMB(usage.rss) + 'MB',
      heapTotal: formatMB(usage.heapTotal) + 'MB',
      heapUsed: formatMB(usage.heapUsed) + 'MB',
      external: formatMB(usage.external) + 'MB'
    });
    
    // Alert if memory usage is high
    if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
      console.warn('High memory usage detected');
      
      // Force garbage collection (if --expose-gc flag is set)
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  getStorageStats() {
    // Check internal storage size if using memory adapter
    if (this.storageAdapter instanceof MemoryStorageAdapter) {
      const stats = this.storageAdapter.getStats();
      console.log('Storage stats:', stats);
      return stats;
    }
  }
}
```

**Common Solutions:**

**A. Memory Storage Overflow**
```typescript
// ❌ Problem: No limits on memory storage
storage: {
  type: 'memory'
  // No maxKeys limit
}

// ✅ Solution: Set memory limits
storage: {
  type: 'memory',
  options: {
    maxKeys: 10000,     // Limit number of keys
    stdTTL: 3600,       // Default expiration
    checkperiod: 600    // Cleanup interval
  }
}

// Or switch to Redis in production
storage: {
  type: 'redis',
  options: {
    host: 'localhost',
    port: 6379
  }
}
```

**B. Memory Leaks in Custom Code**
```typescript
// ❌ Problem: Accumulating data without cleanup
const requestLog = []; // This grows indefinitely

@RateLimit()
someMethod() {
  requestLog.push({ timestamp: Date.now(), data: 'stuff' });
}

// ✅ Solution: Implement proper cleanup
const requestLog = new Map<string, any>();

@RateLimit()
someMethod() {
  const key = Date.now().toString();
  requestLog.set(key, { data: 'stuff' });
  
  // Cleanup old entries
  const cutoff = Date.now() - 3600000; // 1 hour
  for (const [timestamp] of requestLog) {
    if (parseInt(timestamp) < cutoff) {
      requestLog.delete(timestamp);
    }
  }
}
```

### 3. Performance Degradation

**Symptoms:**
- Slow response times
- High CPU usage
- Request timeouts

**Diagnostic Steps:**

```typescript
// Performance monitoring
@Injectable()
export class PerformanceDiagnosticService {
  private performanceLog = new Map<string, number[]>();
  
  logEndpointPerformance(endpoint: string, duration: number) {
    if (!this.performanceLog.has(endpoint)) {
      this.performanceLog.set(endpoint, []);
    }
    
    const durations = this.performanceLog.get(endpoint)!;
    durations.push(duration);
    
    // Keep only last 100 measurements
    if (durations.length > 100) {
      durations.splice(0, 50);
    }
    
    // Alert on consistently slow endpoints
    if (durations.length >= 10) {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      if (avg > 5000) { // 5 seconds average
        console.warn(`Slow endpoint detected: ${endpoint} (avg: ${avg}ms)`);
      }
    }
  }
  
  getSlowEndpoints() {
    const slowEndpoints = [];
    
    for (const [endpoint, durations] of this.performanceLog) {
      if (durations.length >= 5) {
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
        
        if (avg > 2000 || p95 > 5000) {
          slowEndpoints.push({
            endpoint,
            averageMs: Math.round(avg),
            p95Ms: p95,
            samples: durations.length
          });
        }
      }
    }
    
    return slowEndpoints.sort((a, b) => b.averageMs - a.averageMs);
  }
}
```

**Common Solutions:**

**A. Inefficient Storage Operations**
```typescript
// ❌ Problem: Blocking operations in hot path
@RateLimit({ points: 100, duration: 60 })
async getData() {
  // This blocks other requests
  await this.heavyDatabaseOperation();
}

// ✅ Solution: Use circuit breaker with timeout
@CircuitBreaker({ 
  timeout: 5000,
  fallback: async () => this.getCachedData()
})
async getData() {
  return this.heavyDatabaseOperation();
}
```

**B. Excessive Rate Limit Checks**
```typescript
// ❌ Problem: Rate limiting every small operation
class DataService {
  @RateLimit({ points: 1, duration: 1 })
  async processItem(item: any) {
    // Called for each item
  }
  
  async processBatch(items: any[]) {
    for (const item of items) {
      await this.processItem(item); // Rate limit check per item
    }
  }
}

// ✅ Solution: Batch processing with single rate limit
class DataService {
  @RateLimit({ points: 100, duration: 60 })
  async processBatch(items: any[]) {
    // Single rate limit check for entire batch
    return Promise.all(items.map(item => this.processItemInternal(item)));
  }
  
  private async processItemInternal(item: any) {
    // No rate limiting on internal method
  }
}
```

## Configuration Problems

### 1. Invalid Configuration

**Error Messages:**
```
TypeError: Cannot read property 'points' of undefined
ValidationError: Invalid rate limit configuration
```

**Solutions:**

```typescript
// ❌ Problem: Missing required properties
@RateLimit({
  // Missing points and duration
})

// ✅ Solution: Provide all required config
@RateLimit({
  points: 100,
  duration: 60
})

// Or use defaults
@RateLimit() // Uses default configuration
```

### 2. Configuration Overrides Not Working

**Symptoms:**
- Method-level decorators not overriding class-level
- Environment variables not being applied

**Debug Configuration:**

```typescript
// Configuration debug utility
@Injectable()
export class ConfigDiagnosticService {
  constructor(@Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private config: IShieldConfig) {}
  
  debugConfiguration() {
    console.log('Shield Configuration:', {
      global: this.config.global,
      rateLimit: this.config.rateLimit,
      storage: {
        type: this.config.storage?.type,
        // Don't log sensitive data like passwords
        hasOptions: !!this.config.storage?.options
      },
      metrics: this.config.metrics
    });
  }
  
  validateConfiguration() {
    const issues = [];
    
    if (this.config.storage?.type === 'memory' && process.env.NODE_ENV === 'production') {
      issues.push('Memory storage in production is not recommended');
    }
    
    if (!this.config.metrics?.enabled) {
      issues.push('Metrics are disabled - monitoring will be limited');
    }
    
    if (this.config.rateLimit?.points && this.config.rateLimit.points > 10000) {
      issues.push('Very high rate limit - consider security implications');
    }
    
    return issues;
  }
}
```

## Storage Backend Issues

### 1. Redis Connection Problems

**Error Messages:**
```
Error: Redis connection failed
ECONNREFUSED ::1:6379
Error: Ready check failed: NOAUTH Authentication required
```

**Debugging Redis Issues:**

```typescript
// Redis diagnostic utility
@Injectable()
export class RedisDiagnosticService {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}
  
  async diagnoseRedisConnection() {
    try {
      // Test basic connectivity
      const pong = await this.redis.ping();
      console.log('Redis ping:', pong);
      
      // Get connection info
      const info = await this.redis.info('clients');
      console.log('Redis client info:', info);
      
      // Test operations
      await this.redis.set('test:connection', 'ok', 'EX', 60);
      const value = await this.redis.get('test:connection');
      console.log('Redis test operation:', value);
      
      // Check memory usage
      const memory = await this.redis.info('memory');
      console.log('Redis memory:', memory);
      
      return { status: 'healthy', tests: ['ping', 'info', 'set/get', 'memory'] };
      
    } catch (error) {
      console.error('Redis diagnostic failed:', error);
      return { 
        status: 'unhealthy', 
        error: error.message,
        suggestions: this.getSuggestions(error)
      };
    }
  }
  
  private getSuggestions(error: Error): string[] {
    const suggestions = [];
    
    if (error.message.includes('ECONNREFUSED')) {
      suggestions.push('Check if Redis server is running');
      suggestions.push('Verify Redis host and port configuration');
      suggestions.push('Check network connectivity');
    }
    
    if (error.message.includes('NOAUTH')) {
      suggestions.push('Provide Redis password in configuration');
      suggestions.push('Check Redis AUTH configuration');
    }
    
    if (error.message.includes('timeout')) {
      suggestions.push('Increase connection timeout');
      suggestions.push('Check network latency to Redis');
    }
    
    return suggestions;
  }
}
```

**Common Redis Solutions:**

```typescript
// ✅ Robust Redis configuration
storage: {
  type: 'redis',
  options: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    
    // Connection resilience
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    
    // Reconnection
    lazyConnect: true,
    keepAlive: 30000,
    
    // Error handling
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis retry attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    }
  }
}
```

### 2. Storage Performance Issues

**Symptoms:**
- Slow response times
- Storage operation timeouts
- High latency

**Storage Performance Monitoring:**

```typescript
@Injectable()
export class StoragePerformanceService {
  private operationTimes = new Map<string, number[]>();
  
  async measureStorageOperation<T>(
    operation: string, 
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      this.recordOperation(operation, duration);
      
      // Alert on slow operations
      if (duration > 1000) {
        console.warn(`Slow storage operation: ${operation} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Storage operation failed: ${operation} (${duration}ms)`, error);
      throw error;
    }
  }
  
  private recordOperation(operation: string, duration: number) {
    if (!this.operationTimes.has(operation)) {
      this.operationTimes.set(operation, []);
    }
    
    const times = this.operationTimes.get(operation)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.splice(0, 50);
    }
  }
  
  getStorageStats() {
    const stats = new Map();
    
    for (const [operation, times] of this.operationTimes) {
      if (times.length > 0) {
        const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
        const sorted = [...times].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        
        stats.set(operation, {
          count: times.length,
          averageMs: Math.round(avg),
          p95Ms: p95,
          p99Ms: p99,
          minMs: Math.min(...times),
          maxMs: Math.max(...times)
        });
      }
    }
    
    return Object.fromEntries(stats);
  }
}
```

## Circuit Breaker Problems

### 1. Circuit Breaker Not Opening

**Symptoms:**
- Failing requests continue to execute
- No fallback responses
- Circuit breaker state remains "closed"

**Debug Circuit Breaker:**

```typescript
@Injectable()
export class CircuitBreakerDiagnosticService {
  constructor(private circuitBreakerService: CircuitBreakerService) {}
  
  diagnoseCircuitBreaker(key: string) {
    const stats = this.circuitBreakerService.getStats(key);
    const state = this.circuitBreakerService.getState(key);
    
    console.log(`Circuit Breaker Diagnostic for "${key}":`);
    console.log('State:', state);
    console.log('Stats:', stats);
    
    if (stats) {
      const errorRate = stats.failures / (stats.successes + stats.failures);
      console.log('Error Rate:', Math.round(errorRate * 100) + '%');
      
      // Check if error rate is high but circuit isn't open
      if (errorRate > 0.5 && state === 'closed') {
        console.warn('High error rate but circuit still closed - check configuration');
      }
      
      // Check if volume threshold is met
      const totalRequests = stats.successes + stats.failures;
      console.log('Total Requests:', totalRequests);
      
      if (totalRequests < 10) {
        console.info('Volume threshold not met - circuit breaker may not trigger');
      }
    } else {
      console.warn('No stats available - circuit breaker may not be properly configured');
    }
    
    return { state, stats, errorRate: stats ? stats.failures / (stats.successes + stats.failures) : 0 };
  }
  
  getAllCircuitBreakerStates() {
    return this.circuitBreakerService.getAllStats();
  }
}
```

**Common Circuit Breaker Issues:**

```typescript
// ❌ Problem: Volume threshold too high
@CircuitBreaker({
  volumeThreshold: 100,  // Needs 100 requests before considering opening
  errorThresholdPercentage: 50
})

// ✅ Solution: Lower volume threshold
@CircuitBreaker({
  volumeThreshold: 5,    // Only needs 5 requests
  errorThresholdPercentage: 50
})

// ❌ Problem: No proper error throwing
async callExternalService() {
  try {
    const response = await fetch('http://api.example.com/data');
    return response.json(); // This doesn't throw on 4xx/5xx
  } catch (error) {
    return null; // Swallowing errors
  }
}

// ✅ Solution: Proper error handling
async callExternalService() {
  const response = await fetch('http://api.example.com/data');
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 2. Circuit Breaker Stuck Open

**Symptoms:**
- Circuit breaker remains in "open" state
- All requests are rejected
- Fallback always executes

**Solutions:**

```typescript
// Manual circuit breaker management
@Injectable()
export class CircuitBreakerManagementService {
  constructor(private circuitBreakerService: CircuitBreakerService) {}
  
  async forceReset(key: string) {
    console.log(`Force resetting circuit breaker: ${key}`);
    this.circuitBreakerService.reset(key);
  }
  
  async checkAndResetIfNeeded(key: string) {
    const state = this.circuitBreakerService.getState(key);
    
    if (state === 'open') {
      // Check if the service is actually healthy
      const isHealthy = await this.circuitBreakerService.healthCheck(key);
      
      if (isHealthy) {
        console.log(`Service appears healthy, resetting circuit breaker: ${key}`);
        this.circuitBreakerService.reset(key);
      }
    }
  }
  
  async getStuckCircuitBreakers() {
    const allStats = this.circuitBreakerService.getAllStats();
    const stuck = [];
    
    for (const [key, stats] of Object.entries(allStats)) {
      const state = this.circuitBreakerService.getState(key);
      
      // Consider circuit breaker stuck if open for more than 5 minutes
      if (state === 'open' && stats.lastFailureTime) {
        const timeSinceLastFailure = Date.now() - stats.lastFailureTime;
        if (timeSinceLastFailure > 5 * 60 * 1000) {
          stuck.push({ key, timeSinceLastFailure, stats });
        }
      }
    }
    
    return stuck;
  }
}
```

## Debugging Techniques

### 1. Enable Debug Logging

```typescript
// Enable verbose logging
ShieldModule.forRoot({
  global: {
    errorHandler: (error, context) => {
      console.error('Shield Error:', {
        error: error.message,
        stack: error.stack,
        context: {
          ip: context?.ip,
          path: context?.path,
          method: context?.method,
          headers: context?.headers,
          user: context?.user
        }
      });
    }
  }
})
```

### 2. Request Tracing

```typescript
// Custom interceptor for request tracing
@Injectable()
export class ShieldTracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const traceId = request.headers['x-trace-id'] || Math.random().toString(36);
    
    console.log(`[${traceId}] Shield processing:`, {
      method: request.method,
      path: request.path,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    
    return next.handle().pipe(
      tap(() => {
        console.log(`[${traceId}] Shield processing completed`);
      }),
      catchError((error) => {
        console.error(`[${traceId}] Shield processing failed:`, error);
        throw error;
      })
    );
  }
}
```

### 3. Manual Testing Utilities

```typescript
// Testing utilities for manual debugging
@Injectable()
export class ShieldTestingService {
  constructor(
    private rateLimitService: RateLimitService,
    private circuitBreakerService: CircuitBreakerService,
    private throttleService: ThrottleService
  ) {}
  
  async testRateLimit(ip: string, points: number = 10) {
    const context: IProtectionContext = {
      ip,
      method: 'GET',
      path: '/test',
      headers: {},
      timestamp: Date.now()
    };
    
    console.log(`Testing rate limit for IP: ${ip}`);
    
    for (let i = 1; i <= points + 2; i++) {
      try {
        const result = await this.rateLimitService.consume(context);
        console.log(`Request ${i}: ${result.allowed ? 'ALLOWED' : 'BLOCKED'} (remaining: ${result.metadata?.remaining})`);
      } catch (error) {
        console.log(`Request ${i}: EXCEPTION - ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  async testCircuitBreaker(key: string) {
    console.log(`Testing circuit breaker: ${key}`);
    
    // Create a failing handler
    const failingHandler = async () => {
      throw new Error('Simulated failure');
    };
    
    const context: IProtectionContext = {
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
      headers: {},
      timestamp: Date.now()
    };
    
    for (let i = 1; i <= 15; i++) {
      try {
        await this.circuitBreakerService.execute(key, failingHandler, context);
        console.log(`Request ${i}: SUCCESS`);
      } catch (error) {
        const state = this.circuitBreakerService.getState(key);
        console.log(`Request ${i}: FAILED (state: ${state}) - ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const finalStats = this.circuitBreakerService.getStats(key);
    console.log('Final stats:', finalStats);
  }
}
```

## Monitoring and Diagnostics

### 1. Health Check Endpoint

```typescript
@Controller('shield')
export class ShieldDiagnosticController {
  constructor(
    private configDiagnostic: ConfigDiagnosticService,
    private redisDiagnostic: RedisDiagnosticService,
    private circuitBreakerDiagnostic: CircuitBreakerDiagnosticService,
    private performanceDiagnostic: PerformanceDiagnosticService
  ) {}
  
  @Get('health')
  @BypassShield()
  async getShieldHealth() {
    const [
      configIssues,
      redisHealth,
      circuitBreakerStates,
      performanceStats
    ] = await Promise.allSettled([
      Promise.resolve(this.configDiagnostic.validateConfiguration()),
      this.redisDiagnostic.diagnoseRedisConnection(),
      Promise.resolve(this.circuitBreakerDiagnostic.getAllCircuitBreakerStates()),
      Promise.resolve(this.performanceDiagnostic.getSlowEndpoints())
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      status: 'ok',
      diagnostics: {
        configuration: configIssues.status === 'fulfilled' ? configIssues.value : [],
        storage: redisHealth.status === 'fulfilled' ? redisHealth.value : { error: 'Failed to check' },
        circuitBreakers: circuitBreakerStates.status === 'fulfilled' ? circuitBreakerStates.value : {},
        performance: performanceStats.status === 'fulfilled' ? performanceStats.value : []
      }
    };
  }
  
  @Get('stats')
  @BypassShield()
  async getShieldStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      circuitBreakers: this.circuitBreakerDiagnostic.getAllCircuitBreakerStates(),
      performance: this.performanceDiagnostic.getSlowEndpoints()
    };
  }
}
```

## Error Messages

### Common Error Messages and Solutions

| Error | Possible Cause | Solution |
|-------|---------------|----------|
| `ShieldModule is not configured` | Module not imported | Import `ShieldModule.forRoot()` |
| `Cannot read property 'points' of undefined` | Invalid decorator config | Provide required configuration |
| `Redis connection failed` | Redis not running/accessible | Check Redis configuration |
| `Rate limit storage error` | Storage backend issues | Check storage backend health |
| `Circuit breaker not found` | Circuit breaker key mismatch | Verify circuit breaker key |
| `ECONNREFUSED` | Service connection refused | Check if target service is running |
| `Timeout` | Operation took too long | Adjust timeout values |
| `Memory limit exceeded` | Memory storage full | Switch to Redis or increase limits |

### Error Response Format

```typescript
// Standard error response format
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "error": "Too Many Requests",
  "details": {
    "limit": 100,
    "remaining": 0,
    "reset": "2023-12-01T12:00:00Z",
    "retryAfter": 60
  }
}
```

## FAQ

### Q: Why is my rate limiting not working?

**A:** Check these common issues:
1. Guard not applied globally or to controller
2. `@BypassShield()` decorator applied
3. Protection disabled in configuration
4. Development bypass enabled in production

### Q: Can I use multiple storage backends?

**A:** No, NestShield uses a single storage backend per application instance. Choose Redis for production distributed deployments.

### Q: How do I debug circuit breaker issues?

**A:** Use the diagnostic service to check:
1. Circuit breaker state and stats
2. Error rates and volume thresholds
3. Proper error throwing in your code
4. Health check implementation

### Q: What's the performance impact of NestShield?

**A:** NestShield is designed for minimal overhead:
- Memory storage: ~1-2ms per request
- Redis storage: ~3-5ms per request (network dependent)
- Circuit breaker: ~0.5ms per request

### Q: Can I customize error messages?

**A:** Yes, use `customResponseMessage` in configuration:
```typescript
@RateLimit({
  customResponseMessage: (context) => 
    `API limit exceeded for ${context.ip}. Try again later.`
})
```

### Q: How do I monitor NestShield in production?

**A:** Enable metrics and set up monitoring:
1. Configure Prometheus/StatsD metrics
2. Set up Grafana dashboards
3. Configure alerting rules
4. Monitor health check endpoints

---

<p align="center">
  Still need help? <a href="https://discord.gg/nestshield">Join our Discord</a> • <a href="https://github.com/ali-master/nest-shield/issues">Report an Issue</a>
</p>