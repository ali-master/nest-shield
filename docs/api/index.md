# API Reference

<p align="center">
  <img src="../../assets/logo.svg" alt="NestShield" width="120">
</p>

Complete API reference for NestShield, including all decorators, services, interfaces, and utilities.

## 📋 Table of Contents

- [Decorators](#decorators)
- [Services](#services)
- [Guards & Interceptors](#guards--interceptors)
- [Interfaces](#interfaces)
- [Exceptions](#exceptions)
- [Storage Adapters](#storage-adapters)
- [Metrics](#metrics)
- [Utilities](#utilities)

## Quick Links

- [Decorators Reference](./decorators.md) - All available decorators
- [Services Reference](./services.md) - Service APIs and methods
- [Interfaces Reference](./interfaces.md) - TypeScript interfaces
- [Examples](../examples/index.md) - Code examples

## Decorators

### Protection Decorators

#### `@Shield(options?: IShieldOptions)`
Comprehensive protection decorator combining all strategies.

```typescript
@Shield({
  rateLimit: { points: 100, duration: 60 },
  throttle: { limit: 10, ttl: 60 },
  circuitBreaker: { timeout: 5000 },
  overload: { maxConcurrentRequests: 50 }
})
```

#### `@RateLimit(options?: IRateLimitOptions)`
Rate limiting decorator for controlling total requests.

```typescript
@RateLimit({ 
  points: 100,
  duration: 3600,
  keyGenerator: (ctx) => ctx.user?.id || ctx.ip
})
```

#### `@Throttle(options?: IThrottleOptions)`
Throttling decorator for controlling request frequency.

```typescript
@Throttle({ 
  limit: 5,
  ttl: 60
})
```

#### `@CircuitBreaker(options?: ICircuitBreakerOptions)`
Circuit breaker decorator for preventing cascade failures.

```typescript
@CircuitBreaker({
  timeout: 5000,
  errorThresholdPercentage: 50,
  fallback: async () => ({ cached: true })
})
```

### Utility Decorators

#### `@BypassShield()`
Bypass all protection for specific endpoints.

```typescript
@Get('health')
@BypassShield()
checkHealth() {
  return { status: 'ok' };
}
```

#### `@Priority(level: number)`
Set request priority for overload management.

```typescript
@Post('payment')
@Priority(10) // Highest priority
processPayment() {}
```

#### `@ShieldContext()`
Inject protection context into method parameters.

```typescript
@Get()
async getData(@ShieldContext() context: IProtectionContext) {
  console.log('Request from:', context.ip);
}
```

## Services

### RateLimitService

```typescript
class RateLimitService {
  // Check and consume rate limit points
  consume(context: IProtectionContext, options?: IRateLimitOptions): Promise<IProtectionResult>;
  
  // Get remaining points
  getRemaining(context: IProtectionContext, options?: IRateLimitOptions): Promise<number>;
  
  // Reset rate limit for context
  reset(context: IProtectionContext, options?: IRateLimitOptions): Promise<void>;
  
  // Block specific context
  block(context: IProtectionContext, duration: number, reason?: string): Promise<void>;
  
  // Check if context is blocked
  isBlocked(context: IProtectionContext): Promise<boolean>;
}
```

### CircuitBreakerService

```typescript
class CircuitBreakerService {
  // Create a circuit breaker
  createBreaker(key: string, handler: Function, options?: ICircuitBreakerOptions): CircuitBreaker;
  
  // Execute with circuit breaker
  execute<T>(key: string, handler: () => Promise<T>, context: IProtectionContext, options?: ICircuitBreakerOptions): Promise<T>;
  
  // Get breaker statistics
  getStats(key: string): ICircuitBreakerStats | undefined;
  
  // Check breaker health
  healthCheck(key: string): Promise<boolean>;
  
  // Reset breaker
  reset(key: string): void;
  
  // Get breaker state
  getState(key: string): 'closed' | 'open' | 'halfOpen' | 'disabled' | undefined;
}
```

### ThrottleService

```typescript
class ThrottleService {
  // Check and consume throttle
  consume(context: IProtectionContext, options?: IThrottleOptions): Promise<IProtectionResult>;
  
  // Get throttle status
  getStatus(context: IProtectionContext, options?: IThrottleOptions): Promise<IThrottleStatus>;
  
  // Reset throttle
  reset(context: IProtectionContext, options?: IThrottleOptions): Promise<void>;
}
```

### OverloadService

```typescript
class OverloadService {
  // Acquire slot for request processing
  acquire(context: IProtectionContext, options?: IOverloadOptions): Promise<IProtectionResult>;
  
  // Release processing slot
  release(): void;
  
  // Get current status
  getStatus(): IOverloadStatus;
  
  // Force release multiple slots
  forceRelease(count: number): Promise<void>;
  
  // Clear request queue
  clearQueue(): void;
}
```

### MetricsService

```typescript
class MetricsService {
  // Increment counter metric
  increment(metric: string, value?: number, labels?: Record<string, string>): void;
  
  // Record gauge value
  gauge(metric: string, value: number, labels?: Record<string, string>): void;
  
  // Record histogram observation
  histogram(metric: string, value: number, labels?: Record<string, string>): void;
  
  // Export metrics
  export(format?: 'prometheus' | 'json'): Promise<string>;
  
  // Get specific metric
  getMetric(name: string, labels?: Record<string, string>): number | undefined;
}
```

## Guards & Interceptors

### ShieldGuard

Global guard that enforces protection rules based on decorators.

```typescript
@Injectable()
export class ShieldGuard implements CanActivate {
  canActivate(context: ExecutionContext): Promise<boolean>;
}
```

### CircuitBreakerInterceptor

Interceptor for circuit breaker functionality.

```typescript
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
```

### OverloadReleaseInterceptor

Automatically releases overload slots after request completion.

```typescript
@Injectable()
export class OverloadReleaseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
```

## Interfaces

### Core Interfaces

```typescript
interface IProtectionContext {
  ip: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  user?: any;
  metadata?: Record<string, any>;
  timestamp: number;
  requestId?: string;
}

interface IProtectionResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  metadata?: {
    limit?: number;
    remaining?: number;
    reset?: number;
    headers?: Record<string, string>;
    queueWaitTime?: number;
    currentRequests?: number;
  };
}

interface IShieldOptions {
  rateLimit?: IRateLimitOptions;
  throttle?: IThrottleOptions;
  circuitBreaker?: ICircuitBreakerOptions;
  overload?: IOverloadOptions;
  bypass?: boolean;
  priority?: number;
}
```

### Configuration Interfaces

```typescript
interface IRateLimitOptions {
  points?: number;
  duration?: number;
  blockDuration?: number;
  keyGenerator?: (context: IProtectionContext) => string;
  customResponseMessage?: (context: IProtectionContext) => string;
  customHeaders?: Record<string, string>;
  skipIf?: (context: IProtectionContext) => boolean;
}

interface ICircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  volumeThreshold?: number;
  resetTimeout?: number;
  fallback?: (error: Error, context: IProtectionContext) => any;
  healthCheck?: () => Promise<boolean>;
}

interface IThrottleOptions {
  limit?: number;
  ttl?: number;
  keyGenerator?: (context: IProtectionContext) => string;
  customResponseMessage?: (context: IProtectionContext) => string;
}

interface IOverloadOptions {
  maxConcurrentRequests?: number;
  maxQueueSize?: number;
  queueTimeout?: number;
  shedStrategy?: 'fifo' | 'lifo' | 'priority' | 'random';
  priorityFunction?: (context: IProtectionContext) => number;
}
```

## Exceptions

### Custom Exceptions

```typescript
// Base exception
export class ShieldException extends HttpException {
  constructor(message: string, statusCode: number, public readonly retryAfter?: number);
}

// Specific exceptions
export class RateLimitException extends ShieldException {
  constructor(message?: string, retryAfter?: number);
}

export class ThrottleException extends ShieldException {
  constructor(message?: string, retryAfter?: number);
}

export class CircuitBreakerException extends ShieldException {
  constructor(message?: string);
}

export class OverloadException extends ShieldException {
  constructor(message?: string);
}
```

## Storage Adapters

### IStorageAdapter Interface

```typescript
interface IStorageAdapter {
  // Single operations
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  
  // Atomic operations
  increment(key: string, value?: number): Promise<number>;
  decrement(key: string, value?: number): Promise<number>;
  
  // TTL operations
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;
  
  // Batch operations
  mget(keys: string[]): Promise<any[]>;
  mset(pairs: Array<[string, any]>, ttl?: number): Promise<void>;
  
  // Utility
  clear(): Promise<void>;
  close(): Promise<void>;
}
```

### Available Adapters

- **MemoryStorageAdapter** - In-memory storage using node-cache
- **RedisStorageAdapter** - Redis-based storage
- **MemcachedStorageAdapter** - Memcached-based storage
- **BaseStorageAdapter** - Abstract base class for custom adapters

## Metrics

### Metric Types

```typescript
enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}
```

### Available Metrics

| Metric Name | Type | Description | Labels |
|------------|------|-------------|---------|
| `rate_limit_consumed` | Counter | Rate limit points consumed | path, method |
| `rate_limit_exceeded` | Counter | Rate limit violations | path, method |
| `throttle_consumed` | Counter | Throttle requests processed | path, method |
| `throttle_exceeded` | Counter | Throttle violations | path, method |
| `circuit_breaker_fires` | Counter | Circuit breaker executions | key |
| `circuit_breaker_successes` | Counter | Successful executions | key |
| `circuit_breaker_failures` | Counter | Failed executions | key |
| `circuit_breaker_timeouts` | Counter | Timeout occurrences | key |
| `circuit_breaker_fallbacks` | Counter | Fallback executions | key |
| `circuit_breaker_rejects` | Counter | Rejected requests | key |
| `circuit_breaker_state` | Gauge | Current state (0=closed, 1=open, 2=half-open) | key, state |
| `overload_requests_accepted` | Counter | Accepted requests | - |
| `overload_requests_queued` | Counter | Queued requests | - |
| `overload_requests_rejected` | Counter | Rejected requests | - |
| `overload_queue_size` | Gauge | Current queue size | - |
| `overload_concurrent_requests` | Gauge | Current concurrent requests | - |
| `overload_health_score` | Gauge | System health score (0-1) | - |

## Utilities

### Context Builder

```typescript
// Build protection context from Express request
const context = buildContext(req: Request): IProtectionContext;

// Build context from Fastify request
const context = buildContextFastify(req: FastifyRequest): IProtectionContext;
```

### Configuration Validation

```typescript
// Validate shield configuration
validateConfig(config: IShieldConfig): void;

// Merge configurations with defaults
mergeConfig(config: Partial<IShieldConfig>, defaults: IShieldConfig): IShieldConfig;
```

### Key Generators

```typescript
// Default key generators
const defaultKeyGenerators = {
  ip: (ctx: IProtectionContext) => ctx.ip,
  user: (ctx: IProtectionContext) => ctx.user?.id || ctx.ip,
  apiKey: (ctx: IProtectionContext) => ctx.headers['x-api-key'] || ctx.ip,
  path: (ctx: IProtectionContext) => `${ctx.method}:${ctx.path}:${ctx.ip}`,
};
```

## Advanced Usage

### Custom Storage Adapter

```typescript
import { IStorageAdapter } from '@usex/nest-shield';

export class CustomStorageAdapter implements IStorageAdapter {
  async get(key: string): Promise<any> {
    // Implementation
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Implementation
  }
  
  // ... implement all required methods
}

// Use in configuration
ShieldModule.forRoot({
  storage: {
    type: 'custom',
    options: {
      adapter: new CustomStorageAdapter()
    }
  }
})
```

### Custom Metrics Collector

```typescript
import { IMetricsCollector } from '@usex/nest-shield';

export class CustomMetricsCollector implements IMetricsCollector {
  increment(metric: string, value: number, labels?: Record<string, string>): void {
    // Send to your metrics system
  }
  
  // ... implement all required methods
}
```

### Extension Points

```typescript
// Custom exception handler
ShieldModule.forRoot({
  global: {
    errorHandler: (error: Error, context: IProtectionContext) => {
      // Custom error handling
      logger.error('Shield error', { error, context });
    }
  }
})

// Custom key generator
ShieldModule.forRoot({
  rateLimit: {
    keyGenerator: (context: IProtectionContext) => {
      // Custom logic
      return generateCustomKey(context);
    }
  }
})

// Custom priority function
ShieldModule.forRoot({
  overload: {
    priorityFunction: (context: IProtectionContext) => {
      // Calculate priority
      return calculatePriority(context);
    }
  }
})
```

## TypeScript Support

NestShield is written in TypeScript and provides full type definitions:

```typescript
import type {
  IProtectionContext,
  IProtectionResult,
  IShieldOptions,
  IRateLimitOptions,
  ICircuitBreakerOptions,
  IThrottleOptions,
  IOverloadOptions,
  IStorageAdapter,
  IMetricsCollector
} from '@usex/nest-shield';
```

## Next Steps

- See [Decorators Reference](./decorators.md) for detailed decorator documentation
- See [Services Reference](./services.md) for detailed service documentation
- See [Interfaces Reference](./interfaces.md) for complete interface definitions
- Check [Examples](../examples/index.md) for practical implementations

---

<p align="center">
  Need help? <a href="https://discord.gg/nestshield">Join our Discord</a> • <a href="https://github.com/ali-master/nest-shield/issues">Report an Issue</a>
</p>