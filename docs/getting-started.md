# Getting Started with NestShield

<p align="center">
  <img src="../assets/logo.svg" alt="NestShield" width="120">
</p>

Welcome to NestShield! This guide will help you get up and running with enterprise-grade API protection in just a few minutes.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Your First Protected Endpoint](#your-first-protected-endpoint)
- [Understanding Protection Types](#understanding-protection-types)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have:

- Node.js (v16 or higher)
- NestJS application (v9.0.0 or higher)
- npm, yarn, or pnpm package manager
- Basic understanding of NestJS decorators and modules

## Installation

### Using npm
```bash
npm install @usex/nest-shield
```

### Using yarn
```bash
yarn add @usex/nest-shield
```

### Using pnpm
```bash
pnpm add @usex/nest-shield
```

### Optional Dependencies

For production deployments, you may also want to install:

```bash
# For Redis storage (recommended for production)
npm install redis ioredis

# For Memcached storage
npm install memcached

# For Prometheus metrics
npm install prom-client

# For StatsD metrics
npm install node-statsd
```

## Basic Setup

### 1. Import ShieldModule

Add NestShield to your application module:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ShieldModule } from '@usex/nest-shield';

@Module({
  imports: [
    ShieldModule.forRoot({
      // Global configuration
      global: {
        enabled: true,              // Enable protection globally
        bypassForDevelopment: true, // Disable in development
      },
      
      // Basic rate limiting
      rateLimit: {
        enabled: true,
        points: 100,    // Allow 100 requests
        duration: 60,   // Per 60 seconds
      },
      
      // Storage configuration
      storage: {
        type: 'memory', // Use in-memory storage (default)
      }
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Global Protection (Optional)

To protect all endpoints by default, use the global configuration:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ShieldGuard } from '@usex/nest-shield';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply Shield protection globally
  app.useGlobalGuards(app.get(ShieldGuard));
  
  await app.listen(3000);
}
bootstrap();
```

## Your First Protected Endpoint

### Simple Rate Limiting

Protect an endpoint with basic rate limiting:

```typescript
import { Controller, Get } from '@nestjs/common';
import { RateLimit } from '@usex/nest-shield';

@Controller('api')
export class ApiController {
  @Get('search')
  @RateLimit({ 
    points: 10,      // 10 requests
    duration: 60     // per minute
  })
  async search(@Query('q') query: string) {
    return { results: await this.searchService.search(query) };
  }
}
```

### Multiple Protection Layers

Combine different protection strategies:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Shield, Throttle, CircuitBreaker } from '@usex/nest-shield';

@Controller('api')
export class ApiController {
  @Get('data')
  @Shield({
    rateLimit: { points: 100, duration: 3600 },  // 100 req/hour
    throttle: { limit: 10, ttl: 60 },            // Max 10 req/min
    circuitBreaker: {                            // Circuit breaker
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    }
  })
  async getData() {
    return this.dataService.fetchData();
  }
}
```

### Class-Level Protection

Protect all endpoints in a controller:

```typescript
@Controller('users')
@Shield({
  rateLimit: { points: 1000, duration: 3600 },
  overload: {
    maxConcurrentRequests: 50,
    queueSize: 100
  }
})
export class UserController {
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @RateLimit({ points: 50, duration: 60 }) // Override class-level config
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }
}
```

## Understanding Protection Types

### 🚦 Rate Limiting
Controls the total number of requests over a time period.

**Use when:** You want to enforce API quotas or prevent abuse.

```typescript
@RateLimit({ 
  points: 100,      // Number of requests allowed
  duration: 3600,   // Time window in seconds (1 hour)
  keyGenerator: (ctx) => ctx.ip  // Custom key generation
})
```

### ⏱️ Throttling
Limits the frequency of requests (minimum time between requests).

**Use when:** You want to prevent request bursts.

```typescript
@Throttle({ 
  limit: 5,    // Allow 5 requests
  ttl: 60      // Per 60 seconds
})
```

### 🔌 Circuit Breaker
Stops calling failing services to prevent cascade failures.

**Use when:** Calling external services or databases.

```typescript
@CircuitBreaker({
  timeout: 5000,                  // Request timeout (5s)
  errorThresholdPercentage: 50,   // Open circuit if 50% fail
  resetTimeout: 30000,            // Try again after 30s
  fallback: async () => ({        // Fallback response
    cached: true,
    data: []
  })
})
```

### 🏋️ Overload Protection
Manages system capacity during high load.

**Use when:** You need to handle traffic spikes gracefully.

```typescript
@Shield({
  overload: {
    maxConcurrentRequests: 100,  // Process 100 concurrent requests
    queueSize: 1000,            // Queue up to 1000 requests
    queueTimeout: 30000,        // Timeout queued requests after 30s
    shedStrategy: 'fifo'        // First in, first out
  }
})
```

## Real-World Example

Here's a complete example of a protected API controller:

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { 
  Shield, 
  RateLimit, 
  Throttle, 
  CircuitBreaker,
  BypassShield,
  ShieldContext,
  IProtectionContext
} from '@usex/nest-shield';

@Controller('products')
@Shield({
  // Default protection for all endpoints
  rateLimit: { points: 1000, duration: 3600 },
  throttle: { limit: 20, ttl: 60 }
})
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly searchService: SearchService,
  ) {}

  // Basic endpoint with inherited protection
  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  // Stricter limits for resource-intensive search
  @Get('search')
  @RateLimit({ points: 10, duration: 60 })
  @CircuitBreaker({
    timeout: 3000,
    errorThresholdPercentage: 30,
    fallback: async () => ({
      results: [],
      cached: true,
      message: 'Search is temporarily unavailable'
    })
  })
  async search(@Query('q') query: string) {
    return this.searchService.searchProducts(query);
  }

  // Public endpoint without protection
  @Get('featured')
  @BypassShield()
  async getFeatured() {
    return this.productService.getFeatured();
  }

  // Different limits based on user tier
  @Post()
  async create(
    @Body() createDto: CreateProductDto,
    @ShieldContext() context: IProtectionContext,
  ) {
    // Custom rate limiting based on user tier
    const tier = context.user?.tier || 'free';
    const limits = {
      free: { points: 10, duration: 3600 },
      pro: { points: 100, duration: 3600 },
      enterprise: { points: 1000, duration: 3600 }
    };

    await this.rateLimitService.consume(context, limits[tier]);
    
    return this.productService.create(createDto);
  }

  // Protected external API call
  @Get(':id/reviews')
  @CircuitBreaker({
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000
  })
  async getReviews(@Param('id') id: string) {
    return this.productService.fetchExternalReviews(id);
  }
}
```

## Testing Your Protection

### 1. Test Rate Limiting

```bash
# Make rapid requests to test rate limiting
for i in {1..15}; do
  curl http://localhost:3000/api/search?q=test
  echo
done
# After 10 requests, you should see 429 Too Many Requests
```

### 2. Monitor Metrics

```typescript
// metrics.controller.ts
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @BypassShield() // Don't protect metrics endpoint
  async getMetrics() {
    return this.metricsService.export();
  }
}
```

### 3. Check Protection Status

```typescript
@Get('shield-status')
@BypassShield()
async getShieldStatus(@ShieldContext() context: IProtectionContext) {
  return {
    rateLimit: await this.rateLimitService.getRemaining(context),
    circuitBreakers: this.circuitBreakerService.getAllStats(),
    overload: this.overloadService.getStatus()
  };
}
```

## Common Patterns

### API Key-Based Rate Limiting

```typescript
ShieldModule.forRoot({
  rateLimit: {
    keyGenerator: (context: IProtectionContext) => {
      const apiKey = context.headers['x-api-key'];
      return apiKey ? `api:${apiKey}` : `ip:${context.ip}`;
    }
  }
})
```

### User-Based Rate Limiting

```typescript
ShieldModule.forRoot({
  rateLimit: {
    keyGenerator: (context: IProtectionContext) => {
      const userId = context.user?.id;
      return userId ? `user:${userId}` : `ip:${context.ip}`;
    }
  }
})
```

### Environment-Specific Configuration

```typescript
ShieldModule.forRoot({
  global: {
    enabled: process.env.NODE_ENV === 'production',
    bypassForDevelopment: process.env.NODE_ENV === 'development'
  },
  storage: {
    type: process.env.NODE_ENV === 'production' ? 'redis' : 'memory',
    options: process.env.NODE_ENV === 'production' ? {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD
    } : {}
  }
})
```

## Next Steps

Now that you have NestShield up and running:

1. **[Configuration Guide](./configuration.md)** - Deep dive into all configuration options
2. **[Storage Backends](./storage/index.md)** - Set up Redis or Memcached for production
3. **[Metrics & Monitoring](./features/metrics.md)** - Integrate with your monitoring stack
4. **[Examples](./examples/index.md)** - See real-world implementation patterns
5. **[Production Deployment](./deployment/production.md)** - Best practices for production

## Need Help?

- 📖 Check our [FAQ](./faq.md)
- 🐛 Report issues on [GitHub](https://github.com/ali-master/nest-shield/issues)
- 📧 Email us at ali_4286@live.com

---

<p align="center">
  <strong>Ready to protect your API?</strong><br>
  Continue to <a href="./basic-usage.md">Basic Usage →</a>
</p>
