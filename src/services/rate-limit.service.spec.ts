import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { RateLimitService } from "./rate-limit.service";
import { MetricsService } from "./metrics.service";
import { RateLimitException } from "../core/exceptions";
import { SHIELD_MODULE_OPTIONS, HEADER_NAMES } from "../core/constants";
import {
  waitFor,
  MockStorageAdapter,
  MockMetricsCollector,
  createMockProtectionContext,
} from "../test-utils/mocks";
import { TEST_RATE_LIMIT_OPTIONS } from "../test-utils/fixtures";
import type { IProtectionContext } from "../interfaces/shield-config.interface";

describe("RateLimitService", () => {
  let service: RateLimitService;
  let storage: MockStorageAdapter;
  let metricsService: MetricsService;
  let metricsCollector: MockMetricsCollector;

  beforeEach(async () => {
    storage = new MockStorageAdapter();
    metricsCollector = new MockMetricsCollector();

    const mockMetricsService = {
      increment: (metric: string, value: number = 1, labels?: any) => {
        metricsCollector.increment(`test.${metric}`, value, labels);
      },
      decrement: jest.fn(),
      gauge: jest.fn(),
      histogram: jest.fn(),
      summary: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      getCollector: jest.fn().mockReturnValue(metricsCollector),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RateLimitService,
          useFactory: () => {
            return new RateLimitService(
              { rateLimit: TEST_RATE_LIMIT_OPTIONS },
              storage,
              mockMetricsService as any,
            );
          },
        },
        {
          provide: SHIELD_MODULE_OPTIONS,
          useValue: {
            rateLimit: TEST_RATE_LIMIT_OPTIONS,
          },
        },
        {
          provide: "SHIELD_STORAGE",
          useValue: storage,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(async () => {
    await storage.clear();
    metricsCollector.clear();
  });

  describe("consume", () => {
    it("should allow requests within rate limit", async () => {
      const context = createMockProtectionContext();

      for (let i = 0; i < 5; i++) {
        const result = await service.consume(context);

        expect(result.allowed).toBe(true);
        expect(result.metadata?.remaining).toBe(9 - i);
        expect(result.metadata?.limit).toBe(10);
        expect(result.metadata?.headers).toBeDefined();
      }

      expect(
        metricsCollector.getMetric("test.rate_limit_consumed", {
          path: context.path,
          method: context.method,
        }),
      ).toBe(5);
    });

    it("should reject requests exceeding rate limit", async () => {
      const context = createMockProtectionContext();

      // Consume all allowed requests
      for (let i = 0; i < 10; i++) {
        await service.consume(context);
      }

      // Next request should be rejected
      await expect(service.consume(context)).rejects.toThrow(RateLimitException);

      expect(
        metricsCollector.getMetric("test.rate_limit_exceeded", {
          path: context.path,
          method: context.method,
        }),
      ).toBe(1);
    });

    it("should use custom key generator when provided", async () => {
      const context = createMockProtectionContext({ userId: "user-123" });
      const customConfig = {
        keyGenerator: (ctx: IProtectionContext) => `user:${ctx.userId}`,
      };

      const result = await service.consume(context, customConfig);

      expect(result.allowed).toBe(true);

      // Verify key was generated correctly by checking storage
      const keys = await storage.keys("rate_limit:user:user-123:*");
      expect(keys.length).toBe(1);
    });

    it("should respect disabled rate limiting", async () => {
      const context = createMockProtectionContext();
      const result = await service.consume(context, { enabled: false });

      expect(result.allowed).toBe(true);
      expect(result.metadata).toBeUndefined();
    });

    it("should handle different time windows correctly", async () => {
      const context = createMockProtectionContext();
      const shortWindowConfig = { duration: 1, points: 2 }; // 1 second window

      // First two requests should succeed
      await service.consume(context, shortWindowConfig);
      await service.consume(context, shortWindowConfig);

      // Third request should fail
      await expect(service.consume(context, shortWindowConfig)).rejects.toThrow(RateLimitException);

      // Wait for window to reset
      await waitFor(1100);

      // Should be able to make requests again
      const result = await service.consume(context, shortWindowConfig);
      expect(result.allowed).toBe(true);
    });

    it("should generate correct headers", async () => {
      const context = createMockProtectionContext();
      const result = await service.consume(context);

      expect(result.metadata?.headers).toEqual({
        [HEADER_NAMES.RATE_LIMIT_LIMIT]: "10",
        [HEADER_NAMES.RATE_LIMIT_REMAINING]: "9",
        [HEADER_NAMES.RATE_LIMIT_RESET]: expect.any(String),
      });
    });

    it("should include custom headers when provided", async () => {
      const context = createMockProtectionContext();
      const customConfig = {
        customHeaders: {
          "X-Custom-Header": "custom-value",
        },
      };

      const result = await service.consume(context, customConfig);

      expect(result.metadata?.headers?.["X-Custom-Header"]).toBe("custom-value");
    });

    it("should use custom response message", async () => {
      const context = createMockProtectionContext();
      const customConfig = {
        points: 1,
        customResponseMessage: (ctx: IProtectionContext) => `Rate limit exceeded for ${ctx.ip}`,
      };

      await service.consume(context, customConfig);

      try {
        await service.consume(context, customConfig);
        fail("Should have thrown RateLimitException");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitException);
        expect(error.message).toBe(`Rate limit exceeded for ${context.ip}`);
      }
    });

    it("should handle storage errors gracefully", async () => {
      const context = createMockProtectionContext();
      jest.spyOn(storage, "get").mockRejectedValue(new Error("Storage error"));

      const result = await service.consume(context);

      expect(result.allowed).toBe(true);
      expect(
        metricsCollector.getMetric("test.rate_limit_error", {
          path: context.path,
          method: context.method,
        }),
      ).toBe(1);
    });

    it("should calculate retry-after correctly", async () => {
      const context = createMockProtectionContext();
      const config = { points: 1, duration: 10 }; // 10 second window

      await service.consume(context, config);

      try {
        await service.consume(context, config);
        fail("Should have thrown RateLimitException");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitException);
        expect(error.retryAfter).toBeGreaterThan(0);
        expect(error.retryAfter).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("reset", () => {
    it("should reset rate limit for context", async () => {
      const context = createMockProtectionContext();

      // Consume some requests
      await service.consume(context);
      await service.consume(context);

      // Reset
      await service.reset(context);

      // Should be able to consume full limit again
      const result = await service.consume(context);
      expect(result.metadata?.remaining).toBe(9);
    });

    it("should use custom config for reset", async () => {
      const context = createMockProtectionContext();
      const customConfig = {
        keyGenerator: (ctx: IProtectionContext) => `custom:${ctx.ip}`,
      };

      // Consume with custom config
      await service.consume(context, customConfig);

      // Reset with same custom config
      await service.reset(context, customConfig);

      // Verify the correct key was reset
      const result = await service.consume(context, customConfig);
      expect(result.metadata?.remaining).toBe(9);
    });
  });

  describe("getRemaining", () => {
    it("should return correct remaining points", async () => {
      const context = createMockProtectionContext();

      // Initial state
      let remaining = await service.getRemaining(context);
      expect(remaining).toBe(10);

      // After consuming
      await service.consume(context);
      await service.consume(context);
      await service.consume(context);

      remaining = await service.getRemaining(context);
      expect(remaining).toBe(7);
    });

    it("should return full limit when disabled", async () => {
      const context = createMockProtectionContext();
      const remaining = await service.getRemaining(context, { enabled: false });

      expect(remaining).toBe(10);
    });

    it("should return 0 when limit exceeded", async () => {
      const context = createMockProtectionContext();

      // Consume all points
      for (let i = 0; i < 10; i++) {
        await service.consume(context);
      }

      const remaining = await service.getRemaining(context);
      expect(remaining).toBe(0);
    });
  });

  describe("block/isBlocked", () => {
    it("should block and unblock IP addresses", async () => {
      const context = createMockProtectionContext({ ip: "192.168.1.100" });

      // Initially not blocked
      let blocked = await service.isBlocked(context);
      expect(blocked).toBe(false);

      // Block the IP
      await service.block(context, 300, "Abuse detected");

      // Should be blocked
      blocked = await service.isBlocked(context);
      expect(blocked).toBe(true);

      // Verify block info in storage
      const blockInfo = await storage.get("block:192.168.1.100");
      expect(blockInfo).toEqual({
        reason: "Abuse detected",
        timestamp: expect.any(Number),
      });
    });

    it("should auto-unblock after duration", async () => {
      const context = createMockProtectionContext();

      // Block for 1 second
      await service.block(context, 1, "Test block");

      expect(await service.isBlocked(context)).toBe(true);

      // Wait for expiration
      await waitFor(1100);

      expect(await service.isBlocked(context)).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should remove expired keys", async () => {
      // Create some rate limit keys
      await storage.set("rate_limit:test:1", 10, 1);
      await storage.set("rate_limit:test:2", 20);
      await storage.set("rate_limit:test:3", 30, 1);

      // Mock TTL responses
      jest
        .spyOn(storage, "ttl")
        .mockResolvedValueOnce(-2) // Expired
        .mockResolvedValueOnce(100) // Not expired
        .mockResolvedValueOnce(-2); // Expired

      await service.cleanup();

      // Only the non-expired key should remain
      const remainingKeys = await storage.keys("rate_limit:*");
      expect(remainingKeys).toEqual(["rate_limit:test:2"]);
    });

    it("should handle missing scan method", async () => {
      const storageWithoutScan = {
        ...storage,
        scan: undefined,
      };

      const serviceWithLimitedStorage = new RateLimitService(
        { rateLimit: TEST_RATE_LIMIT_OPTIONS },
        storageWithoutScan as any,
        metricsService,
      );

      // Should not throw
      await expect(serviceWithLimitedStorage.cleanup()).resolves.not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle concurrent requests correctly", async () => {
      const context = createMockProtectionContext();
      const config = { points: 5, duration: 60 };

      // Simulate concurrent requests
      const promises = Array(10)
        .fill(null)
        .map(() => service.consume(context, config).catch((e) => e));

      const results = await Promise.all(promises);

      // Exactly 5 should succeed, 5 should fail
      const successes = results.filter((r) => !(r instanceof Error));
      const failures = results.filter((r) => r instanceof RateLimitException);

      expect(successes.length).toBe(5);
      expect(failures.length).toBe(5);
    });

    it("should handle very large point values", async () => {
      const context = createMockProtectionContext();
      const config = { points: Number.MAX_SAFE_INTEGER, duration: 60 };

      const result = await service.consume(context, config);

      expect(result.allowed).toBe(true);
      expect(result.metadata?.limit).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should handle negative remaining points gracefully", async () => {
      const context = createMockProtectionContext();

      // Manually set storage to simulate edge case
      const now = Date.now();
      const windowStart = Math.floor(now / 1000 / 60) * 60 * 1000;
      const key = `rate_limit:${context.ip}:${context.path}:${context.method}:${windowStart}`;
      await storage.set(key, 15); // More than limit (default is 10)

      const remaining = await service.getRemaining(context);
      expect(remaining).toBe(0); // Should not be negative
    });

    it("should handle custom key generator returning empty string", async () => {
      const context = createMockProtectionContext();
      const config = {
        keyGenerator: () => "",
      };

      const result = await service.consume(context, config);

      expect(result.allowed).toBe(true);
      // Should still work with empty key
      const keys = await storage.keys("rate_limit::*");
      expect(keys.length).toBe(1);
    });
  });
});
