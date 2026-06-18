# Storage backends and scaling

Protection state (counters, breaker stats, queues) lives in a storage backend chosen by `storage.type`. The backend determines whether limits are **per-process** or **shared across a cluster**.

## Choosing a backend

| Type | When | Distributed? |
|------|------|--------------|
| `memory` | single instance, dev, tests | No — each process counts separately |
| `redis` | multiple instances / production | **Yes** — one shared count cluster-wide |
| `memcached` | existing memcached infra | Counters shared via memcached |
| `custom` | bespoke store | Up to your adapter |

**The cluster gotcha:** with `memory`, running N replicas behind a load balancer effectively allows N× every limit, because each process has its own counter. Any multi-instance deployment that needs accurate global limits must use `redis` (or `memcached`).

## Redis

```typescript
ShieldModule.forRoot({
  storage: {
    type: "redis",
    options: { host: "localhost", port: 6379, keyPrefix: "nest-shield:" },
  },
})
```

Rate limiting is backed by `rate-limiter-flexible`. When `storage.type` is `redis`, the rate limiter **reuses the storage adapter's ioredis connection** (via the adapter's `getClient()`), so counters are atomic and shared across instances with no extra connection or config. Other backends fall back to in-process rate-limiter state.

## Memcached

```typescript
storage: { type: "memcached", options: { servers: "localhost:11211" } }
```

Uses the `memjs` client for general storage. (Rate limiting itself runs in-process for memcached, since `rate-limiter-flexible`'s memcached driver expects a different client.)

## Custom adapter

Implement `IStorageAdapter` (`get`, `set`, `delete`, `increment`, `decrement`, `exists`, `expire`, `ttl`; optional `getClient`, `scan`, `mget`, `mset`) and pass it:

```typescript
storage: { type: "custom", customAdapter: new MyAdapter() }
```

## Distributed coordination

For cluster-wide adaptive behavior beyond shared counters, enable distributed sync (requires a shared redis store):

```typescript
advanced: {
  distributedSync: { enabled: true, syncInterval: 5000, channel: "nest-shield:sync" },
}
```

## Metrics for observability at scale

Export protection metrics to your monitoring stack via `metrics.type` (`prometheus`, `statsd`, `datadog`, `cloudwatch`, `json`, …). Useful series: requests total, rate-limit hits, circuit-breaker state, overload rejections. See `configuration.md` for the `metrics` options.
