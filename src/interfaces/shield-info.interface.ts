/**
 * Shield Protection Information Interfaces
 * These interfaces define the structure of protection information objects
 * that are attached to requests and used in decorators throughout the application.
 */

export interface IRateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  headers?: Record<string, string>;
}

export interface IThrottleInfo {
  limit: number;
  remaining: number;
  reset: number;
  headers?: Record<string, string>;
}

export interface ICircuitBreakerStats {
  fires: number;
  failures: number;
  successes: number;
  timeouts: number;
  cacheHits: number;
  cacheMisses: number;
  rejects: number;
  fallbacks: number;
  latencyMean: number;
}

export interface ICircuitBreakerInfo {
  state: "open" | "closed" | "half-open" | "disabled" | undefined;
  stats?: ICircuitBreakerStats;
  error?: string;
}

export interface IOverloadInfo {
  queueLength: number;
  currentRequests: number;
  maxConcurrent?: number;
  healthScore?: number;
  queueWaitTime?: number;
}

export interface IShieldMetrics {
  [key: string]: any;
}