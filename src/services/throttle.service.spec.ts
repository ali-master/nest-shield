import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ThrottleService } from "./throttle.service";
import { MetricsService } from "./metrics.service";
import { ThrottleException } from "../core/exceptions";
import { SHIELD_MODULE_OPTIONS, HEADER_NAMES } from "../core/constants";
import {
  waitFor,
  MockStorageAdapter,
  MockMetricsCollector,
  createMockProtectionContext,
} from "../test-utils/mocks";
import type { IProtectionContext } from "../interfaces/shield-config.interface";

describe("ThrottleService", () => {
  let service: ThrottleService;
  let storage: MockStorageAdapter;
  let metricsService: MetricsService;
  let metricsCollector: MockMetricsCollector;

  const defaultConfig = {
    enabled: true,
    limit: 5,
    ttl: 10, // 10 seconds
  };

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
          provide: ThrottleService,
          useFactory: () => {
            return new ThrottleService(
              { throttle: defaultConfig },
              storage,
              mockMetricsService as any,
            );
          },
        },
        {
          provide: SHIELD_MODULE_OPTIONS,
          useValue: {
            throttle: defaultConfig,
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

    service = module.get<ThrottleService>(ThrottleService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(async () => {
    await storage.clear();
  });

  describe("consume", () => {
    it("should allow requests within throttle limit", async () => {
      const context = createMockProtectionContext();

      for (let i = 0; i < 5; i++) {
        const result = await service.consume(context);

        expect(result.allowed).toBe(true);
        expect(result.metadata?.remaining).toBe(4 - i);
        expect(result.metadata?.limit).toBe(5);
        expect(result.metadata?.headers).toBeDefined();
      }

      expect(metricsCollector.getMetric("test.throttle_consumed", {
        path: context.path,
        method: context.method,
      })).toBe(5);
    });

    it("should reject requests exceeding throttle limit", async () => {
      const context = createMockProtectionContext();

      // Consume all allowed requests
      for (let i = 0; i < 5; i++) {
        await service.consume(context);
      }

      // Next request should be rejected
      await expect(service.consume(context)).rejects.toThrow(ThrottleException);

      expect(metricsCollector.getMetric("test.throttle_exceeded")).toBe(1);
    });

    it("should reset window after TTL expires", async () => {
      const context = createMockProtectionContext();
      const shortTtlConfig = { ttl: 1 }; // 1 second

      // Consume all requests
      for (let i = 0; i < 5; i++) {
        await service.consume(context, shortTtlConfig);
      }

      // Should be throttled
      await expect(service.consume(context, shortTtlConfig)).rejects.toThrow(ThrottleException);

      // Wait for window to reset
      await waitFor(1100);

      // Should be able to make requests again
      const result = await service.consume(context, shortTtlConfig);
      expect(result.allowed).toBe(true);
      expect(result.metadata?.remaining).toBe(4);
    });

    it("should use custom key generator", async () => {
      const context = createMockProtectionContext({ userId: "user-123" });
      const customConfig = {
        keyGenerator: (ctx: IProtectionContext) => `user:${ctx.userId}`,
      };

      const result = await service.consume(context, customConfig);

      expect(result.allowed).toBe(true);

      // Verify key was generated correctly
      const keys = await storage.keys("throttle:user:user-123");
      expect(keys.length).toBe(1);
    });

    it("should respect disabled throttling", async () => {
      const context = createMockProtectionContext();
      const result = await service.consume(context, { enabled: false });

      expect(result.allowed).toBe(true);
      expect(result.metadata).toBeUndefined();
    });

    it("should ignore specified user agents", async () => {
      const context = createMockProtectionContext({
        userAgent: "Googlebot/2.1",
      });
      const config = {
        ignoreUserAgents: [/Googlebot/i, /bingbot/i],
      };

      // Should allow unlimited requests for ignored user agents
      for (let i = 0; i < 10; i++) {
        const result = await service.consume(context, config);
        expect(result.allowed).toBe(true);
      }
    });

    it("should generate correct headers", async () => {
      const context = createMockProtectionContext();
      const result = await service.consume(context);

      expect(result.metadata?.headers).toEqual({
        [HEADER_NAMES.RATE_LIMIT_LIMIT]: "5",
        [HEADER_NAMES.RATE_LIMIT_REMAINING]: "4",
        [HEADER_NAMES.RATE_LIMIT_RESET]: expect.any(String),
      });
    });

    it("should include retry-after header when limit exceeded", async () => {
      const context = createMockProtectionContext();

      // Consume all requests
      for (let i = 0; i < 5; i++) {
        await service.consume(context);
      }

      try {
        await service.consume(context);
        fail("Should have thrown ThrottleException");
      } catch (error) {
        expect(error).toBeInstanceOf(ThrottleException);
        expect(error.retryAfter).toBeGreaterThan(0);
        expect(error.retryAfter).toBeLessThanOrEqual(10);
      }
    });

    it("should use custom response message", async () => {
      const context = createMockProtectionContext();
      const customConfig = {
        limit: 1,
        customResponseMessage: (ctx: IProtectionContext) => `Throttled: ${ctx.ip}`,
      };

      await service.consume(context, customConfig);

      try {
        await service.consume(context, customConfig);
        fail("Should have thrown ThrottleException");
      } catch (error) {
        expect(error).toBeInstanceOf(ThrottleException);
        expect(error.message).toBe(`Throttled: ${context.ip}`);
      }
    });

    it("should handle storage errors gracefully", async () => {
      const context = createMockProtectionContext();
      jest.spyOn(storage, "get").mockRejectedValue(new Error("Storage error"));

      const result = await service.consume(context);

      expect(result.allowed).toBe(true);
      expect(metricsCollector.getMetric("test.throttle_error")).toBe(1);
    });

    it("should include custom headers when provided", async () => {
      const context = createMockProtectionContext();
      const customConfig = {
        customHeaders: {
          "X-Throttle-Policy": "standard",
        },
      };

      const result = await service.consume(context, customConfig);

      expect(result.metadata?.headers?.["X-Throttle-Policy"]).toBe("standard");
    });
  });

  describe("reset", () => {
    it("should reset throttle for context", async () => {
      const context = createMockProtectionContext();

      // Consume some requests
      await service.consume(context);
      await service.consume(context);

      // Reset
      await service.reset(context);

      // Should be able to consume full limit again
      const result = await service.consume(context);
      expect(result.metadata?.remaining).toBe(4);
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
      expect(result.metadata?.remaining).toBe(4);
    });
  });

  describe("getStatus", () => {
    it("should return correct status for active throttle", async () => {
      const context = createMockProtectionContext();

      // Initial state
      let status = await service.getStatus(context);
      expect(status).toEqual({
        count: 0,
        remaining: 5,
        reset: 0,
      });

      // After consuming
      await service.consume(context);
      await service.consume(context);

      status = await service.getStatus(context);
      expect(status.count).toBe(2);
      expect(status.remaining).toBe(3);
      expect(status.reset).toBeGreaterThan(Date.now());
    });

    it("should return full limit when disabled", async () => {
      const context = createMockProtectionContext();
      const status = await service.getStatus(context, { enabled: false });

      expect(status).toEqual({
        count: 0,
        remaining: 5,
        reset: 0,
      });
    });

    it("should return zero remaining when limit exceeded", async () => {
      const context = createMockProtectionContext();

      // Consume all points
      for (let i = 0; i < 5; i++) {
        await service.consume(context);
      }

      const status = await service.getStatus(context);
      expect(status.count).toBe(5);
      expect(status.remaining).toBe(0);
    });

    it("should reset status after window expires", async () => {
      const context = createMockProtectionContext();
      const shortTtlConfig = { ttl: 1 };

      await service.consume(context, shortTtlConfig);
      await service.consume(context, shortTtlConfig);

      // Check current status
      let status = await service.getStatus(context, shortTtlConfig);
      expect(status.count).toBe(2);

      // Wait for window to expire
      await waitFor(1100);

      // Status should be reset
      status = await service.getStatus(context, shortTtlConfig);
      expect(status).toEqual({
        count: 0,
        remaining: 5,
        reset: 0,
      });
    });
  });

  describe("cleanup", () => {
    it("should remove expired records", async () => {
      const _context1 = createMockProtectionContext({ ip: "192.168.1.1" });
      const _context2 = createMockProtectionContext({ ip: "192.168.1.2" });
      const _context3 = createMockProtectionContext({ ip: "192.168.1.3" });

      // Create throttle records with different ages
      const now = Date.now();
      await storage.set("throttle:192.168.1.1", {
        count: 3,
        firstRequestTime: now - 20000, // Expired
      });
      await storage.set("throttle:192.168.1.2", {
        count: 2,
        firstRequestTime: now - 5000, // Not expired
      });
      await storage.set("throttle:192.168.1.3", {
        count: 1,
        firstRequestTime: now - 15000, // Expired
      });

      await service.cleanup();

      // Only the non-expired record should remain
      const remainingKeys = await storage.keys("throttle:*");
      expect(remainingKeys).toEqual(["throttle:192.168.1.2"]);
    });

    it("should handle missing scan method", async () => {
      const storageWithoutScan = {
        ...storage,
        scan: undefined,
      };

      const serviceWithLimitedStorage = new ThrottleService(
        { throttle: defaultConfig },
        storageWithoutScan as any,
        metricsService,
      );

      // Should not throw
      await expect(serviceWithLimitedStorage.cleanup()).resolves.not.toThrow();
    });

    it("should handle corrupted records", async () => {
      await storage.set("throttle:corrupted", "invalid-data");

      // Should not throw
      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle concurrent requests correctly", async () => {
      const context = createMockProtectionContext();
      const config = { limit: 3, ttl: 60 };

      // Simulate concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => service.consume(context, config).catch((e) => e));

      const results = await Promise.all(promises);

      // Exactly 3 should succeed, 2 should fail
      const successes = results.filter((r) => !(r instanceof Error));
      const failures = results.filter((r) => r instanceof ThrottleException);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(2);
    });

    it("should handle empty user agent", async () => {
      const context = createMockProtectionContext({ userAgent: "" });
      const config = {
        ignoreUserAgents: [/^$/], // Match empty string
      };

      // Should ignore empty user agent
      for (let i = 0; i < 10; i++) {
        const result = await service.consume(context, config);
        expect(result.allowed).toBe(true);
      }
    });

    it("should handle undefined user agent", async () => {
      const context = createMockProtectionContext({ userAgent: undefined });
      const config = {
        ignoreUserAgents: [/bot/i],
      };

      // Should not crash with undefined user agent
      const result = await service.consume(context, config);
      expect(result.allowed).toBe(true);
    });

    it("should handle zero TTL gracefully", async () => {
      const context = createMockProtectionContext();
      const config = { ttl: 0 };

      // Should still work with immediate expiration
      const result = await service.consume(context, config);
      expect(result.allowed).toBe(true);
    });

    it("should handle negative remaining gracefully", async () => {
      const context = createMockProtectionContext();

      // Manually set invalid record
      await storage.set(`throttle:${context.ip}`, {
        count: 10, // More than limit
        firstRequestTime: Date.now(),
      });

      const status = await service.getStatus(context);
      expect(status.remaining).toBe(0); // Should not be negative
    });

    it("should preserve TTL when updating record", async () => {
      const context = createMockProtectionContext();
      const ttl = 30;
      const config = { ttl };

      // First request
      await service.consume(context, config);

      // Get the key to check TTL
      const key = `throttle:${context.ip}`;
      const initialTtl = await storage.ttl(key);

      // Second request (should preserve remaining TTL)
      await service.consume(context, config);

      const updatedTtl = await storage.ttl(key);

      // TTL should decrease, not reset
      expect(updatedTtl).toBeLessThan(initialTtl);
    });
  });
});
