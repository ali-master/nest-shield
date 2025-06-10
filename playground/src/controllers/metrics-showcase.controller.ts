import { Controller, Get, Post, Body } from "@nestjs/common";
import { Shield, ShieldMetrics, Priority } from "nest-shield/decorators";
import {
  InjectMetrics,
  InjectTimeWindowAggregator,
  InjectRollingWindowAggregator,
  InjectPercentileAggregator,
} from "nest-shield/core";
import type { MetricsService } from "nest-shield";
import { CustomMetricsService } from "../services/custom-metrics.service";

/**
 * Metrics Showcase Controller
 *
 * Demonstrates all metrics collection, aggregation, and export capabilities
 * using the new DI implementation with Symbol-based tokens.
 */
@Controller("metrics-showcase")
export class MetricsShowcaseController {
  constructor(
    @InjectMetrics()
    private readonly metricsService: MetricsService,

    @InjectTimeWindowAggregator()
    private readonly timeWindowAggregator: any,

    @InjectRollingWindowAggregator()
    private readonly rollingWindowAggregator: any,

    @InjectPercentileAggregator()
    private readonly percentileAggregator: any,

    private readonly customMetricsService: CustomMetricsService,
  ) {}

  @Get("collectors-overview")
  @Priority(7)
  async getCollectorsOverview() {
    return {
      message: "Comprehensive metrics collectors overview",
      diImplementation: {
        metricsServiceDecorator: "@InjectMetrics()",
        timeWindowAggregatorDecorator: "@InjectTimeWindowAggregator()",
        rollingWindowAggregatorDecorator: "@InjectRollingWindowAggregator()",
        percentileAggregatorDecorator: "@InjectPercentileAggregator()",
      },
      injectedServices: {
        metricsService: !!this.metricsService,
        timeWindowAggregator: !!this.timeWindowAggregator,
        rollingWindowAggregator: !!this.rollingWindowAggregator,
        percentileAggregator: !!this.percentileAggregator,
      },
      availableCollectors: [
        {
          name: "Prometheus Collector",
          decorator: "@InjectPrometheusCollector()",
          description: "Prometheus-compatible metrics collection",
          format: "Prometheus exposition format",
          features: ["Histograms", "Counters", "Gauges", "Summaries"],
          useCase: "Production monitoring with Prometheus",
          performance: "High",
        },
        {
          name: "StatsD Collector",
          decorator: "@InjectStatsDCollector()",
          description: "StatsD protocol metrics collection",
          format: "StatsD protocol",
          features: ["Counters", "Gauges", "Timers", "Sets"],
          useCase: "Real-time metrics with Graphite/DataDog",
          performance: "Very High",
        },
        {
          name: "DataDog Collector",
          decorator: "@InjectDatadogCollector()",
          description: "DataDog-specific metrics collection",
          format: "DataDog API format",
          features: ["Custom tags", "Distributions", "Histograms"],
          useCase: "DataDog APM integration",
          performance: "High",
        },
        {
          name: "CloudWatch Collector",
          decorator: "@InjectCloudWatchCollector()",
          description: "AWS CloudWatch metrics collection",
          format: "CloudWatch API format",
          features: ["Custom metrics", "Dimensions", "Alarms"],
          useCase: "AWS infrastructure monitoring",
          performance: "Medium",
        },
        {
          name: "Custom Collector",
          decorator: "@InjectCustomMetricsCollector()",
          description: "User-defined metrics collection",
          format: "Configurable",
          features: ["Flexible format", "Custom endpoints", "Transformations"],
          useCase: "Integration with custom monitoring systems",
          performance: "Variable",
        },
      ],
      availableExporters: [
        {
          name: "Prometheus Exporter",
          decorator: "@InjectPrometheusExporter()",
          description: "Export metrics in Prometheus format",
          endpoint: "/metrics",
        },
        {
          name: "JSON Exporter",
          decorator: "@InjectJsonExporter()",
          description: "Export metrics as JSON",
          endpoint: "/metrics/json",
        },
        {
          name: "OpenMetrics Exporter",
          decorator: "@InjectOpenMetricsExporter()",
          description: "Export metrics in OpenMetrics format",
          endpoint: "/metrics/openmetrics",
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("prometheus-metrics")
  @Shield({ rateLimit: { points: 20, duration: 60 } })
  async getPrometheusMetrics(@ShieldMetrics() shieldMetrics: any) {
    // Simulate Prometheus metrics collection via DI injection
    const prometheusMetrics = `
# HELP nest_shield_requests_total Total number of requests processed
# TYPE nest_shield_requests_total counter
nest_shield_requests_total{method="GET",status="200",endpoint="/api/users"} 1248
nest_shield_requests_total{method="POST",status="201",endpoint="/api/users"} 89
nest_shield_requests_total{method="GET",status="404",endpoint="/api/users"} 12

# HELP nest_shield_request_duration_seconds Request duration in seconds
# TYPE nest_shield_request_duration_seconds histogram
nest_shield_request_duration_seconds_bucket{le="0.005"} 123
nest_shield_request_duration_seconds_bucket{le="0.01"} 245
nest_shield_request_duration_seconds_bucket{le="0.025"} 456
nest_shield_request_duration_seconds_bucket{le="0.05"} 678
nest_shield_request_duration_seconds_bucket{le="0.1"} 890
nest_shield_request_duration_seconds_bucket{le="0.25"} 1023
nest_shield_request_duration_seconds_bucket{le="0.5"} 1156
nest_shield_request_duration_seconds_bucket{le="1"} 1234
nest_shield_request_duration_seconds_bucket{le="+Inf"} 1248
nest_shield_request_duration_seconds_sum 425.67
nest_shield_request_duration_seconds_count 1248

# HELP nest_shield_active_connections Current number of active connections
# TYPE nest_shield_active_connections gauge
nest_shield_active_connections 23

# HELP nest_shield_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 0.5=half-open)
# TYPE nest_shield_circuit_breaker_state gauge
nest_shield_circuit_breaker_state{name="external_api"} 0
nest_shield_circuit_breaker_state{name="database"} 0.5
    `.trim();

    return {
      message: "Prometheus metrics via DI injection",
      collectorType: "prometheus",
      collectorDecorator: "@InjectPrometheusCollector()",
      exporterDecorator: "@InjectPrometheusExporter()",
      serviceInjected: !!this.metricsService,
      format: "text/plain; version=0.0.4; charset=utf-8",
      metrics: prometheusMetrics,
      shieldMetrics,
      configuration: {
        prefix: "nest_shield_playground",
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        labels: {
          application: "nest-shield-playground",
          version: "1.0.0",
          environment: "development",
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("statsd-metrics")
  async getStatsdMetrics() {
    // Simulate StatsD metrics collection
    const statsdMetrics = [
      "nest_shield.requests.total:1248|c|#method:GET,status:200",
      "nest_shield.requests.total:89|c|#method:POST,status:201",
      "nest_shield.request.duration:425.67|ms|#endpoint:/api/users",
      "nest_shield.active.connections:23|g",
      "nest_shield.circuit_breaker.failures:3|c|#name:external_api",
      "nest_shield.rate_limit.blocked:12|c|#endpoint:/api/orders",
      "nest_shield.memory.usage:67.5|g|#type:heap_used",
      "nest_shield.cpu.usage:15.8|g|#core:average",
    ];

    return {
      message: "StatsD metrics via DI injection",
      collectorType: "statsd",
      collectorDecorator: "@InjectStatsDCollector()",
      serviceInjected: !!this.metricsService,
      format: "StatsD protocol",
      metrics: statsdMetrics,
      configuration: {
        prefix: "nest_shield",
        host: "localhost",
        port: 8125,
        flushInterval: 1000,
        maxBufferSize: 1000,
        protocol: "UDP",
      },
      features: [
        "Real-time metric transmission",
        "Low overhead",
        "Fire-and-forget delivery",
        "Automatic aggregation",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("datadog-metrics")
  async getDatadogMetrics() {
    // Simulate DataDog metrics collection
    const datadogMetrics = {
      series: [
        {
          metric: "nest_shield.requests.rate",
          points: [[Date.now(), 12.5]],
          tags: ["environment:development", "service:nest-shield-playground"],
          type: "rate",
        },
        {
          metric: "nest_shield.response.time.p95",
          points: [[Date.now(), 245.8]],
          tags: ["environment:development", "endpoint:/api/users"],
          type: "gauge",
        },
        {
          metric: "nest_shield.errors.rate",
          points: [[Date.now(), 0.05]],
          tags: ["environment:development", "service:nest-shield-playground"],
          type: "rate",
        },
      ],
    };

    return {
      message: "DataDog metrics via DI injection",
      collectorType: "datadog",
      collectorDecorator: "@InjectDatadogCollector()",
      serviceInjected: !!this.metricsService,
      format: "DataDog API JSON format",
      metrics: datadogMetrics,
      configuration: {
        apiKey: "dd_api_key_placeholder",
        site: "datadoghq.com",
        service: "nest-shield-playground",
        environment: "development",
        version: "1.0.0",
        compressionEnabled: true,
      },
      features: [
        "Custom tags and dimensions",
        "Distribution metrics",
        "APM integration",
        "Log correlation",
        "Real-time alerting",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("cloudwatch-metrics")
  async getCloudwatchMetrics() {
    // Simulate CloudWatch metrics collection
    const cloudwatchMetrics = {
      MetricData: [
        {
          MetricName: "RequestCount",
          Dimensions: [
            { Name: "Service", Value: "NestShieldPlayground" },
            { Name: "Environment", Value: "Development" },
          ],
          Value: 1248,
          Unit: "Count",
          Timestamp: new Date().toISOString(),
        },
        {
          MetricName: "ResponseTime",
          Dimensions: [
            { Name: "Service", Value: "NestShieldPlayground" },
            { Name: "Endpoint", Value: "/api/users" },
          ],
          Value: 234.5,
          Unit: "Milliseconds",
          Timestamp: new Date().toISOString(),
        },
        {
          MetricName: "ErrorRate",
          Dimensions: [{ Name: "Service", Value: "NestShieldPlayground" }],
          Value: 2.1,
          Unit: "Percent",
          Timestamp: new Date().toISOString(),
        },
      ],
      Namespace: "NestShield/Playground",
    };

    return {
      message: "CloudWatch metrics via DI injection",
      collectorType: "cloudwatch",
      collectorDecorator: "@InjectCloudWatchCollector()",
      serviceInjected: !!this.metricsService,
      format: "AWS CloudWatch API format",
      metrics: cloudwatchMetrics,
      configuration: {
        region: "us-east-1",
        namespace: "NestShield/Playground",
        batchSize: 20,
        flushInterval: 60000,
        credentials: "AWS SDK default chain",
      },
      features: [
        "AWS native integration",
        "Custom dimensions",
        "Automatic scaling",
        "CloudWatch Alarms",
        "Dashboard integration",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Post("time-window-aggregation")
  async timeWindowAggregation(
    @Body()
    body: {
      values: number[];
      windowSize?: number;
      aggregationType?: "sum" | "average" | "max" | "min" | "count";
    },
  ) {
    const { values, windowSize = 10, aggregationType = "average" } = body;

    // Simulate time window aggregation via DI injection
    const windows: any[] = [];
    for (let i = 0; i < values.length; i += windowSize) {
      const windowValues = values.slice(i, i + windowSize);
      let aggregatedValue;

      switch (aggregationType) {
        case "sum":
          aggregatedValue = windowValues.reduce((sum, val) => sum + val, 0);
          break;
        case "max":
          aggregatedValue = Math.max(...windowValues);
          break;
        case "min":
          aggregatedValue = Math.min(...windowValues);
          break;
        case "count":
          aggregatedValue = windowValues.length;
          break;
        case "average":
        default:
          aggregatedValue = windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;
          break;
      }

      windows.push({
        windowIndex: Math.floor(i / windowSize),
        startIndex: i,
        endIndex: Math.min(i + windowSize - 1, values.length - 1),
        values: windowValues,
        aggregatedValue: parseFloat(aggregatedValue.toFixed(4)),
        timestamp: Date.now() + i * 1000,
      });
    }

    return {
      message: "Time window aggregation via DI injection",
      aggregatorType: "time-window",
      aggregatorDecorator: "@InjectTimeWindowAggregator()",
      serviceInjected: !!this.timeWindowAggregator,
      configuration: {
        windowSize,
        aggregationType,
        totalValues: values.length,
        windowsCreated: windows.length,
      },
      windows,
      statistics: {
        overallAverage: parseFloat(
          (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(4),
        ),
        windowAverages: windows.map((w) => w.aggregatedValue),
        minWindow: Math.min(...windows.map((w) => w.aggregatedValue)),
        maxWindow: Math.max(...windows.map((w) => w.aggregatedValue)),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("rolling-window-aggregation")
  async rollingWindowAggregation(
    @Body()
    body: {
      timeSeries: Array<{ value: number; timestamp: number }>;
      windowDuration?: number;
      step?: number;
    },
  ) {
    const { timeSeries, windowDuration = 60000, step = 10000 } = body; // 1 minute window, 10 second step

    // Simulate rolling window aggregation
    const rollingWindows: any[] = [];
    const startTime = Math.min(...timeSeries.map((point) => point.timestamp));
    const endTime = Math.max(...timeSeries.map((point) => point.timestamp));

    for (
      let currentTime = startTime;
      currentTime <= endTime - windowDuration;
      currentTime += step
    ) {
      const windowEnd = currentTime + windowDuration;
      const windowPoints = timeSeries.filter(
        (point) => point.timestamp >= currentTime && point.timestamp < windowEnd,
      );

      if (windowPoints.length > 0) {
        const values = windowPoints.map((p) => p.value);
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        rollingWindows.push({
          windowStart: currentTime,
          windowEnd,
          pointCount: windowPoints.length,
          average: parseFloat(average.toFixed(4)),
          min,
          max,
          values,
          timestamp: new Date(currentTime).toISOString(),
        });
      }
    }

    return {
      message: "Rolling window aggregation via DI injection",
      aggregatorType: "rolling-window",
      aggregatorDecorator: "@InjectRollingWindowAggregator()",
      serviceInjected: !!this.rollingWindowAggregator,
      configuration: {
        windowDuration: `${windowDuration}ms`,
        step: `${step}ms`,
        totalPoints: timeSeries.length,
        windowsCreated: rollingWindows.length,
        timeRange: `${new Date(startTime).toISOString()} - ${new Date(endTime).toISOString()}`,
      },
      rollingWindows,
      statistics: {
        overallAverage: parseFloat(
          (timeSeries.reduce((sum, point) => sum + point.value, 0) / timeSeries.length).toFixed(4),
        ),
        trendDirection:
          rollingWindows.length > 1
            ? rollingWindows[rollingWindows.length - 1].average > rollingWindows[0].average
              ? "increasing"
              : "decreasing"
            : "stable",
        volatility:
          rollingWindows.length > 1
            ? parseFloat(
                (
                  Math.max(...rollingWindows.map((w) => w.average)) -
                  Math.min(...rollingWindows.map((w) => w.average))
                ).toFixed(4),
              )
            : 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("percentile-calculation")
  async percentileCalculation(@Body() body: { values: number[]; percentiles?: number[] }) {
    const { values, percentiles = [50, 90, 95, 99] } = body;

    // Simulate percentile calculation via DI injection
    const sortedValues = [...values].sort((a, b) => a - b);
    const calculatedPercentiles = percentiles.map((p) => {
      const index = Math.ceil((p / 100) * sortedValues.length) - 1;
      return {
        percentile: p,
        value: sortedValues[Math.max(0, index)],
        index,
      };
    });

    const distribution = {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: parseFloat((values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(4)),
      median: calculatedPercentiles.find((p) => p.percentile === 50)?.value || 0,
      standardDeviation: parseFloat(
        Math.sqrt(
          values.reduce(
            (sum, val) =>
              sum + Math.pow(val - values.reduce((s, v) => s + v, 0) / values.length, 2),
            0,
          ) / values.length,
        ).toFixed(4),
      ),
    };

    return {
      message: "Percentile calculation via DI injection",
      aggregatorType: "percentile",
      aggregatorDecorator: "@InjectPercentileAggregator()",
      serviceInjected: !!this.percentileAggregator,
      configuration: {
        totalValues: values.length,
        requestedPercentiles: percentiles,
        calculationMethod: "linear interpolation",
      },
      percentiles: calculatedPercentiles,
      distribution,
      histogram: {
        buckets: [
          { range: "0-10", count: values.filter((v) => v >= 0 && v < 10).length },
          { range: "10-50", count: values.filter((v) => v >= 10 && v < 50).length },
          { range: "50-100", count: values.filter((v) => v >= 50 && v < 100).length },
          { range: "100-500", count: values.filter((v) => v >= 100 && v < 500).length },
          { range: "500+", count: values.filter((v) => v >= 500).length },
        ],
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("custom-metrics-integration")
  async getCustomMetricsIntegration() {
    // Demonstrate integration with custom metrics service
    const customMetrics = await this.customMetricsService.getFormattedMetrics("json");

    return {
      message: "Custom metrics integration showcase",
      collectorDecorator: "@InjectCustomMetricsCollector()",
      metricsServiceInjected: !!this.metricsService,
      customMetricsServiceAvailable: !!this.customMetricsService,
      integration: {
        nativeNestShieldMetrics: "Injected via DI tokens",
        customPlaygroundMetrics: "Direct service injection",
        combinedApproach: "Best of both worlds",
      },
      customMetrics,
      features: [
        "Multi-format export (JSON, Prometheus, OpenMetrics, StatsD)",
        "Label-based filtering",
        "Aggregated statistics",
        "Time window analysis",
        "Custom histogram buckets",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Post("export-all-formats")
  async exportAllFormats(@Body() body: { filters?: Record<string, string> }) {
    const formats = ["json", "prometheus", "openmetrics", "statsd"];
    const exportResults = {};

    for (const format of formats) {
      try {
        exportResults[format] = await this.customMetricsService.getFormattedMetrics(
          format,
          body.filters,
        );
      } catch (error) {
        exportResults[format] = { error: error.message };
      }
    }

    return {
      message: "Multi-format metrics export showcase",
      exporterDecorators: {
        prometheus: "@InjectPrometheusExporter()",
        json: "@InjectJsonExporter()",
        openmetrics: "@InjectOpenMetricsExporter()",
      },
      serviceInjected: !!this.metricsService,
      filters: body.filters || {},
      exportResults,
      supportedFormats: formats,
      features: [
        "Consistent metric naming across formats",
        "Format-specific optimizations",
        "Configurable export intervals",
        "Filtered exports",
        "Compression support",
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get("aggregation-performance")
  @Priority(6)
  async getAggregationPerformance() {
    const performanceMetrics = {
      timeWindowAggregation: {
        avgLatency: Math.random() * 5 + 2,
        throughput: Math.floor(Math.random() * 1000 + 500),
        memoryUsage: Math.random() * 20 + 10,
        accuracy: 99.9,
      },
      rollingWindowAggregation: {
        avgLatency: Math.random() * 10 + 5,
        throughput: Math.floor(Math.random() * 800 + 400),
        memoryUsage: Math.random() * 40 + 20,
        accuracy: 99.8,
      },
      percentileCalculation: {
        avgLatency: Math.random() * 15 + 8,
        throughput: Math.floor(Math.random() * 600 + 300),
        memoryUsage: Math.random() * 30 + 15,
        accuracy: 99.95,
      },
    };

    return {
      message: "Metrics aggregation performance analysis",
      aggregatorDecorators: {
        timeWindow: "@InjectTimeWindowAggregator()",
        rollingWindow: "@InjectRollingWindowAggregator()",
        percentile: "@InjectPercentileAggregator()",
      },
      servicesInjected: {
        timeWindow: !!this.timeWindowAggregator,
        rollingWindow: !!this.rollingWindowAggregator,
        percentile: !!this.percentileAggregator,
      },
      performanceMetrics,
      recommendations: [
        "Use time window aggregation for batch processing",
        "Use rolling window for real-time analysis",
        "Use percentile calculation for SLA monitoring",
        "Consider data volume vs accuracy trade-offs",
        "Monitor memory usage with large datasets",
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
