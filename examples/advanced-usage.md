# Advanced Usage Examples

This guide demonstrates how to use all the advanced features and methods in NestShield.

## Storage Adapter Methods

### Direct Storage Access

```typescript
import { Injectable } from '@nestjs/common';
import { InjectStorageAdapter } from '@usex/nest-shield';
import { IStorageAdapter } from '@usex/nest-shield';

@Injectable()
export class CacheService {
  constructor(
    @InjectStorageAdapter() private readonly storage: IStorageAdapter,
  ) {}

  // Use increment/decrement for counters
  async trackPageViews(pageId: string): Promise<number> {
    return await this.storage.increment(`pageviews:${pageId}`);
  }

  async getPageViews(pageId: string): Promise<number> {
    const views = await this.storage.get(`pageviews:${pageId}`);
    return views || 0;
  }

  // Use mget/mset for batch operations
  async cacheBulkUsers(users: User[]): Promise<void> {
    const entries: Array<[string, any]> = users.map(user => 
      [`user:${user.id}`, user]
    );
    await this.storage.mset(entries, 3600); // Cache for 1 hour
  }

  async getBulkUsers(userIds: string[]): Promise<User[]> {
    const keys = userIds.map(id => `user:${id}`);
    return await this.storage.mget(keys);
  }

  // Use TTL for expiration management
  async checkSessionExpiry(sessionId: string): Promise<number> {
    const ttl = await this.storage.ttl(`session:${sessionId}`);
    if (ttl < 300) { // Less than 5 minutes
      // Extend session
      await this.storage.expire(`session:${sessionId}`, 1800);
    }
    return ttl;
  }

  // Use scan for pattern matching (Redis only)
  async findExpiredSessions(): Promise<string[]> {
    if ('scan' in this.storage) {
      return await this.storage.scan('session:*', 100);
    }
    return [];
  }

  // Use exists for conditional operations
  async createIfNotExists(key: string, value: any): Promise<boolean> {
    if (await this.storage.exists(key)) {
      return false;
    }
    await this.storage.set(key, value);
    return true;
  }

  // Clear all cache
  async clearCache(): Promise<void> {
    if (this.storage.clear) {
      await this.storage.clear();
    }
  }
}
```

## MetricsService Advanced Usage

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@usex/nest-shield';

@Injectable()
export class PerformanceMonitor {
  constructor(
    private readonly metrics: MetricsService,
  ) {}

  async trackApiPerformance(endpoint: string, method: string) {
    // Use timer for duration tracking
    const endTimer = this.metrics.startTimer('api_request_duration', {
      endpoint,
      method,
    });

    try {
      // Your API logic here
      const result = await this.processRequest();
      
      // Track success
      this.metrics.increment('api_requests_total', 1, {
        endpoint,
        method,
        status: 'success',
      });

      return result;
    } catch (error) {
      // Track failure
      this.metrics.increment('api_requests_total', 1, {
        endpoint,
        method,
        status: 'error',
        error_type: error.constructor.name,
      });
      throw error;
    } finally {
      // End timer automatically records duration
      endTimer();
    }
  }

  trackSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    
    // Use gauge for current values
    this.metrics.gauge('memory_heap_used_bytes', memoryUsage.heapUsed);
    this.metrics.gauge('memory_heap_total_bytes', memoryUsage.heapTotal);
    this.metrics.gauge('memory_external_bytes', memoryUsage.external);
    
    // Track active connections
    this.metrics.gauge('active_connections', this.getActiveConnections());
    
    // Use histogram for distributions
    const responseTime = this.getLastResponseTime();
    this.metrics.histogram('response_time_ms', responseTime, {
      service: 'api',
    });
    
    // Use summary for percentiles
    this.metrics.summary('request_size_bytes', this.getRequestSize(), {
      endpoint: this.getCurrentEndpoint(),
    });
  }

  // Custom metrics collector integration
  getCustomCollector() {
    return this.metrics.getCollector();
  }
}
```

## Service Method Examples

### RateLimitService Advanced Methods

```typescript
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { RateLimitService, ShieldContext, IProtectionContext } from '@usex/nest-shield';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get('rate-limit/status/:userId')
  async getRateLimitStatus(
    @Param('userId') userId: string,
    @ShieldContext() context: IProtectionContext,
  ) {
    // Override context for specific user
    const userContext = { ...context, ip: userId };
    
    // Check if blocked
    const isBlocked = await this.rateLimitService.isBlocked(userContext);
    
    // Get remaining points
    const remaining = await this.rateLimitService.getRemaining(
      userContext,
      { points: 100, duration: 3600 }
    );
    
    return {
      userId,
      isBlocked,
      remaining,
      percentage: (remaining / 100) * 100,
    };
  }

  @Post('rate-limit/block/:userId')
  async blockUser(
    @Param('userId') userId: string,
    @Body() body: { duration: number; reason: string },
    @ShieldContext() context: IProtectionContext,
  ) {
    const userContext = { ...context, ip: userId };
    
    await this.rateLimitService.block(
      userContext,
      body.duration,
      body.reason
    );
    
    return { message: `User ${userId} blocked for ${body.duration} seconds` };
  }

  @Post('rate-limit/reset/:userId')
  async resetRateLimit(
    @Param('userId') userId: string,
    @ShieldContext() context: IProtectionContext,
  ) {
    const userContext = { ...context, ip: userId };
    
    await this.rateLimitService.reset(userContext);
    
    return { message: `Rate limit reset for user ${userId}` };
  }

  @Post('rate-limit/cleanup')
  async cleanupExpiredLimits() {
    await this.rateLimitService.cleanup();
    return { message: 'Expired rate limits cleaned up' };
  }
}
```

### CircuitBreakerService Advanced Usage

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '@usex/nest-shield';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ExternalServiceManager {
  private readonly logger = new Logger(ExternalServiceManager.name);

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  // Health monitoring
  @Cron('*/30 * * * * *') // Every 30 seconds
  async monitorCircuitBreakers() {
    const allStats = this.circuitBreakerService.getAllStats();
    
    for (const [service, stats] of Object.entries(allStats)) {
      const state = this.circuitBreakerService.getState(service);
      const health = await this.circuitBreakerService.healthCheck(service);
      
      this.logger.log({
        service,
        state,
        healthy: health,
        stats: {
          ...stats,
          errorRate: stats.failures / (stats.fires || 1),
        },
      });

      // Auto-reset if healthy and open
      if (health && state === 'open') {
        this.circuitBreakerService.reset(service);
        this.logger.log(`Auto-reset circuit breaker for ${service}`);
      }
    }
  }

  // Manual circuit breaker control
  async performMaintenance(service: string) {
    // Disable during maintenance
    this.circuitBreakerService.disable(service);
    
    try {
      // Perform maintenance tasks
      await this.doMaintenance(service);
    } finally {
      // Re-enable after maintenance
      this.circuitBreakerService.enable(service);
    }
  }

  // Warm up circuit breaker
  async prepareService(service: string) {
    // Get breaker instance
    const breaker = this.circuitBreakerService.getBreaker(service);
    
    if (breaker) {
      // Warm up with test requests
      await this.circuitBreakerService.warmUp(service, 10);
      
      // Check if ready
      const stats = breaker.stats;
      this.logger.log(`Service ${service} warmed up:`, stats);
    }
  }

  // Reset all breakers
  async emergencyReset() {
    this.circuitBreakerService.resetAll();
    this.logger.warn('Emergency reset of all circuit breakers');
  }
}
```

### ThrottleService Advanced Methods

```typescript
import { Injectable } from '@nestjs/common';
import { ThrottleService, IProtectionContext } from '@usex/nest-shield';

@Injectable()
export class ThrottleManager {
  constructor(
    private readonly throttleService: ThrottleService,
  ) {}

  async getThrottleInfo(context: IProtectionContext) {
    const status = await this.throttleService.getStatus(context);
    
    return {
      current: status.count,
      limit: status.limit,
      remaining: status.remaining,
      resetAt: new Date(status.reset),
      percentageUsed: (status.count / status.limit) * 100,
    };
  }

  async resetUserThrottle(userId: string, context: IProtectionContext) {
    const userContext = { ...context, ip: userId };
    await this.throttleService.reset(userContext);
  }

  async cleanupExpiredThrottles() {
    await this.throttleService.cleanup();
  }
}
```

### OverloadService Advanced Control

```typescript
import { Injectable } from '@nestjs/common';
import { OverloadService } from '@usex/nest-shield';

@Injectable()
export class LoadManager {
  constructor(
    private readonly overloadService: OverloadService,
  ) {}

  async getLoadStatus() {
    const status = this.overloadService.getStatus();
    
    return {
      currentLoad: status.currentRequests,
      maxCapacity: status.adaptiveThreshold,
      loadPercentage: (status.currentRequests / status.adaptiveThreshold) * 100,
      isOverloaded: status.isOverloaded,
      queueLength: status.queueLength,
      droppedRequests: status.droppedRequests,
    };
  }

  async forceReleaseCapacity(count: number = 5) {
    // Force release stuck requests
    await this.overloadService.forceRelease(count);
  }

  async emergencyClearQueue() {
    // Clear all queued requests during emergency
    this.overloadService.clearQueue();
  }

  async adjustThreshold(newThreshold: number) {
    // Manually adjust threshold
    const status = this.overloadService.getStatus();
    if (newThreshold > status.minThreshold && newThreshold < status.maxThreshold) {
      // This would need to be implemented in the service
      this.overloadService.setThreshold(newThreshold);
    }
  }
}
```

### PriorityManagerService Usage

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { PriorityManagerService } from '@usex/nest-shield';

@Controller('admin/priority')
export class PriorityController {
  constructor(
    private readonly priorityManager: PriorityManagerService,
  ) {}

  @Get('stats')
  getPriorityStats() {
    return this.priorityManager.getAggregateStats();
  }

  @Post('adjust/:priority')
  adjustPriority(
    @Param('priority') priority: number,
    @Body() limits: { rateLimit?: any; throttle?: any },
  ) {
    this.priorityManager.adjustPriorityLimits(priority, limits);
    return { message: `Priority ${priority} limits adjusted` };
  }

  @Post('reset-stats')
  resetStats() {
    this.priorityManager.resetStats();
    return { message: 'Priority stats reset' };
  }

  @Get('distribution')
  async getRequestDistribution() {
    const stats = this.priorityManager.getAggregateStats();
    const total = Object.values(stats).reduce((sum, stat) => sum + stat.requests, 0);
    
    return Object.entries(stats).map(([priority, stat]) => ({
      priority: Number(priority),
      requests: stat.requests,
      percentage: (stat.requests / total) * 100,
      allowed: stat.allowed,
      blocked: stat.blocked,
      successRate: (stat.allowed / stat.requests) * 100,
    }));
  }
}
```

### DistributedSyncService for Clusters

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DistributedSyncService } from '@usex/nest-shield';

@Injectable()
export class ClusterManager implements OnModuleInit {
  constructor(
    private readonly distributedSync: DistributedSyncService,
  ) {}

  onModuleInit() {
    // Listen for custom data
    this.distributedSync.on('customData', (data) => {
      if (data.type === 'config_update') {
        this.handleConfigUpdate(data.config);
      }
    });
  }

  async getClusterStatus() {
    return {
      nodeId: this.distributedSync.getNodeId(),
      isLeader: this.distributedSync.isLeader(),
      totalNodes: this.distributedSync.getNodeCount(),
      activeNodes: this.distributedSync.getActiveNodes().map(node => ({
        id: node.id,
        joinedAt: new Date(node.joinedAt),
        lastSync: new Date(node.lastSync),
        isHealthy: Date.now() - node.lastSync < 60000,
      })),
    };
  }

  async broadcastConfigChange(config: any) {
    await this.distributedSync.broadcastCustomData({
      type: 'config_update',
      config,
      timestamp: Date.now(),
      nodeId: this.distributedSync.getNodeId(),
    });
  }

  async performLeaderElection() {
    const nodes = this.distributedSync.getActiveNodes();
    const sortedNodes = nodes.sort((a, b) => a.id.localeCompare(b.id));
    const leaderId = sortedNodes[0]?.id;
    
    return {
      leader: leaderId,
      isCurrentNodeLeader: leaderId === this.distributedSync.getNodeId(),
    };
  }
}
```

### GracefulShutdownService Usage

```typescript
import { Injectable } from '@nestjs/common';
import { GracefulShutdownService } from '@usex/nest-shield';

@Injectable()
export class ShutdownManager {
  constructor(
    private readonly gracefulShutdown: GracefulShutdownService,
  ) {}

  async getShutdownStatus() {
    return this.gracefulShutdown.getShutdownStatus();
  }

  async initiateGracefulShutdown(reason: string) {
    // This would trigger the shutdown process
    process.emit('SIGTERM');
    
    return {
      message: 'Graceful shutdown initiated',
      reason,
      timeout: 30000,
    };
  }
}
```

## Complete Example: API Protection Dashboard

```typescript
import { Module, Controller, Get, Post, Body, Param } from '@nestjs/common';
import { 
  ShieldModule,
  RateLimitService,
  ThrottleService,
  CircuitBreakerService,
  OverloadService,
  MetricsService,
  PriorityManagerService,
  DistributedSyncService,
  ShieldContext,
  IProtectionContext,
} from '@usex/nest-shield';

@Controller('shield-dashboard')
export class ShieldDashboardController {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly throttle: ThrottleService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly overload: OverloadService,
    private readonly metrics: MetricsService,
    private readonly priorityManager: PriorityManagerService,
    private readonly distributedSync: DistributedSyncService,
  ) {}

  @Get('overview')
  async getOverview() {
    const [
      rateLimitStats,
      circuitBreakerStats,
      overloadStatus,
      priorityStats,
      clusterInfo,
    ] = await Promise.all([
      this.getRateLimitStats(),
      this.circuitBreaker.getAllStats(),
      this.overload.getStatus(),
      this.priorityManager.getAggregateStats(),
      this.getClusterInfo(),
    ]);

    return {
      timestamp: new Date(),
      protection: {
        rateLimit: rateLimitStats,
        circuitBreaker: circuitBreakerStats,
        overload: overloadStatus,
        priorities: priorityStats,
      },
      cluster: clusterInfo,
    };
  }

  @Post('user/:userId/unblock')
  async unblockUser(
    @Param('userId') userId: string,
    @ShieldContext() context: IProtectionContext,
  ) {
    const userContext = { ...context, ip: userId };
    
    // Reset all protections for user
    await Promise.all([
      this.rateLimit.reset(userContext),
      this.throttle.reset(userContext),
    ]);

    // Track in metrics
    this.metrics.increment('admin_actions', 1, {
      action: 'unblock_user',
      userId,
    });

    return { message: `User ${userId} unblocked` };
  }

  @Post('maintenance/:service')
  async toggleMaintenance(
    @Param('service') service: string,
    @Body('enabled') enabled: boolean,
  ) {
    if (enabled) {
      this.circuitBreaker.disable(service);
    } else {
      this.circuitBreaker.enable(service);
      await this.circuitBreaker.warmUp(service, 5);
    }

    // Broadcast to cluster
    if (this.distributedSync) {
      await this.distributedSync.broadcastCustomData({
        type: 'maintenance_mode',
        service,
        enabled,
        timestamp: Date.now(),
      });
    }

    return { 
      service, 
      maintenanceMode: enabled,
      state: this.circuitBreaker.getState(service),
    };
  }

  @Post('emergency/reset')
  async emergencyReset() {
    // Reset all circuit breakers
    this.circuitBreaker.resetAll();
    
    // Clear overload queue
    this.overload.clearQueue();
    
    // Force release capacity
    await this.overload.forceRelease(10);
    
    // Clean up expired entries
    await Promise.all([
      this.rateLimit.cleanup(),
      this.throttle.cleanup(),
    ]);

    // Track emergency action
    this.metrics.increment('emergency_resets', 1, {
      timestamp: new Date().toISOString(),
    });

    return { message: 'Emergency reset completed' };
  }

  private async getRateLimitStats() {
    // This would need to be implemented to aggregate rate limit stats
    return {
      totalKeys: 0, // Would need to implement counting
      blockedUsers: 0,
    };
  }

  private getClusterInfo() {
    if (!this.distributedSync) {
      return { mode: 'single-instance' };
    }

    return {
      mode: 'distributed',
      nodeId: this.distributedSync.getNodeId(),
      isLeader: this.distributedSync.isLeader(),
      nodeCount: this.distributedSync.getNodeCount(),
      nodes: this.distributedSync.getActiveNodes(),
    };
  }
}

@Module({
  imports: [
    ShieldModule.forRoot({
      // Your config
    }),
  ],
  controllers: [ShieldDashboardController],
})
export class DashboardModule {}
```

## Testing Helpers

```typescript
import { Test } from '@nestjs/testing';
import { 
  RateLimitService,
  ThrottleService,
  CircuitBreakerService,
  MetricsService,
} from '@usex/nest-shield';

export class ShieldTestHelper {
  static createMockServices() {
    return {
      rateLimitService: {
        consume: jest.fn().mockResolvedValue({ allowed: true }),
        reset: jest.fn(),
        getRemaining: jest.fn().mockResolvedValue(100),
        isBlocked: jest.fn().mockResolvedValue(false),
        block: jest.fn(),
        cleanup: jest.fn(),
      },
      throttleService: {
        consume: jest.fn().mockResolvedValue({ allowed: true }),
        reset: jest.fn(),
        getStatus: jest.fn().mockResolvedValue({
          count: 0,
          limit: 10,
          remaining: 10,
          reset: Date.now() + 60000,
        }),
        cleanup: jest.fn(),
      },
      circuitBreakerService: {
        execute: jest.fn().mockImplementation((name, fn) => fn()),
        getState: jest.fn().mockReturnValue('closed'),
        getAllStats: jest.fn().mockReturnValue({}),
        healthCheck: jest.fn().mockResolvedValue(true),
        reset: jest.fn(),
        resetAll: jest.fn(),
        disable: jest.fn(),
        enable: jest.fn(),
        warmUp: jest.fn(),
        getBreaker: jest.fn(),
      },
      metricsService: {
        increment: jest.fn(),
        decrement: jest.fn(),
        gauge: jest.fn(),
        histogram: jest.fn(),
        summary: jest.fn(),
        startTimer: jest.fn().mockReturnValue(() => {}),
        getCollector: jest.fn(),
      },
    };
  }

  static async createTestingModule(imports: any[] = []) {
    const mocks = this.createMockServices();
    
    return Test.createTestingModule({
      imports,
      providers: [
        { provide: RateLimitService, useValue: mocks.rateLimitService },
        { provide: ThrottleService, useValue: mocks.throttleService },
        { provide: CircuitBreakerService, useValue: mocks.circuitBreakerService },
        { provide: MetricsService, useValue: mocks.metricsService },
      ],
    });
  }
}
```