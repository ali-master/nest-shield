# ShieldModule configuration reference

The full options object passed to `ShieldModule.forRoot(config)`. Every section is optional; omitted sections use sensible defaults. Each protection section has its own `enabled` flag.

## Top-level shape

```typescript
ShieldModule.forRoot({
  global?:         IGlobalProtectionConfig,
  storage?:        IStorageConfig,
  rateLimit?:      IRateLimitConfig,
  throttle?:       IThrottleConfig,
  circuitBreaker?: ICircuitBreakerConfig,
  overload?:       IOverloadConfig,
  metrics?:        IMetricsConfig,
  adapters?:       IAdapterConfig,
  advanced?:       IAdvancedConfig,
})
```

## global

```typescript
global: {
  enabled: boolean,                         // master switch for the global guard
  excludePaths?: string[] | RegExp[],       // routes never protected (health, webhooks)
  includePaths?: string[] | RegExp[],       // restrict protection to these only
  bypassTokens?: string[],                  // requests carrying one of these skip protection
  errorHandler?: (error, context) => void,
  logging?: { enabled: boolean, level?: "debug" | "info" | "warn" | "error" },
}
```

## storage

```typescript
storage: {
  type: "memory" | "redis" | "memcached" | "custom",
  options?: any,                  // driver options (e.g. redis host/port/keyPrefix)
  customAdapter?: IStorageAdapter // when type is "custom"
}
```

See `storage-and-scaling.md` for driver details and the redis connection that rate limiting shares.

## rateLimit

Fixed quota over a window. Backed by `rate-limiter-flexible`.

```typescript
rateLimit: {
  enabled: boolean,
  points: number,                 // max requests per window
  duration: number,               // window length, seconds
  blockDuration?: number,         // seconds to keep blocking after the limit is hit
  keyGenerator?: (context) => string,        // identity for the counter (default: per route + ip/user)
  skipSuccessfulRequests?: boolean,
  skipFailedRequests?: boolean,
  customResponseMessage?: string | ((context) => string),
  customHeaders?: Record<string, string>,
}
```

## throttle

Token-bucket smoothing of bursts.

```typescript
throttle: {
  enabled: boolean,
  limit: number,                  // tokens per ttl
  ttl: number,                    // refill window, seconds
  keyGenerator?: (context) => string,
  ignoreUserAgents?: RegExp[],
  customResponseMessage?: string | ((context) => string),
  customHeaders?: Record<string, string>,
}
```

## circuitBreaker

```typescript
circuitBreaker: {
  enabled: boolean,
  timeout?: number,                       // ms before a call is a failure (default 3000)
  errorThresholdPercentage?: number,      // % failures that opens the breaker (default 50)
  resetTimeout?: number,                  // ms before trying half-open (default 30000)
  rollingCountTimeout?: number,
  rollingCountBuckets?: number,
  volumeThreshold?: number,               // min calls before the breaker can open
  allowWarmUp?: boolean,
  fallback?: (error, args, context) => any,  // result returned while open / on failure
  healthCheck?: () => Promise<boolean>,
}
```

## overload

In-flight concurrency limit with a queue and load shedding.

```typescript
overload: {
  enabled: boolean,
  maxConcurrentRequests?: number,
  maxQueueSize?: number,
  queueTimeout?: number,                  // ms a request may wait in queue
  shedStrategy?: "fifo" | "lifo" | "priority" | "random" | "custom",
  priorityFunction?: (context) => number,
  customShedFunction?: (queue) => any[],
  healthIndicator?: () => Promise<number>,
  adaptiveThreshold?: {                   // auto-tune the concurrency limit
    enabled: boolean,
    minThreshold: number,
    maxThreshold: number,
    adjustmentInterval: number,           // ms
  },
}
```

## metrics

```typescript
metrics: {
  enabled: boolean,
  type: "prometheus" | "statsd" | "datadog" | "cloudwatch" | "json" | "openmetrics" | "custom",
  prefix?: string,
  labels?: Record<string, string>,
  customCollector?: IMetricsCollector,
  exportInterval?: number,
  buckets?: number[],
  percentiles?: number[],
  flushInterval?: number,
  maxBufferSize?: number,
}
```

## advanced

```typescript
advanced: {
  gracefulShutdown?: { enabled: boolean, timeout: number, beforeShutdown?, onShutdown? },
  requestPriority?:  { enabled: boolean, defaultPriority: number },
  adaptiveProtection?: { enabled, learningPeriod, adjustmentInterval, sensitivityFactor },
  distributedSync?:  { enabled: boolean, syncInterval: number, channel: string },
}
```

`gracefulShutdown` requires `app.enableShutdownHooks()` in `main.ts`. `distributedSync` coordinates state across cluster nodes and needs a shared (redis) store.

## Async configuration

When config depends on other providers:

```typescript
ShieldModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    storage: { type: "redis", options: { host: config.get("REDIS_HOST"), port: 6379 } },
    rateLimit: { enabled: true, points: config.get("RATE_LIMIT"), duration: 60 },
  }),
})
```
