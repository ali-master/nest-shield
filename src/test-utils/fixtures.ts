import type { ShieldOptions } from "../interfaces/shield-options.interface";
import type { RateLimitOptions } from "../interfaces/rate-limit-options.interface";
import type { CircuitBreakerOptions } from "../interfaces/circuit-breaker-options.interface";
import type { OverloadOptions } from "../interfaces/overload-options.interface";
import type { AnomalyDetectionOptions } from "../interfaces/anomaly-detection-options.interface";
import type { MetricsOptions } from "../interfaces/metrics-options.interface";

export const DEFAULT_TEST_OPTIONS: ShieldOptions = {
  global: {
    enabled: true,
    bypassRoutes: [],
    errorMessage: "Protection triggered",
  },
  rateLimit: {
    enabled: true,
    points: 100,
    duration: 60,
    blockDuration: 60,
  },
  throttle: {
    enabled: true,
    limit: 10,
    ttl: 60,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    halfOpenRequestCount: 1,
    monitoringPeriod: 10000,
    minimumRequestCount: 10,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  },
  overload: {
    enabled: true,
    maxConcurrentRequests: 100,
    maxQueueSize: 1000,
    queueTimeout: 30000,
    shedStrategy: "fifo",
  },
  storage: {
    type: "memory",
  },
  metrics: {
    enabled: true,
    prefix: "shield",
  },
};

export const TEST_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  points: 10,
  duration: 60,
  blockDuration: 300,
  keyGenerator: (context) => context.ip,
};

export const TEST_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,
  successThreshold: 1,
  timeout: 5000,
  resetTimeout: 10000,
  halfOpenRequestCount: 1,
  errorThresholdPercentage: 50,
  monitoringPeriod: 10000,
  minimumRequestCount: 5,
  fallback: async () => ({ fallback: true }),
};

export const TEST_OVERLOAD_OPTIONS: OverloadOptions = {
  maxConcurrentRequests: 10,
  maxQueueSize: 50,
  queueTimeout: 5000,
  shedStrategy: "fifo",
  priorityLevels: [
    { name: "critical", weight: 10, reserved: 2 },
    { name: "high", weight: 5, reserved: 1 },
    { name: "normal", weight: 1, reserved: 0 },
  ],
};

export const TEST_ANOMALY_OPTIONS: AnomalyDetectionOptions = {
  enabled: true,
  sensitivity: 0.8,
  windowSize: 100,
  detectors: ["zscore", "isolation-forest"],
  alertThresholds: {
    warning: 0.7,
    critical: 0.9,
  },
};

export const TEST_METRICS_OPTIONS: MetricsOptions = {
  enabled: true,
  type: "prometheus",
  prefix: "test_shield",
  labels: {
    app: "test",
    env: "test",
  },
};

export const generateTimeSeriesData = (
  count: number,
  options: {
    baseValue?: number;
    variance?: number;
    trend?: number;
    seasonality?: boolean;
    anomalies?: number[];
  } = {},
): Array<{ timestamp: number; value: number; label?: string }> => {
  const {
    baseValue = 100,
    variance = 10,
    trend = 0,
    seasonality = false,
    anomalies = [],
  } = options;

  const data = [];
  const startTime = Date.now() - count * 60000; // Start from 'count' minutes ago

  for (let i = 0; i < count; i++) {
    let value = baseValue + trend * i;

    // Add random variance
    value += (Math.random() - 0.5) * variance * 2;

    // Add seasonality
    if (seasonality) {
      value += Math.sin((i / count) * Math.PI * 2) * variance;
    }

    // Add anomalies
    if (anomalies.includes(i)) {
      value *= Math.random() > 0.5 ? 2.5 : 0.3; // Spike or drop
    }

    data.push({
      timestamp: startTime + i * 60000,
      value: Math.max(0, value),
      label: anomalies.includes(i) ? "anomaly" : "normal",
    });
  }

  return data;
};

export const generateMetricsData = (
  metricNames: string[],
  count: number = 100,
): Array<{ name: string; value: number; timestamp: number; tags?: Record<string, string> }> => {
  const data = [];
  const startTime = Date.now() - count * 60000;

  for (const metricName of metricNames) {
    for (let i = 0; i < count; i++) {
      data.push({
        name: metricName,
        value: Math.random() * 100,
        timestamp: startTime + i * 60000,
        tags: {
          host: `server-${Math.floor(Math.random() * 3) + 1}`,
          region: ["us-east", "us-west", "eu-west"][Math.floor(Math.random() * 3)],
        },
      });
    }
  }

  return data;
};

export const generateRequestContext = (overrides: any = {}) => ({
  ip: "192.168.1.100",
  method: "GET",
  path: "/api/test",
  headers: {
    "user-agent": "test-agent",
    "x-forwarded-for": "10.0.0.1",
  },
  user: {
    id: "user-123",
    role: "user",
  },
  ...overrides,
});

export const generateBatchRequests = (
  count: number,
  options: {
    ipRange?: string[];
    paths?: string[];
    methods?: string[];
    userIds?: string[];
  } = {},
): Array<any> => {
  const {
    ipRange = ["192.168.1.1", "192.168.1.2", "192.168.1.3"],
    paths = ["/api/users", "/api/posts", "/api/comments"],
    methods = ["GET", "POST", "PUT", "DELETE"],
    userIds = ["user-1", "user-2", "user-3"],
  } = options;

  const requests = [];

  for (let i = 0; i < count; i++) {
    requests.push({
      ip: ipRange[Math.floor(Math.random() * ipRange.length)],
      path: paths[Math.floor(Math.random() * paths.length)],
      method: methods[Math.floor(Math.random() * methods.length)],
      headers: {
        "user-agent": `test-agent-${i}`,
        "x-request-id": `req-${i}`,
      },
      user:
        Math.random() > 0.3
          ? {
              id: userIds[Math.floor(Math.random() * userIds.length)],
              role: Math.random() > 0.8 ? "admin" : "user",
            }
          : null,
      timestamp: Date.now() + i * 100,
    });
  }

  return requests;
};

export const TEST_ERROR_MESSAGES = {
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
  CIRCUIT_BREAKER_OPEN: "Circuit breaker is open",
  OVERLOAD_QUEUE_FULL: "Server overload - queue full",
  THROTTLE_LIMIT_EXCEEDED: "Too many requests",
  STORAGE_ERROR: "Storage operation failed",
  ANOMALY_DETECTED: "Anomalous activity detected",
};

export const TEST_TIMEOUTS = {
  UNIT_TEST: 5000,
  INTEGRATION_TEST: 10000,
  E2E_TEST: 30000,
  ASYNC_OPERATION: 100,
  CIRCUIT_BREAKER_RESET: 1000,
  RATE_LIMIT_WINDOW: 100,
};

export const createMockRequest = (overrides: any = {}) => ({
  ip: "127.0.0.1",
  method: "GET",
  url: "/test",
  path: "/test",
  headers: {
    "user-agent": "test",
    host: "localhost",
    ...overrides.headers,
  },
  query: {},
  params: {},
  body: {},
  user: null,
  ...overrides,
});

export const createMockResponse = () => {
  const response: any = {
    statusCode: 200,
    headers: {},
  };

  response.status = jest.fn((code: number) => {
    response.statusCode = code;
    return response;
  });

  response.json = jest.fn((data: any) => {
    response.body = data;
    return response;
  });

  response.send = jest.fn((data: any) => {
    response.body = data;
    return response;
  });

  response.setHeader = jest.fn((name: string, value: string) => {
    response.headers[name] = value;
    return response;
  });

  response.getHeader = jest.fn((name: string) => response.headers[name]);

  return response;
};
