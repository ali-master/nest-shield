import type {
  IStorageAdapter,
  IProtectionContext,
  IMetricsCollector,
  IHttpAdapter,
} from "../interfaces";
import { BaseAnomalyDetector } from "../anomaly-detection/detectors/base.detector";
import type { Observable } from "rxjs";
import { of } from "rxjs";

export const createMockExecutionContext = (
  request: any = {},
  response: any = {},
  handler: any = { name: "testHandler" },
): {
  switchToHttp: () => {
    getRequest: () => any;
    getResponse: () => any;
    getNext: () => jest.Mock<any, any, any>;
  };
  getClass: () => { name: string };
  getHandler: () => any;
  getArgs: () => any[];
  getArgByIndex: () => null;
  switchToRpc: () => { getData: () => null; getContext: () => null };
  switchToWs: () => { getData: () => null; getClient: () => null };
  getType: () => any;
} => ({
  switchToHttp: () => ({
    getRequest: () => ({
      ip: "127.0.0.1",
      headers: {},
      method: "GET",
      url: "/test",
      user: null,
      ...request,
    }),
    getResponse: () => ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      ...response,
    }),
    getNext: () => jest.fn(),
  }),
  getClass: () => ({ name: "TestController" }),
  getHandler: () => handler,
  getArgs: () => [],
  getArgByIndex: () => null,
  switchToRpc: () => ({ getData: () => null, getContext: () => null }),
  switchToWs: () => ({ getData: () => null, getClient: () => null }),
  getType: () => "http" as any,
});

export const createMockProtectionContext = (
  overrides: Partial<IProtectionContext> = {},
): IProtectionContext => ({
  request: {},
  response: {},
  handler: { name: "testHandler" },
  class: { name: "TestClass" },
  ip: "127.0.0.1",
  userAgent: "test-agent",
  path: "/test",
  method: "GET",
  headers: {},
  metadata: {},
  timestamp: Date.now(),
  ...overrides,
});

export class MockStorageAdapter implements IStorageAdapter {
  private storage = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.storage.set(key, value);
    if (ttl) {
      setTimeout(() => this.storage.delete(key), ttl * 1000);
    }
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async increment(key: string, value: number = 1): Promise<number> {
    const current = this.storage.get(key) || 0;
    const newValue = current + value;
    this.storage.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    const current = this.storage.get(key) || 0;
    const newValue = Math.max(0, current - value);
    this.storage.set(key, newValue);
    return newValue;
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (this.storage.has(key)) {
      const _value = this.storage.get(key);
      setTimeout(() => this.storage.delete(key), ttl * 1000);
    }
  }

  async ttl(_key: string): Promise<number> {
    return -1; // Simplified for testing
  }

  async scan(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return Array.from(this.storage.keys()).filter((key) => regex.test(key));
  }

  async mget(keys: string[]): Promise<any[]> {
    return keys.map((key) => this.storage.get(key));
  }

  async mset(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, ttl);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    return this.scan(pattern);
  }

  async flush(): Promise<void> {
    this.storage.clear();
  }

  async connect(): Promise<void> {
    // No-op for mock
  }

  async disconnect(): Promise<void> {
    // No-op for mock
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async lock(key: string, ttl: number): Promise<boolean> {
    if (await this.exists(`lock:${key}`)) {
      return false;
    }
    await this.set(`lock:${key}`, true, ttl);
    return true;
  }

  async unlock(key: string): Promise<void> {
    await this.delete(`lock:${key}`);
  }

  // Helper method for tests
  async clear(): Promise<void> {
    this.storage.clear();
  }

  // Helper method to get all storage content
  getAll(): Map<string, any> {
    return new Map(this.storage);
  }
}

export class MockMetricsCollector implements IMetricsCollector {
  public metrics = new Map<string, any>();

  increment(metric: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getKey(metric, tags);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }

  decrement(metric: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getKey(metric, tags);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, Math.max(0, current - value));
  }

  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(metric, tags);
    this.metrics.set(key, value);
  }

  histogram(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(metric, tags);
    const values = this.metrics.get(key) || [];
    values.push(value);
    this.metrics.set(key, values);
  }

  summary(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(metric, tags);
    const values = this.metrics.get(key) || [];
    values.push(value);
    this.metrics.set(key, values);
  }

  timing(metric: string, value: number, tags?: Record<string, string>): void {
    this.histogram(`${metric}.timing`, value, tags);
  }

  async flush(): Promise<void> {
    // No-op for mock
  }

  private getKey(metric: string, tags?: Record<string, string>): string {
    if (!tags) return metric;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    return `${metric}{${tagStr}}`;
  }

  // Helper methods for tests
  clear(): void {
    this.metrics.clear();
  }

  getMetric(metric: string, tags?: Record<string, string>): any {
    return this.metrics.get(this.getKey(metric, tags));
  }

  getAllMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }
}

export class MockHttpAdapter implements IHttpAdapter {
  getRequest(context: any): any {
    return context.request || context;
  }

  getResponse(context: any): any {
    return context.response || { status: () => {}, send: () => {} };
  }

  getIp(request: any): string {
    return request.ip || "127.0.0.1";
  }

  getUserAgent(request: any): string {
    return request.headers?.["user-agent"] || "test-agent";
  }

  getPath(request: any): string {
    return request.url || request.path || "/test";
  }

  getMethod(request: any): string {
    return request.method || "GET";
  }

  getHeaders(request: any): Record<string, string> {
    return request.headers || {};
  }

  setHeaders(response: any, headers: Record<string, string>): void {
    if (response.setHeader) {
      Object.entries(headers).forEach(([key, value]) => {
        response.setHeader(key, value);
      });
    }
  }

  send(response: any, data: any, statusCode?: number): void {
    if (statusCode && response.status) {
      response.status(statusCode);
    }
    if (response.send) {
      response.send(data);
    } else if (response.json) {
      response.json(data);
    }
  }

  getBody(request: any): any {
    return request.body || {};
  }

  getQuery(request: any): any {
    return request.query || {};
  }

  getParams(request: any): any {
    return request.params || {};
  }

  setHeader(response: any, name: string, value: string): void {
    if (response.setHeader) {
      response.setHeader(name, value);
    }
  }

  setStatus(response: any, code: number): void {
    if (response.status) {
      response.status(code);
    }
  }
}

export class MockAnomalyDetector extends BaseAnomalyDetector {
  readonly name = "Mock Anomaly Detector";
  readonly version = "1.0.0";
  readonly description = "Mock detector for testing";

  private anomalies: boolean[] = [];
  private nextAnomalyIndex = 0;

  constructor(private shouldDetectAnomaly: boolean = false) {
    super();
  }

  protected async performTraining(_data: any[]): Promise<void> {
    // Mock training implementation
  }

  async detect(dataPoints: any[]): Promise<any[]> {
    return dataPoints.map((point, _index) => ({
      ...point,
      isAnomaly: this.getNextAnomaly(),
      anomalyScore: this.shouldDetectAnomaly ? 0.9 : 0.1,
      confidence: 0.95,
    }));
  }

  async train(_historicalData: any[]): Promise<void> {
    // Mock training
  }

  async predict(dataPoints: any[]): Promise<any[]> {
    return dataPoints.map((point) => ({
      ...point,
      prediction: point.value * 1.1,
      confidence: 0.9,
    }));
  }

  getType(): string {
    return "mock-detector";
  }

  getPerformanceMetrics(): any {
    return {
      accuracy: 0.95,
      precision: 0.92,
      recall: 0.88,
      f1Score: 0.9,
    };
  }

  // Helper methods for tests
  setAnomalies(anomalies: boolean[]): void {
    this.anomalies = anomalies;
    this.nextAnomalyIndex = 0;
  }

  private getNextAnomaly(): boolean {
    if (this.anomalies.length === 0) {
      return this.shouldDetectAnomaly;
    }
    const anomaly = this.anomalies[this.nextAnomalyIndex % this.anomalies.length];
    this.nextAnomalyIndex++;
    return anomaly;
  }
}

export const createMockConfigService = (config: any = {}) => ({
  get: jest.fn((key: string) => {
    const keys = key.split(".");
    let value = config;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  }),
  getOrThrow: jest.fn((key: string) => {
    const value = config[key];
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" does not exist`);
    }
    return value;
  }),
});

export const createMockReflector = (metadata: any = {}) => ({
  get: jest.fn((key: string, _target: any) => metadata[key]),
  getAll: jest.fn((keys: string[], _target: any) =>
    keys.map((key) => metadata[key]).filter((v) => v !== undefined),
  ),
  getAllAndMerge: jest.fn((key: string, targets: any[]) => {
    const values = targets.map((_t) => metadata[key]).filter((v) => v !== undefined);
    return Object.assign({}, ...values);
  }),
  getAllAndOverride: jest.fn((key: string, targets: any[]) => {
    for (const _target of targets) {
      const value = metadata[key];
      if (value !== undefined) return value;
    }
    return undefined;
  }),
});

export const createMockLogger = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
});

export const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const createMockObservable = <T>(value: T): Observable<T> => of(value);

export interface TestingModule {
  get: <T>(token: any) => T;
}

export const createTestingModule = async (moduleMetadata: any): Promise<TestingModule> => {
  const { Test } = await import("@nestjs/testing");
  const moduleRef = await Test.createTestingModule(moduleMetadata).compile();
  return moduleRef;
};
