import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ShieldMetrics } from "nest-shield";
import { InjectMetrics } from "nest-shield/core";
import type { MetricsService } from "nest-shield";
import { CustomMetricsService } from "../services/custom-metrics.service";

@ApiTags("Metrics")
@Controller("metrics")
export class MetricsController {
  constructor(
    @InjectMetrics()
    private readonly metricsService: MetricsService,
    private readonly customMetricsService: CustomMetricsService,
  ) {}

  @Get("current")
  @ApiOperation({
    summary: "Get current metrics snapshot",
    description: `
      Retrieves the current metrics collected by NestShield including protection metrics and system metrics.
      
      **Includes:**
      - Shield protection metrics (rate limits, circuit breakers, etc.)
      - System metrics (uptime, memory, CPU usage)
      - Timestamp of the snapshot
      
      **Use case:** Monitoring dashboard data, health checks, debugging protection behavior.
    `,
  })
  @ApiResponse({
    status: 200,
    description: "Current metrics data",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        shieldMetrics: { type: "object", description: "NestShield protection metrics" },
        systemMetrics: {
          type: "object",
          properties: {
            uptime: { type: "number", description: "Process uptime in seconds" },
            memoryUsage: { type: "object", description: "Memory usage statistics" },
            cpuUsage: { type: "object", description: "CPU usage statistics" },
          },
        },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  async getCurrentMetrics(@ShieldMetrics() shieldMetrics: any) {
    return {
      message: "Current metrics snapshot",
      shieldMetrics,
      systemMetrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("prometheus")
  @ApiOperation({
    summary: "Get Prometheus-formatted metrics",
    description: `
      Retrieves metrics in Prometheus exposition format for integration with monitoring systems.
      
      **Format:** Prometheus text-based exposition format
      **Use case:** Integration with Prometheus, Grafana, or other monitoring tools
      
      **Note:** In a production setup, this would typically be exposed on a separate port
      for security reasons (e.g., /metrics endpoint on port 9090).
    `,
  })
  @ApiResponse({
    status: 200,
    description: "Prometheus-formatted metrics",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        format: { type: "string", example: "prometheus" },
        metrics: { type: "object", description: "Metrics in Prometheus format" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  async getPrometheusMetrics() {
    // This would typically call the metrics service to get Prometheus format
    const metrics = (await this.metricsService.exportMetrics?.()) || {};

    return {
      message: "Prometheus-formatted metrics",
      format: "prometheus",
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("json")
  async getJsonMetrics() {
    const metrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: "JSON-formatted metrics",
      format: "json",
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("increment")
  async incrementMetric(
    @Body() body: { metric: string; value?: number; labels?: Record<string, string> },
  ) {
    await this.customMetricsService.incrementCounter(body.metric, body.value || 1, body.labels);

    return {
      message: "Metric incremented",
      metric: body.metric,
      value: body.value || 1,
      labels: body.labels,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("gauge")
  async setGauge(@Body() body: { metric: string; value: number; labels?: Record<string, string> }) {
    await this.customMetricsService.setGauge(body.metric, body.value, body.labels);

    return {
      message: "Gauge metric set",
      metric: body.metric,
      value: body.value,
      labels: body.labels,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("histogram")
  async recordHistogram(
    @Body() body: { metric: string; value: number; labels?: Record<string, string> },
  ) {
    await this.customMetricsService.recordHistogram(body.metric, body.value, body.labels);

    return {
      message: "Histogram value recorded",
      metric: body.metric,
      value: body.value,
      labels: body.labels,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("response-time-distribution")
  async responseTimeDistribution(@Query("samples") samples: string = "1000") {
    const sampleCount = Math.min(parseInt(samples, 10) || 1000, 5000);

    // Generate sample response times
    for (let i = 0; i < sampleCount; i++) {
      const responseTime = this.generateRealisticResponseTime();
      await this.customMetricsService.recordHistogram("http_request_duration_ms", responseTime, {
        method: i % 4 === 0 ? "POST" : "GET",
        status: i % 20 === 0 ? "500" : "200",
        endpoint: `/api/test/${i % 10}`,
      });
    }

    const metrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: `Generated ${sampleCount} response time samples`,
      distribution: metrics.histograms?.http_request_duration_ms || {},
      timestamp: new Date().toISOString(),
    };
  }

  @Get("request-rate-simulation")
  async requestRateSimulation(@Query("duration") duration: string = "60") {
    const durationSeconds = Math.min(parseInt(duration, 10) || 60, 300); // Max 5 minutes

    const simulation = setInterval(async () => {
      // Simulate varying request rates
      const hour = new Date().getHours();
      const baseRate = hour >= 9 && hour <= 17 ? 10 : 3; // Higher during business hours
      const requestCount = Math.floor(baseRate + Math.random() * 5);

      for (let i = 0; i < requestCount; i++) {
        await this.customMetricsService.incrementCounter("http_requests_total", 1, {
          method: Math.random() > 0.7 ? "POST" : "GET",
          status: Math.random() > 0.95 ? "500" : "200",
        });
      }
    }, 1000);

    // Stop simulation after duration
    setTimeout(() => {
      clearInterval(simulation);
    }, durationSeconds * 1000);

    return {
      message: `Started request rate simulation for ${durationSeconds} seconds`,
      duration: durationSeconds,
      baseRate: "Varies by time of day",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("error-rate-tracking")
  async errorRateTracking(@Query("errorRate") errorRate: string = "0.1") {
    const targetErrorRate = Math.min(parseFloat(errorRate) || 0.1, 1.0);

    // Generate requests with specified error rate
    for (let i = 0; i < 100; i++) {
      const isError = Math.random() < targetErrorRate;
      const statusCode = isError ? "500" : "200";

      await this.customMetricsService.incrementCounter("http_requests_total", 1, {
        status: statusCode,
        method: "GET",
        endpoint: "/api/test",
      });

      if (isError) {
        await this.customMetricsService.incrementCounter("http_errors_total", 1, {
          status: statusCode,
          type: "internal_error",
        });
      }
    }

    const metrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: `Generated 100 requests with ${targetErrorRate * 100}% error rate`,
      targetErrorRate,
      actualErrors: metrics.counters?.http_errors_total || 0,
      totalRequests: metrics.counters?.http_requests_total || 0,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("circuit-breaker-metrics")
  async circuitBreakerMetrics() {
    // Simulate circuit breaker state changes
    const states = ["closed", "open", "half-open"];

    for (const state of states) {
      await this.customMetricsService.setGauge(
        "circuit_breaker_state",
        state === "closed" ? 0 : state === "open" ? 1 : 0.5,
        { name: "external_service", state },
      );

      // Add some failures and successes
      const failures = Math.floor(Math.random() * 10);
      const successes = Math.floor(Math.random() * 20);

      await this.customMetricsService.incrementCounter("circuit_breaker_calls_total", failures, {
        name: "external_service",
        result: "failure",
      });

      await this.customMetricsService.incrementCounter("circuit_breaker_calls_total", successes, {
        name: "external_service",
        result: "success",
      });
    }

    const metrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: "Circuit breaker metrics simulation",
      metrics: {
        states: metrics.gauges?.circuit_breaker_state || {},
        calls: metrics.counters?.circuit_breaker_calls_total || {},
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("rate-limit-metrics")
  async rateLimitMetrics() {
    // Simulate rate limiting metrics
    const endpoints = ["/api/users", "/api/orders", "/api/products"];

    for (const endpoint of endpoints) {
      // Simulate different rate limit scenarios
      const blocked = Math.floor(Math.random() * 5);
      const allowed = Math.floor(Math.random() * 50 + 10);

      await this.customMetricsService.incrementCounter("rate_limit_requests_total", blocked, {
        endpoint,
        result: "blocked",
      });

      await this.customMetricsService.incrementCounter("rate_limit_requests_total", allowed, {
        endpoint,
        result: "allowed",
      });

      // Track current rate limit usage
      const usage = Math.random(); // 0-100% usage
      await this.customMetricsService.setGauge("rate_limit_usage_ratio", usage, {
        endpoint,
      });
    }

    const metrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: "Rate limit metrics simulation",
      metrics: {
        requests: metrics.counters?.rate_limit_requests_total || {},
        usage: metrics.gauges?.rate_limit_usage_ratio || {},
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("system-metrics")
  async systemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Record system metrics
    await this.customMetricsService.setGauge("nodejs_memory_usage_bytes", memUsage.heapUsed, {
      type: "heap_used",
    });

    await this.customMetricsService.setGauge("nodejs_memory_usage_bytes", memUsage.heapTotal, {
      type: "heap_total",
    });

    await this.customMetricsService.setGauge("nodejs_memory_usage_bytes", memUsage.external, {
      type: "external",
    });

    await this.customMetricsService.setGauge("nodejs_cpu_usage_microseconds", cpuUsage.user, {
      type: "user",
    });

    await this.customMetricsService.setGauge("nodejs_cpu_usage_microseconds", cpuUsage.system, {
      type: "system",
    });

    await this.customMetricsService.setGauge("nodejs_uptime_seconds", process.uptime());

    return {
      message: "System metrics recorded",
      metrics: {
        memory: memUsage,
        cpu: cpuUsage,
        uptime: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-business-metrics")
  async customBusinessMetrics() {
    // Simulate business-specific metrics
    const businessMetrics: Array<{ name: string; value: number; labels: Record<string, string> }> =
      [
        {
          name: "orders_processed",
          value: Math.floor(Math.random() * 100),
          labels: { status: "completed" },
        },
        {
          name: "orders_processed",
          value: Math.floor(Math.random() * 10),
          labels: { status: "failed" },
        },
        { name: "revenue_total", value: Math.random() * 10000, labels: { currency: "USD" } },
        {
          name: "active_users",
          value: Math.floor(Math.random() * 1000),
          labels: { type: "authenticated" },
        },
        {
          name: "active_users",
          value: Math.floor(Math.random() * 500),
          labels: { type: "anonymous" },
        },
      ];

    for (const metric of businessMetrics) {
      if (metric.name === "revenue_total") {
        await this.customMetricsService.setGauge(metric.name, metric.value, metric.labels);
      } else {
        await this.customMetricsService.incrementCounter(metric.name, metric.value, metric.labels);
      }
    }

    const metrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: "Custom business metrics recorded",
      metrics: {
        counters: metrics.counters,
        gauges: metrics.gauges,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("export")
  async exportMetrics(@Body() body: { format?: string; filters?: Record<string, string> }) {
    const format = body.format || "json";
    const metrics = await this.customMetricsService.getFormattedMetrics(format, body.filters);

    return {
      message: `Metrics exported in ${format} format`,
      format,
      filters: body.filters,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("aggregated-stats")
  async getAggregatedStats(@Query("window") window: string = "5m") {
    // Simulate aggregated statistics
    const stats = await this.customMetricsService.getAggregatedStats(window);

    return {
      message: `Aggregated statistics for ${window} window`,
      window,
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  private generateRealisticResponseTime(): number {
    // Generate realistic response time distribution
    const rand = Math.random();

    if (rand < 0.7) {
      // 70% of requests are fast (50-200ms)
      return 50 + Math.random() * 150;
    } else if (rand < 0.9) {
      // 20% are medium (200-500ms)
      return 200 + Math.random() * 300;
    } else if (rand < 0.98) {
      // 8% are slow (500-2000ms)
      return 500 + Math.random() * 1500;
    } else {
      // 2% are very slow (2000-5000ms)
      return 2000 + Math.random() * 3000;
    }
  }
}
