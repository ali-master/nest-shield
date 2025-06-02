<p align="center">
  <img src="./assets/logo.svg" alt="NestJS Shield - Enterprise-grade protection for NestJS applications">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@usex/nest-shield">
    <img src="https://img.shields.io/npm/v/@usex/nest-shield.svg" alt="npm version">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg" alt="TypeScript">
  </a>
  <a href="https://nestjs.com/">
    <img src="https://img.shields.io/badge/NestJS-10.0+-red.svg" alt="NestJS">
  </a>
</p>

## 🎯 What is NestShield?

NestShield is your API's personal security detail - a comprehensive protection system that keeps your NestJS applications running smoothly even under the heaviest loads. Think of it as a bouncer, traffic controller, and emergency responder all rolled into one elegant package.

### Why Your API Needs Protection

```typescript
// Without NestShield 😰
app.get('/api/search', async (req, res) => {
  // One viral tweet later...
  // 💥 Server crashes with 10,000 requests/second
});

// With NestShield 😎
@Get('api/search')
@RateLimit({ points: 100, duration: 60 })
@CircuitBreaker({ timeout: 5000 })
async search() {
  // Your server: "Is that all you got?" 💪
}
```

## 🚀 Quick Start (60 seconds)

```bash
# Install
npm install @usex/nest-shield

# Add to your module
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ShieldModule } from '@usex/nest-shield';

@Module({
  imports: [
    ShieldModule.forRoot({
      global: { enabled: true },
      rateLimit: {
        enabled: true,
        points: 100,    // 100 requests
        duration: 60,   // per 60 seconds
      }
    }),
  ],
})
export class AppModule {}
```

That's it! Your API is now protected. 🎉

## 🎭 Real-World Scenarios

### Scenario 1: The Reddit Hug of Death

Your app just hit the front page of Reddit. Traffic increased 100x in 30 seconds.

```typescript
@Controller('api')
@Shield({
  rateLimit: { points: 1000, duration: 60 },
  overload: {
    maxConcurrentRequests: 100,
    queueSize: 1000,
    queueStrategy: 'FIFO'
  }
})
export class ApiController {
  @Get('trending-content')
  @CircuitBreaker({
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    fallback: async () => ({
      data: await this.cache.getTrendingContent(),
      cached: true
    })
  })
  async getTrending() {
    return this.contentService.getTrending();
  }
}
```

### Scenario 2: The Midnight Database Meltdown

It's 3 AM. Your database is having a bad day. Your on-call engineer is asleep.

```typescript
@Injectable()
export class DatabaseService {
  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async query(sql: string) {
    return this.circuitBreaker.execute(
      'database',
      async () => this.db.query(sql),
      context,
      {
        timeout: 5000,
        fallback: async (error) => {
          // Return cached data instead of waking up the on-call
          this.metrics.increment('db_fallback_used');
          return this.cacheService.get(sql);
        }
      }
    );
  }
}
```

### Scenario 3: The Freemium Model

Different users, different limits. VIPs get the red carpet treatment.

```typescript
@Get('api/ai-generate')
async generateContent(
  @Headers('x-api-tier') tier: string,
  @Body() prompt: string,
  @ShieldContext() context: IProtectionContext,
) {
  // Free tier: 10 requests/hour
  // Pro tier: 100 requests/hour  
  // Enterprise: Unlimited
  
  const limits = {
    free: { points: 10, duration: 3600 },
    pro: { points: 100, duration: 3600 },
    enterprise: { points: 99999, duration: 1 }
  };
  
  const result = await this.rateLimitService.consume(
    context,
    limits[tier] || limits.free
  );
  
  if (!result.allowed) {
    throw new HttpException({
      message: 'Rate limit exceeded',
      upgrade_url: 'https://your-app.com/pricing',
      reset_at: new Date(result.reset)
    }, 429);
  }
  
  return this.aiService.generate(prompt);
}
```

## 💡 Protection Strategies Explained

### 🚦 Rate Limiting
**What**: Limits total requests over time  
**When**: API quotas, preventing abuse  
**Example**: "1000 requests per hour"

```typescript
@RateLimit({ points: 1000, duration: 3600 })
```

### ⏱️ Throttling  
**What**: Limits request frequency  
**When**: Preventing bursts, ensuring fair usage  
**Example**: "Max 10 requests per minute"

```typescript
@Throttle({ limit: 10, ttl: 60 })
```

### 🔌 Circuit Breaker
**What**: Stops calling failing services  
**When**: External APIs, databases issues  
**Example**: "If 50% requests fail, stop trying for 30 seconds"

```typescript
@CircuitBreaker({ 
  errorThresholdPercentage: 50,
  resetTimeout: 30000 
})
```

### 🏋️ Overload Protection
**What**: Manages system capacity  
**When**: Traffic spikes, DDoS attacks  
**Example**: "Queue up to 1000 requests, drop the rest"

```typescript
@Shield({
  overload: {
    maxConcurrentRequests: 100,
    queueSize: 1000,
    shedStrategy: 'priority'
  }
})
```

## 🔧 Configuration Deep Dive

### Storage Options

```typescript
// Development: In-Memory (Single Instance)
ShieldModule.forRoot({
  storage: { 
    type: 'memory',
    options: { maxKeys: 10000 }
  }
})

// Production: Redis (Multi-Instance)
ShieldModule.forRoot({
  storage: {
    type: 'redis',
    options: {
      host: 'redis.example.com',
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'shield:prod:'
    }
  }
})

// Alternative: Memcached
ShieldModule.forRoot({
  storage: {
    type: 'memcached',
    options: {
      servers: ['memcached1:11211', 'memcached2:11211']
    }
  }
})
```

### Advanced Features

#### 🌍 Distributed Synchronization
Perfect for microservices and Kubernetes deployments:

```typescript
ShieldModule.forRoot({
  advanced: {
    distributedSync: {
      enabled: true,
      nodeId: process.env.HOSTNAME,
      syncInterval: 5000,
      onNodeJoin: (nodeId) => {
        logger.info(`🤝 Node ${nodeId} joined the cluster`);
      }
    }
  }
})
```

#### 📊 Metrics & Monitoring
Track everything with Prometheus, StatsD, or your custom solution:

```typescript
ShieldModule.forRoot({
  metrics: {
    enabled: true,
    type: 'prometheus',
    labels: {
      app: 'my-api',
      env: process.env.NODE_ENV,
      region: process.env.AWS_REGION
    }
  }
})

// Access metrics
@Get('/metrics')
@BypassShield() // Don't protect metrics endpoint
exportMetrics() {
  return this.metricsService.export();
}
```

#### 🤖 Enterprise Anomaly Detection
**NEW!** Advanced AI-powered anomaly detection for production environments:

```typescript
import { EnterpriseAnomalyDetectionService } from '@usex/nest-shield';

ShieldModule.forRoot({
  advanced: {
    adaptiveProtection: {
      enabled: true,
      anomalyDetection: {
        enabled: true,
        detectorType: "Composite Anomaly Detector",
        sensitivity: 0.8,
        alerting: {
          enabled: true,
          channels: [
            {
              type: "SLACK",
              config: { webhook: process.env.SLACK_WEBHOOK }
            },
            {
              type: "EMAIL", 
              config: { recipients: ["ops@company.com"] }
            }
          ]
        },
        performance: {
          enabled: true,
          scaling: { maxInstances: 5, minInstances: 1 }
        }
      }
    }
  }
})

// In your service
@Injectable()
export class MonitoringService {
  constructor(
    private anomalyService: EnterpriseAnomalyDetectionService
  ) {}

  async detectAnomalies() {
    const metrics = [
      { metricName: 'response_time', value: 2500, timestamp: Date.now() },
      { metricName: 'error_rate', value: 0.15, timestamp: Date.now() }
    ];

    const anomalies = await this.anomalyService.detectAnomalies(metrics);
    
    for (const anomaly of anomalies) {
      console.log(`🚨 ${anomaly.severity} anomaly: ${anomaly.description}`);
    }
  }
}
```

**Features:**
- 🧠 **7 Advanced Detectors**: Z-Score, Isolation Forest, Seasonal, ML-based, and more
- 🔔 **Smart Alerting**: Multi-channel notifications with escalation policies  
- 📈 **Auto-Scaling**: Intelligent scaling based on performance metrics
- 🔒 **Enterprise Security**: Encryption, audit logging, compliance features
- 🌐 **Clustering**: Multi-node deployment with state synchronization
- 📊 **Rich Analytics**: Comprehensive reporting and trend analysis

📚 **Comprehensive Documentation:**
- [**Enterprise Anomaly Detection Guide**](docs/anomaly-detection/index.md) - Complete implementation guide
- [**The Science Behind Anomaly Detection**](docs/anomaly-detection/science.md) - Mathematical foundations and algorithms
- [**Detector Comparison & Selection Guide**](docs/anomaly-detection/comparison.md) - Choose the right detector for your use case
- [**Practical Examples & Use Cases**](docs/anomaly-detection/examples.md) - Real-world implementations and code examples

#### 🦅 Graceful Shutdown
Handle shutdowns like a pro:

```typescript
ShieldModule.forRoot({
  advanced: {
    gracefulShutdown: {
      enabled: true,
      timeout: 30000, // 30 seconds to drain
      beforeShutdown: async () => {
        await this.saveState();
        await this.notifyUsers();
        logger.info('👋 Shutting down gracefully...');
      }
    }
  }
})
```

## 🛠️ Advanced Patterns

### Custom Key Generation

```typescript
ShieldModule.forRoot({
  rateLimit: {
    keyGenerator: (context) => {
      // Rate limit by API key instead of IP
      const apiKey = context.headers['x-api-key'];
      const userId = context.user?.id;
      
      if (apiKey) return `api:${apiKey}`;
      if (userId) return `user:${userId}`;
      return `ip:${context.ip}`;
    }
  }
})
```

### Priority-Based Load Shedding

```typescript
@Controller('api')
export class ApiController {
  @Post('critical-payment')
  @Priority(10) // Highest priority
  processPayment() {
    // Never dropped during overload
  }

  @Get('analytics')
  @Priority(1) // Lowest priority
  getAnalytics() {
    // First to be dropped during overload
  }
}
```

### Manual Control

```typescript
@Injectable()
export class AdminService {
  constructor(
    private rateLimit: RateLimitService,
    private circuitBreaker: CircuitBreakerService,
  ) {}

  async blockAbusiveUser(userId: string) {
    await this.rateLimit.block(
      { ip: userId }, 
      86400, // 24 hours
      'Abuse detected'
    );
  }

  async maintenanceMode(service: string) {
    this.circuitBreaker.disable(service);
    // Do maintenance
    this.circuitBreaker.enable(service);
  }
}
```

## 📨 Performance Tips

1. **Use Redis in Production**
   - In-memory storage doesn't scale across instances
   - Redis provides persistence and clustering

2. **Set Appropriate Limits**
   ```typescript
   // Bad: Too restrictive
   @RateLimit({ points: 1, duration: 60 })
   
   // Good: Based on actual capacity
   @RateLimit({ points: 100, duration: 60 })
   ```

3. **Use Circuit Breakers for External Services**
   ```typescript
   // Protect against cascade failures
   @CircuitBreaker({ timeout: 5000 })
   async callExternalAPI() {}
   ```

4. **Monitor Your Metrics**
   - Set up alerts for high rejection rates
   - Track circuit breaker state changes
   - Monitor queue depths

## 🧪 Testing

```typescript
// In your tests
import { Test } from '@nestjs/testing';
import { ShieldModule } from '@usex/nest-shield';

beforeEach(async () => {
  const module = await Test.createTestingModule({
    imports: [
      ShieldModule.forRoot({
        global: { enabled: false },  // Disable in tests
      }),
    ],
  }).compile();
});

// Or mock specific services
const mockRateLimitService = {
  consume: jest.fn().mockResolvedValue({ allowed: true }),
};
```

## 🎓 Best Practices

### DO ✅
- Use different storage backends for different environments
- Set up monitoring and alerts
- Test your limits under load
- Use circuit breakers for external dependencies
- Implement graceful degradation

### DON'T ❌
- Use in-memory storage in production (unless single instance)
- Set limits too low (frustrated users)
- Set limits too high (defeated purpose)
- Ignore metrics and monitoring
- Forget to handle errors gracefully

## 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md).

## 📝 License

MIT © [Ali Torki](https://github.com/ali-master)

## 🙏 Acknowledgments

<div align="center">
  <p>
    <strong>Ready to build distributed systems that just work?</strong>
  </p>
  <p>
    <a href="./docs/installation.md">🚀 Get Started</a> •
    <a href="./docs/examples.md">📚 View Examples</a> •
    <a href="https://github.com/ali-master/nest-shield">⭐ Star on GitHub</a>
  </p>
  <p>
    Made with ❤️ by <a href="https://github.com/ali-master">Ali Master</a> and the open source community.
  </p>
</div>
---

<p align="center">
  <strong>Ready to protect your API?</strong><br>
  <a href="https://github.com/ali-master/nest-shield">Documentation</a> •
  <a href="https://github.com/ali-master/nest-shield/blob/master/examples">Examples</a> •
  <a href="https://github.com/ali-master/nest-shield/issues">Issues</a> •
  <a href="https://discord.gg/nestshield">Discord</a>
</p>

<p align="center">
  <sub>Built by developers who've been there at 3 AM when the servers are on fire 🔥</sub>
</p>
