export const SHIELD_MODULE_OPTIONS = Symbol("SHIELD_MODULE_OPTIONS");
export const SHIELD_METADATA = Symbol("SHIELD_METADATA");
export const SHIELD_INSTANCE = Symbol("SHIELD_INSTANCE");

export const SHIELD_DECORATORS = {
  CIRCUIT_BREAKER: "shield:circuit-breaker",
  RATE_LIMIT: "shield:rate-limit",
  THROTTLE: "shield:throttle",
  OVERLOAD: "shield:overload",
  PRIORITY: "shield:priority",
  BYPASS: "shield:bypass",
  SHIELD: "shield:protection",
} as const;

export const DEFAULT_CONFIG = {
  global: {
    enabled: true,
    logging: {
      enabled: true,
      level: "info" as const,
    },
  },
  storage: {
    type: "memory" as const,
  },
  circuitBreaker: {
    enabled: false,
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 20,
    allowWarmUp: false,
    warmUpCallVolume: 10,
  },
  rateLimit: {
    enabled: false,
    points: 100,
    duration: 60,
    blockDuration: 60,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  throttle: {
    enabled: false,
    ttl: 60,
    limit: 100,
  },
  overload: {
    enabled: false,
    maxConcurrentRequests: 1000,
    maxQueueSize: 1000,
    queueTimeout: 30000,
    shedStrategy: "fifo" as const,
  },
  metrics: {
    enabled: false,
    type: "prometheus" as const,
    prefix: "nest_shield",
    exportInterval: 60000,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  },
  adapters: {
    type: "auto" as const,
  },
  advanced: {
    gracefulShutdown: {
      enabled: false,
      timeout: 30000,
    },
    requestPriority: {
      enabled: false,
      defaultPriority: 5,
    },
    adaptiveProtection: {
      enabled: false,
      learningPeriod: 3600000,
      adjustmentInterval: 60000,
      sensitivityFactor: 1.5,
    },
    distributedSync: {
      enabled: false,
      syncInterval: 5000,
      channel: "nest-shield:sync",
    },
  },
};

export enum ProtectionType {
  CIRCUIT_BREAKER = "circuit-breaker",
  RATE_LIMIT = "rate-limit",
  THROTTLE = "throttle",
  OVERLOAD = "overload",
}

export enum ShedStrategy {
  FIFO = "fifo",
  LIFO = "lifo",
  PRIORITY = "priority",
  RANDOM = "random",
  CUSTOM = "custom",
}

export enum StorageType {
  MEMORY = "memory",
  REDIS = "redis",
  MEMCACHED = "memcached",
  CUSTOM = "custom",
}

export enum MetricsType {
  PROMETHEUS = "prometheus",
  STATSD = "statsd",
  CUSTOM = "custom",
}

export enum AdapterType {
  AUTO = "auto",
  EXPRESS = "express",
  FASTIFY = "fastify",
  CUSTOM = "custom",
}

export const ERROR_MESSAGES = {
  CIRCUIT_OPEN: "Circuit breaker is OPEN",
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
  THROTTLE_LIMIT_EXCEEDED: "Too many requests",
  OVERLOAD_QUEUE_FULL: "Server is overloaded, please try again later",
  OVERLOAD_TIMEOUT: "Request timeout due to server overload",
  INVALID_CONFIGURATION: "Invalid Shield configuration",
  STORAGE_ERROR: "Storage operation failed",
  ADAPTER_NOT_FOUND: "HTTP adapter not found or not supported",
} as const;

export const HEADER_NAMES = {
  RETRY_AFTER: "Retry-After",
  RATE_LIMIT_LIMIT: "X-RateLimit-Limit",
  RATE_LIMIT_REMAINING: "X-RateLimit-Remaining",
  RATE_LIMIT_RESET: "X-RateLimit-Reset",
  PRIORITY: "X-Request-Priority",
  REQUEST_ID: "X-Request-ID",
} as const;
