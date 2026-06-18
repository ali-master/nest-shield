# Decorators, param decorators, and programmatic use

All exported from `@usex/nest-shield`. Method/class decorators set metadata the global guard reads; a decorator on a route **overrides** the matching global config section for that route only, and each route's counter is isolated (keyed by `method:path:identity`).

## Protection decorators

| Decorator | Signature | Notes |
|-----------|-----------|-------|
| `@RateLimit` | `(config?: Partial<IRateLimitConfig>)` | fixed quota; `{ points, duration, blockDuration?, keyGenerator? }` |
| `@Throttle` | `(config?: Partial<IThrottleConfig>)` | token bucket; `{ limit, ttl }` |
| `@CircuitBreaker` | `(config?: Partial<ICircuitBreakerConfig>)` | `{ timeout, errorThresholdPercentage, fallback }` |
| `@Overload` | `(config?: Partial<IOverloadConfig>)` | `{ maxConcurrentRequests, maxQueueSize, shedStrategy }` |
| `@Priority` | `(priority: number)` | higher number = served first under load shedding |
| `@BypassShield` | `()` | route skips all protection |
| `@Shield` | `(options: ShieldOptions)` | combine several: `{ circuitBreaker?, rateLimit?, throttle?, overload?, priority?, bypass? }` |

Apply at method level (one route) or class level (all routes in the controller). Field options come from the config interfaces in `configuration.md`.

## Convenience helpers

Thin wrappers that set `enabled: true` for you — use when you want defaults with one or two overrides:

```typescript
@QuickRateLimit(points = 100, duration = 60, blockDuration?)
@QuickThrottle(limit = 100, ttl = 60)
@QuickCircuitBreaker(timeout = 3000, errorThresholdPercentage = 50)
@ProtectEndpoint({
  rateLimit?: { points, duration },
  throttle?: { limit, ttl },
  circuitBreaker?: { timeout, errorThreshold },
  overload?: boolean,
  priority?: number,
})
```

## Param decorators (read protection state inside a handler)

```typescript
handler(
  @ShieldContext()      ctx: IProtectionContext,  // ip, path, method, userId, headers...
  @RateLimitInfo()      rl: any,                   // { limit, remaining, reset, headers }
  @ThrottleInfo()       th: any,
  @CircuitBreakerInfo() cb: any,
  @OverloadInfo()       ov: any,                   // { queueLength, currentRequests, ... }
  @ShieldMetrics()      m: any,
) {}
```

Each returns `null` if that protection isn't active on the route, so guard with `?.`.

## Custom key generator (per-user / per-tier limits)

By default each route is limited per route + IP (or `userId` when present). Override `keyGenerator` to scope the counter differently — e.g. per API key or per pricing tier:

```typescript
@RateLimit({
  points: 1000,
  duration: 3600,
  keyGenerator: (ctx) => `tier:${ctx.headers["x-api-tier"]}:${ctx.headers["x-api-key"]}`,
})
```

A custom `keyGenerator` takes full control of isolation — two routes returning the same key share one budget on purpose.

## Programmatic use (inject the services)

When limits are computed at request time, or you want to rate-limit work that isn't an HTTP route, inject the service instead of decorating. Use the typed inject helpers or `@Inject(DI_TOKENS.*)`:

```typescript
import { InjectRateLimit, RateLimitService, ShieldContext } from "@usex/nest-shield";

@Injectable()
export class TieredService {
  constructor(@InjectRateLimit() private rateLimit: RateLimitService) {}

  async run(ctx: IProtectionContext, tier: string) {
    const limits = { free: { points: 10, duration: 3600 }, pro: { points: 1000, duration: 3600 } };
    // throws RateLimitException (-> 429) when exhausted
    await this.rateLimit.consume(ctx, limits[tier] ?? limits.free);
    return this.doWork();
  }
}
```

Inject helpers (all from `@usex/nest-shield`): `InjectRateLimit`, `InjectThrottle`, `InjectCircuitBreaker`, `InjectOverload`, `InjectMetrics`, `InjectPriorityManager`, `InjectGracefulShutdown`, `InjectDistributedSync`, `InjectAnomalyDetection`. The service classes (`RateLimitService`, `CircuitBreakerService`, `ThrottleService`, `OverloadService`, `MetricsService`, …) are exported for typing.

`RateLimitService` key methods: `consume(ctx, config)`, `reset(ctx, config?)`, `getRemaining(ctx, config?)`, `block(ctx, durationSec)`, `isBlocked(ctx)`.
