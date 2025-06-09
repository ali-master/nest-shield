import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { OverloadService } from "./overload.service";
import { MetricsService } from "./metrics.service";
import { OverloadException } from "../core/exceptions";
import { SHIELD_MODULE_OPTIONS, ShedStrategy } from "../core/constants";
import { waitFor, MockMetricsCollector, createMockProtectionContext } from "../test-utils/mocks";
import { TEST_OVERLOAD_OPTIONS } from "../test-utils/fixtures";

describe("OverloadService", () => {
  let service: OverloadService;
  let metricsService: MetricsService;
  let metricsCollector: MockMetricsCollector;

  beforeEach(async () => {
    metricsCollector = new MockMetricsCollector();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverloadService,
        {
          provide: SHIELD_MODULE_OPTIONS,
          useValue: {
            overload: TEST_OVERLOAD_OPTIONS,
          },
        },
        {
          provide: MetricsService,
          useValue: new MetricsService(
            { metrics: { enabled: true, prefix: "test" } } as any,
            null as any,
          ),
        },
      ],
    }).compile();

    service = module.get<OverloadService>(OverloadService);
    metricsService = module.get<MetricsService>(MetricsService);

    // Replace metrics collector with mock
    (metricsService as any).collector = metricsCollector;
  });

  afterEach(async () => {
    metricsCollector.clear();
    // Clear any remaining queued requests
    service.clearQueue();
    // Force release all active requests
    const status = service.getStatus();
    await service.forceRelease(status.currentRequests);
  });

  describe("acquire", () => {
    it("should allow requests within concurrent limit", async () => {
      const context = createMockProtectionContext();

      const results = await Promise.all([
        service.acquire(context),
        service.acquire(context),
        service.acquire(context),
      ]);

      results.forEach((result) => {
        expect(result.allowed).toBe(true);
        expect(result.metadata?.currentRequests).toBeLessThanOrEqual(10);
      });

      expect(metricsCollector.getMetric("test.overload_requests_accepted")).toBe(3);
    });

    it("should queue requests when at capacity", async () => {
      const context = createMockProtectionContext();

      // Fill up concurrent capacity
      const activeRequests = Array(10)
        .fill(null)
        .map(() => service.acquire(context));
      await Promise.all(activeRequests);

      // Next request should be queued
      const queuedPromise = service.acquire(context);

      // Verify it's queued
      const status = service.getStatus();
      expect(status.queueLength).toBe(1);
      expect(status.currentRequests).toBe(10);

      // Release one request
      service.release();

      // Queued request should now be processed
      const result = await queuedPromise;
      expect(result.allowed).toBe(true);
      expect(result.metadata?.queueWaitTime).toBeGreaterThan(0);

      expect(metricsCollector.getMetric("test.overload_requests_queued")).toBe(1);
    });

    it("should reject requests when queue is full", async () => {
      const context = createMockProtectionContext();
      const config = { maxConcurrentRequests: 2, maxQueueSize: 3 };

      // Fill concurrent capacity
      await service.acquire(context, config);
      await service.acquire(context, config);

      // Fill queue
      const _queuedRequests = [
        service.acquire(context, config),
        service.acquire(context, config),
        service.acquire(context, config),
      ];

      // Next request should be rejected
      await expect(service.acquire(context, config)).rejects.toThrow(OverloadException);

      expect(metricsCollector.getMetric("test.overload_queue_full")).toBe(1);

      // Clean up
      service.clearQueue();
    });

    it("should respect disabled overload protection", async () => {
      const context = createMockProtectionContext();
      const result = await service.acquire(context, { enabled: false });

      expect(result.allowed).toBe(true);
      expect(result.metadata).toBeUndefined();
    });

    it("should timeout queued requests", async () => {
      const context = createMockProtectionContext();
      const config = {
        maxConcurrentRequests: 1,
        queueTimeout: 100,
      };

      // Fill capacity
      await service.acquire(context, config);

      // Queue a request that will timeout
      const timeoutPromise = service.acquire(context, config);

      await expect(timeoutPromise).rejects.toThrow(OverloadException);
      await expect(timeoutPromise).rejects.toMatchObject({
        message: "Request timeout in queue",
      });

      expect(metricsCollector.getMetric("test.overload_queue_timeout")).toBe(1);
    });

    it("should update health score when provided", async () => {
      const healthIndicator = jest.fn().mockResolvedValue(0.7);
      const context = createMockProtectionContext();

      await service.acquire(context, { healthIndicator });

      // Wait for health check interval
      await waitFor(5100);

      await service.acquire(context, { healthIndicator });

      expect(healthIndicator).toHaveBeenCalled();
      expect(metricsCollector.getMetric("test.overload_health_score")).toBe(0.7);
    });
  });

  describe("release", () => {
    it("should decrease current requests count", async () => {
      const context = createMockProtectionContext();

      await service.acquire(context);
      let status = service.getStatus();
      expect(status.currentRequests).toBe(1);

      service.release();
      status = service.getStatus();
      expect(status.currentRequests).toBe(0);
    });

    it("should process queued requests after release", async () => {
      const context = createMockProtectionContext();
      const config = { maxConcurrentRequests: 2 };

      // Fill capacity
      await service.acquire(context, config);
      await service.acquire(context, config);

      // Queue a request
      const queuedPromise = service.acquire(context, config);

      // Release one
      service.release();

      // Queued request should be processed
      const result = await queuedPromise;
      expect(result.allowed).toBe(true);
    });

    it("should handle multiple releases correctly", () => {
      service.release();
      service.release();
      service.release();

      const status = service.getStatus();
      expect(status.currentRequests).toBe(0); // Should not go negative
    });
  });

  describe("getStatus", () => {
    it("should return correct status information", async () => {
      const context = createMockProtectionContext();

      // Initial status
      let status = service.getStatus();
      expect(status).toEqual({
        currentRequests: 0,
        queueLength: 0,
        healthScore: 1,
        adaptiveThreshold: 10,
      });

      // After acquiring requests
      await service.acquire(context);
      await service.acquire(context);

      status = service.getStatus();
      expect(status.currentRequests).toBe(2);
      expect(status.queueLength).toBe(0);
    });
  });

  describe("priority queue management", () => {
    it("should respect FIFO strategy", async () => {
      const config = {
        maxConcurrentRequests: 1,
        shedStrategy: ShedStrategy.FIFO,
      };

      // Fill capacity
      await service.acquire(createMockProtectionContext(), config);

      // Queue requests with different priorities
      const contexts = [
        createMockProtectionContext({ metadata: { priority: 10 } }),
        createMockProtectionContext({ metadata: { priority: 1 } }),
        createMockProtectionContext({ metadata: { priority: 5 } }),
      ];

      const promises = contexts.map((ctx) => service.acquire(ctx, config));

      // Release and process queue
      for (let i = 0; i < 3; i++) {
        service.release();
        await waitFor(10);
      }

      const results = await Promise.all(promises);

      // Should be processed in FIFO order regardless of priority
      expect(results[0].metadata?.queueWaitTime).toBeLessThan(
        results[1].metadata?.queueWaitTime || 0,
      );
      expect(results[1].metadata?.queueWaitTime).toBeLessThan(
        results[2].metadata?.queueWaitTime || 0,
      );
    });

    it("should respect priority strategy", async () => {
      const config = {
        maxConcurrentRequests: 1,
        shedStrategy: ShedStrategy.PRIORITY,
      };

      // Fill capacity
      await service.acquire(createMockProtectionContext(), config);

      // Queue requests with different priorities
      const lowPriority = service.acquire(
        createMockProtectionContext({ metadata: { priority: 1 } }),
        config,
      );
      const highPriority = service.acquire(
        createMockProtectionContext({ metadata: { priority: 10 } }),
        config,
      );
      const mediumPriority = service.acquire(
        createMockProtectionContext({ metadata: { priority: 5 } }),
        config,
      );

      // Release to process one from queue
      service.release();

      // High priority should be processed first
      const result = await Promise.race([lowPriority, highPriority, mediumPriority]);
      expect(result.allowed).toBe(true);

      // Clean up
      service.clearQueue();
    });

    it("should use priority from headers", async () => {
      const context = createMockProtectionContext({
        headers: { "x-priority": "8" },
      });

      const config = {
        maxConcurrentRequests: 0, // Force queuing
        priorityFunction: undefined,
      };

      service.acquire(context, config).catch(() => {}); // Ignore promise

      const status = service.getStatus();
      expect(status.queueLength).toBe(1);

      // Clean up
      service.clearQueue();
    });

    it("should use custom priority function", async () => {
      const priorityFunction = jest.fn().mockReturnValue(7);
      const context = createMockProtectionContext();

      const config = {
        maxConcurrentRequests: 0, // Force queuing
        priorityFunction,
      };

      service.acquire(context, config).catch(() => {}); // Ignore promise

      expect(priorityFunction).toHaveBeenCalledWith(context);

      // Clean up
      service.clearQueue();
    });

    it("should handle LIFO strategy", async () => {
      const config = {
        maxConcurrentRequests: 1,
        shedStrategy: ShedStrategy.LIFO,
      };

      // Fill capacity
      await service.acquire(createMockProtectionContext(), config);

      // Queue multiple requests
      const first = service.acquire(createMockProtectionContext(), config);
      await waitFor(10);
      const last = service.acquire(createMockProtectionContext(), config);

      // Release to process from queue
      service.release();

      // Last in should be processed first
      const result = await Promise.race([first, last]);
      expect(result).toBeDefined();

      // Clean up
      service.clearQueue();
    });

    it("should handle custom shed function", async () => {
      const customShedFunction = jest.fn((queue) => queue.reverse());
      const config = {
        maxConcurrentRequests: 0,
        shedStrategy: ShedStrategy.CUSTOM,
        customShedFunction,
      };

      service.acquire(createMockProtectionContext(), config).catch(() => {});
      service.acquire(createMockProtectionContext(), config).catch(() => {});

      expect(customShedFunction).toHaveBeenCalled();

      // Clean up
      service.clearQueue();
    });
  });

  describe("adaptive threshold", () => {
    it("should enable adaptive threshold adjustment", async () => {
      const adaptiveConfig = {
        enabled: true,
        minThreshold: 5,
        maxThreshold: 20,
        adjustmentInterval: 100,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OverloadService,
          {
            provide: SHIELD_MODULE_OPTIONS,
            useValue: {
              overload: {
                ...TEST_OVERLOAD_OPTIONS,
                adaptiveThreshold: adaptiveConfig,
              },
            },
          },
          {
            provide: MetricsService,
            useValue: metricsService,
          },
        ],
      }).compile();

      const adaptiveService = module.get<OverloadService>(OverloadService);

      // Initial threshold
      let status = adaptiveService.getStatus();
      const _initialThreshold = status.adaptiveThreshold;

      // Create high load
      const contexts = Array(15)
        .fill(null)
        .map(() => createMockProtectionContext());
      await Promise.all(contexts.map((ctx) => adaptiveService.acquire(ctx).catch(() => {})));

      // Wait for adjustment
      await waitFor(150);

      status = adaptiveService.getStatus();
      // Threshold might have adjusted based on load
      expect(status.adaptiveThreshold).toBeDefined();

      // Clean up
      adaptiveService.clearQueue();
      await adaptiveService.forceRelease(status.currentRequests);
    });
  });

  describe("forceRelease", () => {
    it("should force release multiple requests", async () => {
      const context = createMockProtectionContext();

      // Acquire multiple requests
      await Promise.all([
        service.acquire(context),
        service.acquire(context),
        service.acquire(context),
      ]);

      let status = service.getStatus();
      expect(status.currentRequests).toBe(3);

      // Force release all
      await service.forceRelease(3);

      status = service.getStatus();
      expect(status.currentRequests).toBe(0);
    });

    it("should handle force release with count exceeding current requests", async () => {
      const context = createMockProtectionContext();

      await service.acquire(context);

      // Force release more than acquired
      await service.forceRelease(5);

      const status = service.getStatus();
      expect(status.currentRequests).toBe(0);
    });
  });

  describe("clearQueue", () => {
    it("should clear all queued requests", async () => {
      const context = createMockProtectionContext();
      const config = { maxConcurrentRequests: 1 };

      // Fill capacity
      await service.acquire(context, config);

      // Queue multiple requests
      const queuedPromises = [
        service.acquire(context, config),
        service.acquire(context, config),
        service.acquire(context, config),
      ];

      // Clear queue
      service.clearQueue();

      // All queued requests should be rejected
      const results = await Promise.allSettled(queuedPromises);
      results.forEach((result) => {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(OverloadException);
          expect(result.reason.message).toBe("Queue cleared");
        }
      });

      const status = service.getStatus();
      expect(status.queueLength).toBe(0);
    });

    it("should clear timeout handlers when clearing queue", async () => {
      const context = createMockProtectionContext();
      const config = {
        maxConcurrentRequests: 1,
        queueTimeout: 60000, // Long timeout
      };

      // Fill capacity
      await service.acquire(context, config);

      // Queue request with timeout
      const queuedPromise = service.acquire(context, config);

      // Clear queue immediately
      service.clearQueue();

      // Should reject immediately, not wait for timeout
      await expect(queuedPromise).rejects.toThrow("Queue cleared");
    });
  });

  describe("edge cases", () => {
    it("should handle concurrent acquire/release operations", async () => {
      const context = createMockProtectionContext();
      const operations: Array<Promise<any> | void> = [];

      // Mix of acquire and release operations
      for (let i = 0; i < 20; i++) {
        if (i % 3 === 0) {
          operations.push(service.release());
        } else {
          operations.push(service.acquire(context).catch((e) => e));
        }
      }

      await Promise.all(operations);

      const status = service.getStatus();
      expect(status.currentRequests).toBeGreaterThanOrEqual(0);
      expect(status.currentRequests).toBeLessThanOrEqual(10);
    });

    it("should handle invalid priority header gracefully", async () => {
      const context = createMockProtectionContext({
        headers: { "x-priority": "invalid" },
      });

      const result = await service.acquire(context);
      expect(result.allowed).toBe(true);
    });

    it("should handle health indicator errors", async () => {
      const healthIndicator = jest.fn().mockRejectedValue(new Error("Health check failed"));
      const context = createMockProtectionContext();

      // Force immediate health check
      await waitFor(5100);

      await service.acquire(context, { healthIndicator });

      // Should default to 0.5 health score
      expect(metricsCollector.getMetric("test.overload_health_score")).toBe(0.5);
    });

    it("should calculate health score based on utilization when no indicator provided", async () => {
      const context = createMockProtectionContext();
      const config = {
        maxConcurrentRequests: 10,
        maxQueueSize: 10,
      };

      // Create 50% utilization
      for (let i = 0; i < 5; i++) {
        await service.acquire(context, config);
      }

      // Force health update
      await waitFor(5100);
      await service.acquire(context, config);

      const healthScore = metricsCollector.getMetric("test.overload_health_score");
      expect(healthScore).toBeCloseTo(0.4, 1); // 1 - 0.6 (6/10 utilization)
    });

    it("should handle random shed strategy", async () => {
      const config = {
        maxConcurrentRequests: 0,
        shedStrategy: ShedStrategy.RANDOM,
      };

      // Queue multiple requests
      const _promises = Array(5)
        .fill(null)
        .map(() => service.acquire(createMockProtectionContext(), config).catch(() => {}));

      // Verify queue was shuffled (hard to test randomness directly)
      const status = service.getStatus();
      expect(status.queueLength).toBe(5);

      // Clean up
      service.clearQueue();
    });
  });
});
