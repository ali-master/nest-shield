import { Injectable } from "@nestjs/common";

@Injectable()
export class TestService {
  private requestCount = 0;
  private errorRate = 0.1; // 10% error rate by default

  async processRequest(data?: any): Promise<any> {
    this.requestCount++;

    // Simulate processing time
    await this.delay(50 + Math.random() * 200);

    // Simulate errors based on error rate
    if (Math.random() < this.errorRate) {
      throw new Error(`Processing failed (request #${this.requestCount})`);
    }

    return {
      success: true,
      requestNumber: this.requestCount,
      processedData: data,
      timestamp: new Date().toISOString(),
    };
  }

  async heavyOperation(complexity: number = 1): Promise<any> {
    const operationTime = complexity * 1000; // 1 second per complexity unit
    await this.delay(operationTime);

    return {
      success: true,
      complexity,
      duration: operationTime,
      result: `Heavy operation completed with complexity ${complexity}`,
      timestamp: new Date().toISOString(),
    };
  }

  async batchOperation(items: any[], batchSize: number = 10): Promise<any> {
    const results: any[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((item) => this.processRequest(item)));
      results.push(...batchResults);

      // Small delay between batches
      await this.delay(100);
    }

    return {
      success: true,
      totalItems: items.length,
      batchSize,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  async reliabilityTest(iterations: number = 100): Promise<any> {
    const results = {
      successes: 0,
      failures: 0,
      errors: [] as Array<{ iteration: number; error: string }>,
    };

    for (let i = 0; i < iterations; i++) {
      try {
        await this.processRequest({ iteration: i });
        results.successes++;
      } catch (error) {
        results.failures++;
        results.errors.push({
          iteration: i,
          error: error.message,
        });
      }
    }

    return {
      ...results,
      totalIterations: iterations,
      successRate: (results.successes / iterations) * 100,
      failureRate: (results.failures / iterations) * 100,
      timestamp: new Date().toISOString(),
    };
  }

  setErrorRate(rate: number): void {
    this.errorRate = Math.max(0, Math.min(1, rate));
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  resetRequestCount(): void {
    this.requestCount = 0;
  }

  getErrorRate(): number {
    return this.errorRate;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
