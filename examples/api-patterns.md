# API Patterns & Best Practices

This guide shows practical patterns for using NestShield in production applications.

## Service Method Examples

### 1. Manual Rate Limit Management

```typescript
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly shieldContext: IProtectionContext,
  ) {}

  async validateApiKey(apiKey: string): Promise<boolean> {
    // Check if API key is blocked
    if (await this.rateLimitService.isBlocked(this.shieldContext)) {
      throw new HttpException('API key is blocked', 403);
    }

    // Get remaining quota
    const remaining = await this.rateLimitService.getRemaining(
      this.shieldContext,
      { points: 1000, duration: 3600 } // 1000 requests per hour
    );

    if (remaining <= 0) {
      // Block the API key for 1 hour
      await this.rateLimitService.block(this.shieldContext, 3600, 'Quota exceeded');
      throw new HttpException('API quota exceeded', 429);
    }

    return true;
  }

  async resetApiKeyLimits(apiKey: string): Promise<void> {
    // Admin function to reset rate limits
    await this.rateLimitService.reset(this.shieldContext);
  }
}
```

### 2. Circuit Breaker Health Monitoring

```typescript
@Injectable()
export class HealthService {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async getSystemHealth(): Promise<any> {
    const stats = this.circuitBreakerService.getAllStats();
    const health = {
      services: {},
      overall: 'healthy',
    };

    for (const [service, stat] of Object.entries(stats)) {
      const state = this.circuitBreakerService.getState(service);
      const healthCheck = await this.circuitBreakerService.healthCheck(service);
      
      health.services[service] = {
        state,
        healthy: healthCheck,
        stats: {
          failures: stat.failures,
          successes: stat.successes,
          timeouts: stat.timeouts,
          fallbacks: stat.fallbacks,
          errorRate: stat.failures / (stat.fires || 1),
        }
      };

      if (state === 'open') {
        health.overall = 'degraded';
      }
    }

    return health;
  }

  async resetCircuitBreaker(service: string): Promise<void> {
    // Admin function to manually reset circuit breaker
    this.circuitBreakerService.reset(service);
  }

  async resetAllCircuitBreakers(): Promise<void> {
    this.circuitBreakerService.resetAll();
  }

  async warmUpService(service: string): Promise<void> {
    // Warm up circuit breaker with dummy requests
    await this.circuitBreakerService.warmUp(service, 20);
  }
}
```

### 3. Throttle Status Dashboard

```typescript
@Controller('admin/shield')
@UseGuards(AdminGuard)
export class ShieldAdminController {
  constructor(
    private readonly throttleService: ThrottleService,
    private readonly overloadService: OverloadService,
    private readonly priorityManagerService: PriorityManagerService,
  ) {}

  @Get('throttle/status/:userId')
  async getThrottleStatus(
    @Param('userId') userId: string,
    @ShieldContext() context: IProtectionContext,
  ): Promise<any> {
    // Override context with specific user
    const userContext = { ...context, ip: userId };
    
    const status = await this.throttleService.getStatus(userContext);
    
    return {
      userId,
      throttle: {
        count: status.count,
        remaining: status.remaining,
        resetAt: new Date(status.reset).toISOString(),
        percentUsed: (status.count / 100) * 100,
      }
    };
  }

  @Post('throttle/reset/:userId')
  async resetThrottle(
    @Param('userId') userId: string,
    @ShieldContext() context: IProtectionContext,
  ): Promise<any> {
    const userContext = { ...context, ip: userId };
    await this.throttleService.reset(userContext);
    
    return { message: 'Throttle reset successfully' };
  }

  @Get('overload/status')
  getOverloadStatus() {
    const status = this.overloadService.getStatus();
    const shutdown = this.gracefulShutdownService.getShutdownStatus();
    
    return {
      overload: {
        ...status,
        load: (status.currentRequests / status.adaptiveThreshold) * 100,
      },
      shutdown,
    };
  }

  @Post('overload/release')
  async forceRelease(@Body('count') count: number = 1) {
    await this.overloadService.forceRelease(count);
    return { released: count };
  }

  @Delete('overload/queue')
  clearQueue() {
    this.overloadService.clearQueue();
    return { message: 'Queue cleared' };
  }

  @Get('priorities')
  getPriorityStats() {
    return this.priorityManagerService.getAggregateStats();
  }

  @Post('priorities/:priority/adjust')
  adjustPriorityLimits(
    @Param('priority') priority: number,
    @Body() limits: any,
  ) {
    this.priorityManagerService.adjustPriorityLimits(priority, limits);
    return { message: 'Priority limits adjusted' };
  }

  @Post('priorities/reset-stats')
  resetPriorityStats() {
    this.priorityManagerService.resetStats();
    return { message: 'Priority stats reset' };
  }
}
```

### 4. Distributed Sync Patterns

```typescript
@Injectable()
export class ClusterCoordinator {
  constructor(
    private readonly distributedSyncService: DistributedSyncService,
  ) {}

  async electLeader(): Promise<string> {
    if (this.distributedSyncService.isLeader()) {
      return this.distributedSyncService.getNodeId();
    }

    // Wait for leader election
    const nodes = this.distributedSyncService.getActiveNodes();
    const sortedNodes = nodes.map(n => n.id).sort();
    return sortedNodes[0]; // First node alphabetically is leader
  }

  async broadcastConfigUpdate(config: any): Promise<void> {
    await this.distributedSyncService.broadcastCustomData({
      type: 'config_update',
      config,
      timestamp: Date.now(),
    });
  }

  getClusterInfo() {
    return {
      nodeId: this.distributedSyncService.getNodeId(),
      isLeader: this.distributedSyncService.isLeader(),
      nodeCount: this.distributedSyncService.getNodeCount(),
      nodes: this.distributedSyncService.getActiveNodes(),
    };
  }
}
```

### 5. Cleanup Tasks

```typescript
@Injectable()
export class ShieldCleanupService {
  private readonly logger = new Logger(ShieldCleanupService.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly throttleService: ThrottleService,
  ) {}

  @Cron('0 */5 * * * *') // Every 5 minutes
  async cleanupExpiredKeys() {
    try {
      await this.rateLimitService.cleanup();
      await this.throttleService.cleanup();
      this.logger.log('Cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
    }
  }
}
```

### 6. Custom Storage Adapter

```typescript
export class MongoStorageAdapter extends BaseStorageAdapter {
  private collection: Collection;

  constructor(private readonly db: Db) {
    super();
    this.collection = db.collection('shield_storage');
  }

  async get(key: string): Promise<any> {
    const doc = await this.collection.findOne({ _id: this.getKey(key) });
    return doc?.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const expireAt = ttl ? new Date(Date.now() + ttl * 1000) : null;
    
    await this.collection.replaceOne(
      { _id: fullKey },
      { _id: fullKey, value, expireAt },
      { upsert: true }
    );
  }

  async scan(pattern: string, count?: number): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const docs = await this.collection
      .find({ _id: regex })
      .limit(count || 100)
      .toArray();
    
    return docs.map(doc => doc._id.replace(this.prefix, ''));
  }
}
```

### 7. Advanced Circuit Breaker Patterns

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CircuitBreakerService } from '@usex/nest-shield';

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async callExternalApi(endpoint: string, data: any): Promise<any> {
    const breaker = this.circuitBreakerService.getBreaker('external-api');
    
    // Manually control circuit breaker
    if (breaker) {
      // Disable for maintenance
      this.circuitBreakerService.disable('external-api');
      
      // Perform maintenance...
      
      // Re-enable
      this.circuitBreakerService.enable('external-api');
    }

    // Execute with circuit breaker
    return this.circuitBreakerService.execute(
      'external-api',
      async () => {
        const response = await firstValueFrom(
          this.httpService.post(endpoint, data)
        );
        return response.data;
      },
      {} as IProtectionContext,
      {
        timeout: 10000,
        fallback: async (error) => {
          // Return cached data on failure
          return this.getCachedResponse(endpoint);
        }
      }
    );
  }
}
```

### 8. Metrics Export Endpoint

```typescript
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    @Inject('CustomMetricsCollector') private readonly collector: CustomMetricsCollector,
  ) {}

  @Get()
  @BypassShield()
  getMetrics(@Query('format') format: string = 'json') {
    if (format === 'prometheus') {
      return this.collector.exportPrometheus();
    }
    
    return this.collector.getMetrics();
  }

  @Post('reset')
  @UseGuards(AdminGuard)
  resetMetrics() {
    this.collector.reset();
    return { message: 'Metrics reset' };
  }
}
```

## Testing Patterns

### Unit Testing with Mocks

```typescript
describe('ApiController', () => {
  let controller: ApiController;
  let rateLimitService: jest.Mocked<RateLimitService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [
        {
          provide: RateLimitService,
          useValue: {
            consume: jest.fn(),
            reset: jest.fn(),
            getRemaining: jest.fn(),
            isBlocked: jest.fn(),
            block: jest.fn(),
            cleanup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ApiController>(ApiController);
    rateLimitService = module.get(RateLimitService);
  });

  it('should block user after exceeding rate limit', async () => {
    rateLimitService.consume.mockRejectedValue(new RateLimitException());
    
    await expect(controller.getData()).rejects.toThrow(RateLimitException);
  });

  it('should reset rate limits for admin', async () => {
    await controller.resetLimits('user123');
    
    expect(rateLimitService.reset).toHaveBeenCalledWith(
      expect.objectContaining({ ip: 'user123' })
    );
  });
});
```

### Integration Testing

```typescript
describe('Shield Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ShieldModule.forRoot({
          storage: { type: 'memory' },
          rateLimit: { enabled: true, points: 5, duration: 60 },
        }),
        AppModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should rate limit after 5 requests', async () => {
    const agent = request(app.getHttpServer());
    
    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      await agent.get('/api/data').expect(200);
    }
    
    // 6th request should be rate limited
    const response = await agent.get('/api/data').expect(429);
    
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers['retry-after']).toBeDefined();
  });
});
```