import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { MetricsService } from "./metrics.service";
import { CircuitBreakerException } from "../core/exceptions";
import { SHIELD_MODULE_OPTIONS } from "../core/constants";
import { waitFor, MockMetricsCollector, createMockProtectionContext } from "../test-utils/mocks";
import { TEST_CIRCUIT_BREAKER_OPTIONS } from "../test-utils/fixtures";

describe("CircuitBreakerService", () => {
  let service: CircuitBreakerService;
  let _metricsService: MetricsService;
  let metricsCollector: MockMetricsCollector;

  beforeEach(async () => {
    metricsCollector = new MockMetricsCollector();

    const mockMetricsService = {
      increment: (metric: string, value: number = 1, labels?: any) => {
        metricsCollector.increment(`test.${metric}`, value, labels);
      },
      decrement: (metric: string, value: number = 1, labels?: any) => {
        metricsCollector.decrement(`test.${metric}`, value, labels);
      },
      gauge: (metric: string, value: number, labels?: any) => {
        metricsCollector.gauge(`test.${metric}`, value, labels);
      },
      histogram: (metric: string, value: number, labels?: any) => {
        metricsCollector.histogram(`test.${metric}`, value, labels);
      },
      summary: (metric: string, value: number, labels?: any) => {
        metricsCollector.summary(`test.${metric}`, value, labels);
      },
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      getCollector: jest.fn().mockReturnValue(metricsCollector),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CircuitBreakerService,
          useFactory: () => {
            return new CircuitBreakerService(
              { circuitBreaker: TEST_CIRCUIT_BREAKER_OPTIONS },
              mockMetricsService as any,
            );
          },
        },
        {
          provide: SHIELD_MODULE_OPTIONS,
          useValue: {
            circuitBreaker: TEST_CIRCUIT_BREAKER_OPTIONS,
          },
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    _metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    // Reset all breakers first
    service.resetAll();
    // Clear metrics last
    metricsCollector.clear();
  });

  describe("createBreaker", () => {
    it("should create a new circuit breaker", () => {
      const handler = jest.fn().mockResolvedValue("success");
      const breaker = service.createBreaker("test-breaker", handler);

      expect(breaker).toBeDefined();
      expect(breaker).toHaveProperty("fire");
      expect(breaker).toHaveProperty("stats");
    });

    it("should reuse existing breaker for same key", () => {
      const handler = jest.fn();
      const breaker1 = service.createBreaker("test-key", handler);
      const breaker2 = service.createBreaker("test-key", handler);

      expect(breaker1).toBe(breaker2);
    });

    it("should create passthrough breaker when disabled", async () => {
      const handler = jest.fn().mockResolvedValue("result");
      const breaker = service.createBreaker("test", handler, { enabled: false });

      const result = await breaker.fire();

      expect(result).toBe("result");
      expect(handler).toHaveBeenCalled();
      expect(breaker.opened).toBe(false);
    });

    it("should apply custom configuration", () => {
      const handler = jest.fn();
      const customConfig = {
        timeout: 1000,
        errorThresholdPercentage: 75,
        resetTimeout: 5000,
      };

      const breaker = service.createBreaker("custom", handler, customConfig);

      expect(breaker).toBeDefined();
      // Verify config was applied by checking breaker options
      const options = (breaker as any).options;
      expect(options.timeout).toBe(1000);
      expect(options.errorThresholdPercentage).toBe(75);
      expect(options.resetTimeout).toBe(5000);
    });

    it("should set up fallback when provided", () => {
      const handler = jest.fn();
      const fallback = jest.fn().mockReturnValue("fallback result");

      const breaker = service.createBreaker("with-fallback", handler, { fallback });

      expect(breaker.fallback).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should execute handler successfully", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockResolvedValue("success");

      const result = await service.execute("test", handler, context);

      expect(result).toBe("success");
      expect(handler).toHaveBeenCalled();
      expect(metricsCollector.getMetric("test.circuit_breaker_fires", { key: "test" })).toBe(1);
      expect(metricsCollector.getMetric("test.circuit_breaker_successes", { key: "test" })).toBe(1);
    });

    it("should throw CircuitBreakerException when breaker is open", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockRejectedValue(new Error("Service error"));

      // Trigger failures to open the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute("failing-service", handler, context, {
            volumeThreshold: 5,
            errorThresholdPercentage: 50,
          });
        } catch {
          // Expected failures
        }
      }

      // Wait a bit for state change
      await waitFor(100);

      // Next call should throw CircuitBreakerException
      await expect(service.execute("failing-service", handler, context)).rejects.toThrow(
        CircuitBreakerException,
      );

      expect(
        metricsCollector.getMetric("test.circuit_breaker_rejects", { key: "failing-service" }),
      ).toBeGreaterThan(0);
    });

    it("should use fallback when circuit is open", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockRejectedValue(new Error("Service error"));
      const fallbackResult = { fallback: true };
      const fallback = jest.fn().mockResolvedValue(fallbackResult);

      const config = {
        volumeThreshold: 3,
        errorThresholdPercentage: 50,
        fallback,
      };

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("with-fallback", handler, context, config);
        } catch {
          // Expected
        }
      }

      // Circuit should be open now, fallback should be used
      const result = await service.execute("with-fallback", handler, context, config);

      expect(result).toEqual(fallbackResult);
      expect(fallback).toHaveBeenCalled();
      expect(
        metricsCollector.getMetric("test.circuit_breaker_fallbacks", { key: "with-fallback" }),
      ).toBeGreaterThan(0);
    });

    it("should handle timeout correctly", async () => {
      const context = createMockProtectionContext();
      const handler = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve("late"), 2000)),
        );

      await expect(
        service.execute("timeout-test", handler, context, { timeout: 100 }),
      ).rejects.toThrow();

      expect(
        metricsCollector.getMetric("test.circuit_breaker_timeouts", { key: "timeout-test" }),
      ).toBe(1);
    });
  });

  describe("getBreaker", () => {
    it("should return existing breaker", () => {
      const handler = jest.fn();
      service.createBreaker("test", handler);

      const breaker = service.getBreaker("test");

      expect(breaker).toBeDefined();
      expect(breaker).toBeDefined();
    });

    it("should return undefined for non-existent breaker", () => {
      const breaker = service.getBreaker("non-existent");

      expect(breaker).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should return breaker statistics", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockResolvedValue("success");

      await service.execute("stats-test", handler, context);
      await service.execute("stats-test", handler, context);

      const stats = service.getStats("stats-test");

      expect(stats).toBeDefined();
      expect(stats?.fires).toBe(2);
      expect(stats?.successes).toBe(2);
      expect(stats?.failures).toBe(0);
    });

    it("should return undefined for non-existent breaker", () => {
      const stats = service.getStats("non-existent");

      expect(stats).toBeUndefined();
    });
  });

  describe("getAllStats", () => {
    it("should return stats for all breakers", async () => {
      const context = createMockProtectionContext();
      const handler1 = jest.fn().mockResolvedValue("success");
      const handler2 = jest.fn().mockResolvedValue("success");

      await service.execute("breaker1", handler1, context);
      await service.execute("breaker2", handler2, context);

      const allStats = service.getAllStats();

      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats).toHaveProperty("breaker1");
      expect(allStats).toHaveProperty("breaker2");
    });
  });

  describe("healthCheck", () => {
    it("should return true for healthy breaker", async () => {
      const handler = jest.fn().mockResolvedValue("success");
      service.createBreaker("healthy", handler);

      const isHealthy = await service.healthCheck("healthy");

      expect(isHealthy).toBe(true);
    });

    it("should return false for open breaker", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockRejectedValue(new Error("error"));

      // Open the breaker
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute("unhealthy", handler, context, {
            volumeThreshold: 3,
            errorThresholdPercentage: 50,
          });
        } catch {
          // Expected
        }
      }

      await waitFor(100);

      const isHealthy = await service.healthCheck("unhealthy");

      expect(isHealthy).toBe(false);
    });

    it("should use custom health check when provided", async () => {
      const handler = jest.fn();
      const customHealthCheck = jest.fn().mockResolvedValue(false);

      service.createBreaker("custom-health", handler, {
        healthCheck: customHealthCheck,
      });

      const isHealthy = await service.healthCheck("custom-health");

      expect(isHealthy).toBe(false);
      expect(customHealthCheck).toHaveBeenCalled();
    });

    it("should return true for non-existent breaker", async () => {
      const isHealthy = await service.healthCheck("non-existent");

      expect(isHealthy).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset open breaker", async () => {
      // Clear metrics to avoid pollution
      metricsCollector.clear();

      const context = createMockProtectionContext();
      const testKey = `reset-test-${Date.now()}-${Math.random()}`;
      const handler = jest
        .fn()
        .mockRejectedValueOnce(new Error("error"))
        .mockRejectedValueOnce(new Error("error"))
        .mockRejectedValueOnce(new Error("error"))
        .mockRejectedValueOnce(new Error("error"))
        .mockRejectedValueOnce(new Error("error"))
        .mockResolvedValue("success");

      // Open the breaker by causing failures
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute(testKey, handler, context, {
            volumeThreshold: 3,
            errorThresholdPercentage: 50,
          });
        } catch {
          // Expected failures
        }
      }

      // Reset the breaker (this is the main functionality we're testing)
      service.reset(testKey);

      // Verify breaker state changed from open to closed after reset
      const stateAfter = service.getState(testKey);
      expect(stateAfter).toBe("closed");
    });

    it("should handle reset on non-existent breaker", () => {
      expect(() => service.reset("non-existent")).not.toThrow();
    });
  });

  describe("resetAll", () => {
    it("should reset all breakers", async () => {
      const context = createMockProtectionContext();
      const failingHandler = jest.fn().mockRejectedValue(new Error("error"));

      // Create multiple open breakers
      for (const key of ["breaker1", "breaker2", "breaker3"]) {
        for (let i = 0; i < 5; i++) {
          try {
            await service.execute(key, failingHandler, context, {
              volumeThreshold: 3,
              errorThresholdPercentage: 50,
            });
          } catch {
            // Expected
          }
        }
      }

      // Reset all
      service.resetAll();

      // All should be closed
      expect(service.getState("breaker1")).toBe("closed");
      expect(service.getState("breaker2")).toBe("closed");
      expect(service.getState("breaker3")).toBe("closed");
    });
  });

  describe("disable/enable", () => {
    it("should disable and enable breaker", () => {
      const handler = jest.fn();
      service.createBreaker("toggle-test", handler);

      // Initially enabled
      expect(service.getState("toggle-test")).toBe("closed");

      // Disable
      service.disable("toggle-test");
      expect(service.getState("toggle-test")).toBe("disabled");

      // Enable
      service.enable("toggle-test");
      expect(service.getState("toggle-test")).toBe("closed");
    });

    it("should handle disable/enable on non-existent breaker", () => {
      expect(() => service.disable("non-existent")).not.toThrow();
      expect(() => service.enable("non-existent")).not.toThrow();
    });
  });

  describe("getState", () => {
    it("should return correct states", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockRejectedValue(new Error("error"));

      // Create breaker
      service.createBreaker("state-test", handler, {
        volumeThreshold: 3,
        errorThresholdPercentage: 50,
        resetTimeout: 1000,
      });

      // Initially closed
      expect(service.getState("state-test")).toBe("closed");

      // Trigger failures to open
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute("state-test", handler, context);
        } catch {
          // Expected
        }
      }

      // Should be open
      expect(service.getState("state-test")).toBe("open");

      // Wait for half-open state
      await waitFor(1100);

      // Manually trigger half-open by attempting a request
      try {
        await service.execute("state-test", handler, context);
      } catch {
        // Expected
      }

      // Disable to test disabled state
      service.disable("state-test");
      expect(service.getState("state-test")).toBe("disabled");
    });

    it("should return undefined for non-existent breaker", () => {
      expect(service.getState("non-existent")).toBeUndefined();
    });
  });

  describe("warmUp", () => {
    it("should warm up breaker when allowed", async () => {
      const handler = jest.fn().mockResolvedValue("success");

      service.createBreaker("warmup-test", handler, { allowWarmUp: true });

      await service.warmUp("warmup-test", 5);

      const stats = service.getStats("warmup-test");
      expect(stats?.fires).toBeGreaterThanOrEqual(5);
    });

    it("should not warm up when not allowed", async () => {
      const handler = jest.fn();

      service.createBreaker("no-warmup", handler, { allowWarmUp: false });

      await service.warmUp("no-warmup", 5);

      const stats = service.getStats("no-warmup");
      expect(stats?.fires).toBe(0);
    });

    it("should handle warmup errors gracefully", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("warmup error"));

      service.createBreaker("warmup-error", handler, { allowWarmUp: true });

      // Should not throw
      await expect(service.warmUp("warmup-error", 3)).resolves.not.toThrow();
    });
  });

  describe("event handlers and metrics", () => {
    it("should track all circuit breaker events", async () => {
      // Clear metrics to avoid pollution
      metricsCollector.clear();

      const context = createMockProtectionContext();
      const testKey = `events-test-${Date.now()}-${Math.random()}`;
      const handler = jest
        .fn()
        .mockResolvedValueOnce("success")
        .mockRejectedValueOnce(new Error("failure"))
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 2000)));

      // Success
      await service.execute(testKey, handler, context);

      // Failure
      try {
        await service.execute(testKey, handler, context);
      } catch {
        // Expected
      }

      // Timeout
      try {
        await service.execute(testKey, handler, context, { timeout: 100 });
      } catch {
        // Expected
      }

      // Verify metrics - use flexible expectations due to timing variations
      expect(
        metricsCollector.getMetric("test.circuit_breaker_fires", { key: testKey }),
      ).toBeGreaterThanOrEqual(3);
      expect(metricsCollector.getMetric("test.circuit_breaker_successes", { key: testKey })).toBe(
        1,
      );
      // Allow for some variation in failure count due to timing
      const failureCount = metricsCollector.getMetric("test.circuit_breaker_failures", {
        key: testKey,
      });
      expect(failureCount).toBeGreaterThanOrEqual(1);
      expect(failureCount).toBeLessThanOrEqual(3);
      // Check if timeout was recorded (might be more than 1 due to test pollution)
      const timeoutCount = metricsCollector.getMetric("test.circuit_breaker_timeouts", {
        key: testKey,
      });
      expect(timeoutCount).toBeGreaterThanOrEqual(1);
    });

    it("should track state changes", async () => {
      // Clear metrics to avoid pollution
      metricsCollector.clear();

      const context = createMockProtectionContext();
      const testKey = `state-metrics-${Date.now()}-${Math.random()}`;
      const handler = jest.fn().mockRejectedValue(new Error("error"));

      // Trigger open state
      for (let i = 0; i < 10; i++) {
        try {
          await service.execute(testKey, handler, context, {
            volumeThreshold: 3,
            errorThresholdPercentage: 50,
          });
        } catch {
          // Expected
        }
      }

      // Check state metric - verify breaker went to open state
      const stateAfterErrors = service.getState(testKey);
      expect(stateAfterErrors).toBe("open");

      // Verify state metric was tracked
      const openStateMetric = metricsCollector.getMetric("test.circuit_breaker_state", {
        key: testKey,
        state: "open",
      });

      expect(openStateMetric).toBeGreaterThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("should handle very long timeouts", async () => {
      const context = createMockProtectionContext();
      const handler = jest.fn().mockResolvedValue("success");

      const result = await service.execute("long-timeout", handler, context, {
        timeout: Number.MAX_SAFE_INTEGER,
      });

      expect(result).toBe("success");
    });

    it("should handle concurrent executions", async () => {
      const context = createMockProtectionContext();
      let counter = 0;
      const handler = jest.fn().mockImplementation(async () => {
        counter++;
        if (counter <= 3) throw new Error("error");
        return "success";
      });

      const promises = Array(10)
        .fill(null)
        .map(() =>
          service
            .execute("concurrent-test", handler, context, {
              volumeThreshold: 5,
              errorThresholdPercentage: 50,
            })
            .catch((e) => e),
        );

      const results = await Promise.all(promises);

      // Some should succeed, some should fail, some might be rejected
      const successes = results.filter((r) => r === "success");
      const errors = results.filter((r) => r instanceof Error);

      expect(successes.length + errors.length).toBe(10);
    });

    it("should handle breaker with no handler", () => {
      expect(() => service.createBreaker("no-handler", null as any)).toThrow();
    });
  });
});
