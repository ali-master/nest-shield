# Decorators Reference

<p align="center">
  <img src="../../assets/logo.svg" alt="NestShield" width="120">
</p>

Complete reference for all NestShield decorators with detailed examples and use cases.

## 📋 Table of Contents

- [Protection Decorators](#protection-decorators)
  - [@Shield](#shield)
  - [@RateLimit](#ratelimit)
  - [@Throttle](#throttle)
  - [@CircuitBreaker](#circuitbreaker)
- [Utility Decorators](#utility-decorators)
  - [@BypassShield](#bypassshield)
  - [@Priority](#priority)
  - [@ShieldContext](#shieldcontext)
- [Decorator Composition](#decorator-composition)
- [Custom Decorators](#custom-decorators)

## Protection Decorators

### @Shield

The main decorator that combines all protection strategies in one.

```typescript
@Shield(options?: IShieldOptions)
```

#### Options

```typescript
interface IShieldOptions {
  rateLimit?: IRateLimitOptions;
  throttle?: IThrottleOptions;
  circuitBreaker?: ICircuitBreakerOptions;
  overload?: IOverloadOptions;
  bypass?: boolean;
  priority?: number;
}
```

#### Examples

**Basic Usage**
```typescript
@Controller('api')
export class ApiController {
  @Get('data')
  @Shield({
    rateLimit: { points: 100, duration: 60 },
    throttle: { limit: 10, ttl: 60 }
  })
  getData() {
    return this.service.getData();
  }
}
```

**Class-Level Protection**
```typescript
@Controller('users')
@Shield({
  rateLimit: { points: 1000, duration: 3600 },
  circuitBreaker: { timeout: 5000 },
  overload: { maxConcurrentRequests: 50 }
})
export class UserController {
  // All methods inherit these protections
}
```

**Advanced Configuration**
```typescript
@Post('process')
@Shield({
  rateLimit: {
    points: 10,
    duration: 60,
    keyGenerator: (ctx) => `${ctx.user?.id}:${ctx.path}`,
    customResponseMessage: () => 'Too many processing requests'
  },
  circuitBreaker: {
    timeout: 30000,
    errorThresholdPercentage: 25,
    fallback: async (error) => ({
      status: 'queued',
      message: 'Request queued for processing'
    })
  },
  overload: {
    maxConcurrentRequests: 5,
    queueSize: 100,
    shedStrategy: 'priority'
  },
  priority: 8
})
async processData(@Body() data: any) {
  return this.service.process(data);
}
```

### @RateLimit

Controls the total number of requests allowed within a time window.

```typescript
@RateLimit(options?: IRateLimitOptions)
```

#### Options

```typescript
interface IRateLimitOptions {
  points?: number;              // Number of requests allowed
  duration?: number;            // Time window in seconds
  blockDuration?: number;       // Block duration when limit exceeded
  keyGenerator?: (context: IProtectionContext) => string;
  customResponseMessage?: (context: IProtectionContext) => string;
  customHeaders?: Record<string, string>;
  ignoreUserAgents?: RegExp[];
  skipIf?: (context: IProtectionContext) => boolean;
}
```

#### Examples

**Simple Rate Limiting**
```typescript
@Get('search')
@RateLimit({ points: 10, duration: 60 }) // 10 requests per minute
search(@Query('q') query: string) {
  return this.service.search(query);
}
```

**User-Based Rate Limiting**
```typescript
@Post('upload')
@RateLimit({
  points: 5,
  duration: 3600,
  keyGenerator: (ctx) => `upload:${ctx.user?.id || ctx.ip}`
})
uploadFile(@UploadedFile() file: Express.Multer.File) {
  return this.service.upload(file);
}
```

**Conditional Rate Limiting**
```typescript
@Get('api/data')
@RateLimit({
  points: 100,
  duration: 60,
  skipIf: (ctx) => {
    // Skip rate limiting for premium users
    return ctx.user?.subscription === 'premium';
  },
  customHeaders: {
    'X-RateLimit-Tier': 'standard'
  }
})
getData() {
  return this.service.getData();
}
```

**Different Limits by API Key**
```typescript
@Get('translate')
@RateLimit({
  points: 1000, // Default
  duration: 3600,
  keyGenerator: (ctx) => {
    const apiKey = ctx.headers['x-api-key'];
    return `api:${apiKey}`;
  },
  customResponseMessage: (ctx) => {
    const apiKey = ctx.headers['x-api-key'];
    return `API key ${apiKey} has exceeded its hourly limit`;
  }
})
translate(@Body() text: string) {
  return this.translationService.translate(text);
}
```

### @Throttle

Limits the frequency of requests (minimum time between requests).

```typescript
@Throttle(options?: IThrottleOptions)
```

#### Options

```typescript
interface IThrottleOptions {
  limit?: number;     // Number of requests allowed
  ttl?: number;       // Time window in seconds
  keyGenerator?: (context: IProtectionContext) => string;
  customResponseMessage?: (context: IProtectionContext) => string;
  ignoreUserAgents?: RegExp[];
  skipIf?: (context: IProtectionContext) => boolean;
}
```

#### Examples

**Basic Throttling**
```typescript
@Post('comment')
@Throttle({ limit: 1, ttl: 10 }) // Max 1 comment every 10 seconds
createComment(@Body() comment: CreateCommentDto) {
  return this.commentService.create(comment);
}
```

**Path-Specific Throttling**
```typescript
@Get('expensive-operation')
@Throttle({
  limit: 1,
  ttl: 60,
  keyGenerator: (ctx) => `expensive:${ctx.ip}`
})
expensiveOperation() {
  return this.service.performExpensiveOperation();
}
```

**Ignore Bots**
```typescript
@Get('content')
@Throttle({
  limit: 10,
  ttl: 60,
  ignoreUserAgents: [
    /googlebot/i,
    /bingbot/i,
    /slackbot/i
  ]
})
getContent() {
  return this.contentService.getAll();
}
```

### @CircuitBreaker

Prevents cascade failures by stopping calls to failing services.

```typescript
@CircuitBreaker(options?: ICircuitBreakerOptions)
```

#### Options

```typescript
interface ICircuitBreakerOptions {
  timeout?: number;                    // Request timeout in milliseconds
  errorThresholdPercentage?: number;   // Error percentage to open circuit
  volumeThreshold?: number;            // Minimum requests before opening
  resetTimeout?: number;               // Time before trying again (ms)
  rollingCountTimeout?: number;        // Window for rolling metrics
  fallback?: (error: Error, context: IProtectionContext) => any;
  healthCheck?: () => Promise<boolean>;
  halfOpenRequestCount?: number;
  allowWarmUp?: boolean;
}
```

#### Examples

**Basic Circuit Breaker**
```typescript
@Get('external-data')
@CircuitBreaker({
  timeout: 5000,
  errorThresholdPercentage: 50
})
async getExternalData() {
  return this.externalService.fetchData();
}
```

**With Fallback**
```typescript
@Get('weather')
@CircuitBreaker({
  timeout: 3000,
  errorThresholdPercentage: 30,
  fallback: async (error, context) => {
    console.error('Weather service failed:', error);
    
    // Return cached data
    const cached = await this.cache.get('weather:latest');
    return {
      ...cached,
      cached: true,
      error: 'Real-time data unavailable'
    };
  }
})
async getWeather(@Query('city') city: string) {
  return this.weatherService.getCurrent(city);
}
```

**With Health Check**
```typescript
@Get('payment/process')
@CircuitBreaker({
  timeout: 10000,
  errorThresholdPercentage: 20,
  volumeThreshold: 5,
  resetTimeout: 60000,
  healthCheck: async () => {
    try {
      const response = await fetch('https://payment-api.com/health');
      return response.ok;
    } catch {
      return false;
    }
  },
  fallback: async (error) => ({
    status: 'pending',
    message: 'Payment queued for processing',
    retryAfter: 60
  })
})
async processPayment(@Body() payment: PaymentDto) {
  return this.paymentService.process(payment);
}
```

**Database Protection**
```typescript
@Injectable()
export class DatabaseService {
  @CircuitBreaker({
    timeout: 5000,
    errorThresholdPercentage: 40,
    allowWarmUp: true,
    fallback: async (error, context) => {
      // Use read replica or cache
      return this.readReplica.query(context.metadata.query);
    }
  })
  async query(sql: string) {
    return this.primaryDb.query(sql);
  }
}
```

## Utility Decorators

### @BypassShield

Exempts specific endpoints from all protection mechanisms.

```typescript
@BypassShield()
```

#### Examples

**Health Check Endpoint**
```typescript
@Controller()
export class HealthController {
  @Get('health')
  @BypassShield()
  healthCheck() {
    return { status: 'ok', timestamp: Date.now() };
  }
}
```

**Public Endpoints**
```typescript
@Controller('public')
@Shield({
  rateLimit: { points: 100, duration: 60 }
})
export class PublicController {
  @Get('docs')
  @BypassShield() // No protection for documentation
  getDocs() {
    return this.docsService.getPublicDocs();
  }
  
  @Get('api')
  // This inherits class-level protection
  getApi() {
    return this.apiService.getData();
  }
}
```

**Metrics Endpoint**
```typescript
@Get('metrics')
@BypassShield()
async exportMetrics() {
  return this.metricsService.export('prometheus');
}
```

### @Priority

Sets request priority for overload management and queue ordering.

```typescript
@Priority(level: number)
```

Priority levels: 0 (lowest) to 10 (highest)

#### Examples

**Critical Operations**
```typescript
@Post('emergency-alert')
@Priority(10) // Highest priority
sendEmergencyAlert(@Body() alert: AlertDto) {
  return this.alertService.sendEmergency(alert);
}
```

**Tiered Priorities**
```typescript
@Controller('api')
export class ApiController {
  @Post('payment')
  @Priority(9)
  processPayment() {
    // High priority
  }
  
  @Get('user-data')
  @Priority(5)
  getUserData() {
    // Medium priority
  }
  
  @Get('analytics')
  @Priority(1)
  getAnalytics() {
    // Low priority - first to be dropped
  }
}
```

**Dynamic Priority**
```typescript
@Post('task')
@Shield({
  overload: {
    priorityFunction: (context) => {
      const taskType = context.body?.type;
      const priorities = {
        'critical': 10,
        'high': 7,
        'normal': 5,
        'low': 2
      };
      return priorities[taskType] || 5;
    }
  }
})
createTask(@Body() task: TaskDto) {
  return this.taskService.create(task);
}
```

### @ShieldContext

Injects the protection context into method parameters.

```typescript
@ShieldContext()
```

#### Examples

**Access Context Information**
```typescript
@Get('info')
async getInfo(@ShieldContext() context: IProtectionContext) {
  return {
    clientIp: context.ip,
    userAgent: context.headers['user-agent'],
    user: context.user,
    requestId: context.requestId,
    timestamp: context.timestamp
  };
}
```

**Custom Rate Limiting Logic**
```typescript
@Post('api/request')
async handleRequest(
  @Body() data: any,
  @ShieldContext() context: IProtectionContext
) {
  // Custom rate limiting based on context
  const tier = context.user?.tier || 'free';
  const limits = {
    free: { points: 10, duration: 3600 },
    pro: { points: 100, duration: 3600 },
    enterprise: { points: 1000, duration: 3600 }
  };
  
  const result = await this.rateLimitService.consume(context, limits[tier]);
  
  if (!result.allowed) {
    throw new HttpException({
      message: 'Rate limit exceeded',
      remaining: result.metadata.remaining,
      reset: new Date(result.metadata.reset)
    }, 429);
  }
  
  return this.service.process(data);
}
```

**Logging and Monitoring**
```typescript
@Post('action')
async performAction(
  @Body() action: ActionDto,
  @ShieldContext() context: IProtectionContext
) {
  // Log with context
  this.logger.info('Action performed', {
    action: action.type,
    user: context.user?.id,
    ip: context.ip,
    requestId: context.requestId
  });
  
  // Track metrics
  this.metrics.increment('actions', 1, {
    type: action.type,
    user_tier: context.user?.tier || 'anonymous'
  });
  
  return this.actionService.perform(action);
}
```

## Decorator Composition

### Combining Multiple Decorators

Decorators can be combined for layered protection:

```typescript
@Controller('api')
export class ApiController {
  @Get('search')
  @RateLimit({ points: 100, duration: 60 })
  @Throttle({ limit: 10, ttl: 60 })
  @CircuitBreaker({ timeout: 5000 })
  @Priority(7)
  async search(@Query('q') query: string) {
    return this.searchService.search(query);
  }
}
```

### Order of Execution

When multiple decorators are applied, they execute in this order:
1. `@BypassShield` (if present, skips all others)
2. `@Priority` (sets request priority)
3. `@Shield` (or individual protection decorators)
4. Guards execute protection checks
5. `@ShieldContext` injects context

### Class and Method Level Combination

```typescript
@Controller('products')
@Shield({
  // Default protection for all methods
  rateLimit: { points: 1000, duration: 3600 },
  circuitBreaker: { timeout: 5000 }
})
export class ProductController {
  @Get()
  // Inherits class-level protection
  findAll() {
    return this.productService.findAll();
  }
  
  @Get('search')
  @RateLimit({ points: 10, duration: 60 }) // Override rate limit
  // Keeps class-level circuit breaker
  search(@Query('q') query: string) {
    return this.productService.search(query);
  }
  
  @Get('featured')
  @BypassShield() // No protection
  getFeatured() {
    return this.productService.getFeatured();
  }
}
```

## Custom Decorators

### Creating Protection Decorators

You can create custom decorators that leverage NestShield:

```typescript
// Custom decorator for authenticated endpoints
export function AuthenticatedRateLimit(pointsMultiplier: number = 1) {
  return applyDecorators(
    UseGuards(AuthGuard),
    RateLimit({
      points: 100 * pointsMultiplier,
      duration: 3600,
      keyGenerator: (ctx) => `auth:${ctx.user.id}`
    })
  );
}

// Usage
@Get('premium-data')
@AuthenticatedRateLimit(10) // 1000 requests per hour
getPremiumData() {
  return this.dataService.getPremium();
}
```

### Composite Protection Patterns

```typescript
// API tier decorators
export function FreeTierLimit() {
  return Shield({
    rateLimit: { points: 100, duration: 3600 },
    throttle: { limit: 10, ttl: 60 },
    overload: { maxConcurrentRequests: 5 }
  });
}

export function ProTierLimit() {
  return Shield({
    rateLimit: { points: 1000, duration: 3600 },
    throttle: { limit: 100, ttl: 60 },
    overload: { maxConcurrentRequests: 50 }
  });
}

export function EnterpriseTierLimit() {
  return Shield({
    rateLimit: { points: 10000, duration: 3600 },
    overload: { maxConcurrentRequests: 500 }
  });
}
```

### Dynamic Decorator Configuration

```typescript
// Factory for dynamic limits
export function DynamicRateLimit() {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const context = args.find(arg => arg.__shieldContext);
      
      // Dynamic configuration based on context
      const config = await getDynamicConfig(context);
      
      // Apply rate limiting
      const result = await this.rateLimitService.consume(context, config);
      
      if (!result.allowed) {
        throw new RateLimitException();
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}
```

## Best Practices

### 1. Layer Your Protection
```typescript
@Controller('api')
@Shield({
  // Base protection for all endpoints
  rateLimit: { points: 1000, duration: 3600 }
})
export class ApiController {
  @Get('search')
  @RateLimit({ points: 10, duration: 60 }) // Additional restriction
  search() {}
}
```

### 2. Use Appropriate Strategies
- **Rate Limiting**: For API quotas and preventing abuse
- **Throttling**: For preventing bursts and ensuring fair usage
- **Circuit Breaker**: For external services and preventing cascades
- **Overload Protection**: For managing system capacity

### 3. Provide Meaningful Fallbacks
```typescript
@CircuitBreaker({
  fallback: async (error, context) => {
    // Don't expose internal errors
    logger.error('Service failed', { error, context });
    
    // Return user-friendly response
    return {
      error: 'Service temporarily unavailable',
      retryAfter: 60
    };
  }
})
```

### 4. Monitor Everything
```typescript
@Get('critical-endpoint')
@Shield({
  rateLimit: {
    points: 100,
    duration: 60,
    customHeaders: {
      'X-Monitor': 'critical',
      'X-Alert-Threshold': '80'
    }
  }
})
```

## Next Steps

- [Services Reference](./services.md) - Detailed service documentation
- [Interfaces Reference](./interfaces.md) - TypeScript interfaces
- [Examples](../examples/index.md) - Real-world implementations
- [Custom Strategies](../advanced/custom-strategies.md) - Build your own

---

<p align="center">
  Need help? <a href="https://discord.gg/nestshield">Join our Discord</a> • <a href="https://github.com/ali-master/nest-shield/issues">Report an Issue</a>
</p>