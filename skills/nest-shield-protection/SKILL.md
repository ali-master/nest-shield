---
name: nest-shield-protection
description: Add or fix @usex/nest-shield protection in a NestJS app — rate limiting, throttling, circuit breakers, overload/load-shedding, request priority. Use whenever the user wants to protect, rate-limit, throttle, debounce, or shield NestJS endpoints; handle traffic spikes, bursts, DDoS/abuse, or cascade failures; configure ShieldModule; apply @RateLimit/@Throttle/@CircuitBreaker/@Overload/@Shield decorators; or inject RateLimitService/CircuitBreakerService for programmatic limits — even if they don't name the library.
---

# Protecting a NestJS app with NestShield

NestShield guards a NestJS app with four protection mechanisms — **rate limit**, **throttle**, **circuit breaker**, **overload** — configured once globally and overridden per route with decorators.

Two facts shape everything below; internalize them before writing code:

1. **The guard is global.** `ShieldModule.forRoot()` registers an `APP_GUARD`, so **every route is already protected** by the global config. You don't add a guard per controller — you tune the global config and override specific routes.
2. **A decorator overrides the global config for that route, and each route's limit is isolated.** `@RateLimit({ points: 5 })` on a route gives that route its *own* 5-request budget keyed by `method:path:identity` — it does not share a counter with other routes. So per-route `points`/`limit` mean what they say.

## Workflow

### 1. Install

```bash
npm install @usex/nest-shield        # or: bun add / pnpm add / yarn add
```

Peer dependencies (usually already present in a Nest app): `@nestjs/common`, `@nestjs/core`, `reflect-metadata`, `rxjs`. Redis-backed storage pulls in `ioredis`; rate limiting is backed by `rate-limiter-flexible` (both ship with the library).

**Done when** the package resolves and the app still compiles.

### 2. Register `ShieldModule` once, in the root module

Synchronous:

```typescript
import { Module } from "@nestjs/common";
import { ShieldModule } from "@usex/nest-shield";

@Module({
  imports: [
    ShieldModule.forRoot({
      global: { enabled: true },
      storage: { type: "memory" },               // memory | redis | memcached
      rateLimit: { enabled: true, points: 100, duration: 60 },
    }),
  ],
})
export class AppModule {}
```

Use `forRootAsync({ imports, inject, useFactory })` when config depends on `ConfigService` or other providers. See [references/configuration.md](references/configuration.md) for the full options tree (`global`, `storage`, `rateLimit`, `throttle`, `circuitBreaker`, `overload`, `metrics`, `adapters`, `advanced`) and the async form.

Pick storage by deployment: `memory` for a single instance, `redis` for multiple instances (counters are shared across the cluster automatically). See [references/storage-and-scaling.md](references/storage-and-scaling.md).

**Done when** the app boots and logs the NestShield startup line; one request to any route succeeds.

### 3. Decide what each route needs, then decorate

The global config is the baseline. Reach for a decorator only when a route needs *different* limits or a mechanism the global config leaves off. Match the mechanism to the threat:

| Goal | Decorator | Rejects with |
|------|-----------|--------------|
| Cap requests per window (quota/abuse) | `@RateLimit({ points, duration })` | `429` + `retryAfter` |
| Smooth bursts (token bucket) | `@Throttle({ limit, ttl })` | `429` |
| Stop calling a failing dependency | `@CircuitBreaker({ timeout, fallback })` | fallback result, else error |
| Bound in-flight load / shed | `@Overload({ maxConcurrentRequests, maxQueueSize })` | `503` |
| Rank requests under load | `@Priority(n)` (higher = served first) | — |
| Several at once | `@Shield({ rateLimit, throttle, circuitBreaker, overload, priority })` | per mechanism |
| Opt a route out of all protection | `@BypassShield()` | never blocks |

```typescript
import { Controller, Get } from "@nestjs/common";
import { RateLimit, CircuitBreaker, Shield, Priority } from "@usex/nest-shield";

@Controller("api")
export class ApiController {
  @Get("search")
  @RateLimit({ points: 10, duration: 60 }) // 10 req / 60s, just this route
  search() {}

  @Get("external")
  @CircuitBreaker({ timeout: 5000, fallback: async () => ({ cached: true }) })
  external() {} // returns the fallback when the call times out / the breaker is open

  @Post("checkout")
  @Priority(10)
  @Shield({
    rateLimit: { points: 100, duration: 3600 },
    overload: { maxConcurrentRequests: 20 },
  })
  checkout() {}
}
```

Full decorator and option reference (including `Quick*` helpers, `ProtectEndpoint`, and `keyGenerator` for per-user/per-tier limits): [references/decorators.md](references/decorators.md).

**Done when** every route that needs non-default protection carries a decorator, and routes that must never be blocked (health checks, webhooks) are excluded via `global.excludePaths` or `@BypassShield()`.

### 4. Surface limit state to the client (optional but recommended)

Read the protection result inside a handler with a param decorator, so the client learns its remaining quota:

```typescript
import { RateLimitInfo } from "@usex/nest-shield";

@Get("feed")
@RateLimit({ points: 50, duration: 60 })
feed(@RateLimitInfo() info: any) {
  return { remaining: info?.remaining, reset: info?.reset };
}
```

Param decorators: `@ShieldContext`, `@RateLimitInfo`, `@ThrottleInfo`, `@CircuitBreakerInfo`, `@OverloadInfo`, `@ShieldMetrics`.

For limits computed at runtime (e.g. tier-based), inject the service instead of decorating — call `RateLimitService.consume(context, config)` directly. See the "Programmatic use" section of [references/decorators.md](references/decorators.md).

### 5. Verify the protection actually triggers

Don't assume — exercise it. For a `@RateLimit({ points: N })` route, send `N+2` requests and confirm the first `N` return `2xx` and the rest return `429`. For overload, fire concurrent requests beyond `maxConcurrentRequests + maxQueueSize` and confirm `503`. A protection you didn't watch reject is a protection you haven't confirmed works.

**Done when** you've observed the intended reject code for at least the strictest route.

## Common pitfalls

- **Forgot it's global** — adding `@RateLimit` to "turn on" rate limiting while the global config already rate-limits every route, producing a stricter combined effect than intended. Check the global config first.
- **Health checks getting throttled** — load balancers hammer `/health`; exclude it (`global.excludePaths`) or `@BypassShield()` it.
- **Per-instance limits in a cluster** — `memory` storage counts per process, so N instances allow N× the limit. Switch to `redis` for a shared count.
- **Circuit breaker with no fallback** — when the breaker opens or times out, the request errors unless `fallback` is set. Provide one wherever a degraded response beats a 500.
