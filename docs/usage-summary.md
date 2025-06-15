# NestShield Usage Summary

This document demonstrates how all the methods and features in NestShield are utilized.

## Storage Adapter Methods

All storage adapter methods are actively used throughout the system:

### Core Methods
- `get()` - Used by all services to retrieve stored data
- `set()` - Used to store rate limit counters, throttle data, circuit breaker states
- `delete()` - Used for cleanup and reset operations
- `exists()` - Used to check if limits exist before creating new ones
- `increment()/decrement()` - Used for atomic counter operations in rate limiting
- `expire()` - Used to set TTL on keys for automatic cleanup
- `ttl()` - Used to get remaining time for rate limit windows
- `clear()` - Used for admin operations and testing

### Batch Operations
- `mget()/mset()` - Used for bulk operations in distributed sync and metrics aggregation
- `getMultiple()/setMultiple()` - Wrapper methods for batch operations

### Advanced Methods
- `scan()` (Redis) - Used for pattern matching in distributed sync service
- `ping()` (Redis) - Used for health checks
- `stats()` (Memcached) - Used for monitoring
- `disconnect()` - Used for graceful shutdown

## Service Methods Usage

### RateLimitService
- `consume()` - Core method for checking and consuming rate limit points
- `reset()` - Admin endpoint to reset user limits
- `getRemaining()` - Dashboard/API to show remaining quota
- `block()` - Admin action to block abusive users
- `isBlocked()` - Check before processing requests
- `cleanup()` - Scheduled task to remove expired entries

### ThrottleService
- `consume()` - Core throttling check
- `getStatus()` - Dashboard to show throttle status
- `reset()` - Admin reset functionality
- `cleanup()` - Maintenance task

### CircuitBreakerService
- `execute()` - Wrap external calls with circuit breaker
- `getBreaker()` - Direct access for advanced usage
- `getState()` - Monitoring dashboard
- `getAllStats()` - Admin dashboard overview
- `healthCheck()` - Automated health monitoring
- `reset()/resetAll()` - Emergency admin operations
- `disable()/enable()` - Maintenance mode
- `warmUp()` - Pre-flight checks before enabling

### OverloadService
- `acquire()/release()` - Core request lifecycle management
- `getStatus()` - Real-time monitoring
- `forceRelease()` - Emergency capacity release
- `clearQueue()` - Emergency queue clearing
- `adjustThreshold()` - Dynamic capacity management

### MetricsService
- `increment()/decrement()` - Track counters
- `gauge()` - Track current values (connections, memory)
- `histogram()` - Track distributions (response times)
- `summary()` - Track percentiles
- `startTimer()` - Convenience method for timing operations
- `getCollector()` - Access underlying collector for custom metrics

### PriorityManagerService
- `getPriorityConfig()` - Get limits for priority level
- `adjustPriorityLimits()` - Dynamic priority adjustment
- `trackRequest()` - Internal tracking
- `getAggregateStats()` - Dashboard statistics
- `resetStats()` - Admin operation

### DistributedSyncService
- `broadcastCustomData()` - Cluster-wide notifications
- `getActiveNodes()` - Cluster monitoring
- `getNodeCount()` - Cluster size
- `getNodeId()` - Node identification
- `isLeader()` - Leader election
- Internal methods for heartbeat, discovery, and synchronization

### GracefulShutdownService
- `getShutdownStatus()` - Check if shutting down
- `handleRequest()` - Track active requests
- Internal shutdown orchestration

## Decorator Usage

All decorators are actively used:
- `@Shield()` - Combined protection
- `@RateLimit()` - Rate limiting
- `@Throttle()` - Request throttling
- `@CircuitBreaker()` - Circuit breaking
- `@Priority()` - Request prioritization
- `@BypassShield()` - Skip protection (metrics, health)
- Quick decorators for common patterns

## Advanced Features

### Custom Key Generators
Used for user-based, API key-based, or custom rate limiting strategies

### Custom Storage Adapters
Example provided for MongoDB integration

### Custom Metrics Collectors
Integration with DataDog, New Relic, or custom solutions

### Health Indicators
Used for adaptive threshold adjustments

### Fallback Functions
Used for graceful degradation during outages

## Real-World Usage Patterns

1. **API Protection**: Rate limiting + Circuit breaker for external APIs
2. **User Tiers**: Different limits based on subscription
3. **Admin Dashboard**: Using all status and stats methods
4. **Monitoring**: Metrics + Distributed sync for cluster health
5. **Emergency Controls**: Reset, force release, circuit breaker controls
6. **Maintenance Mode**: Disable/enable circuit breakers
7. **Testing**: Mock services and bypass decorators

Every method serves a specific purpose in the complete protection ecosystem.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ali-master">Ali Torki</a> and the open source community
</p>
