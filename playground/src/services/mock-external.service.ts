import { Injectable } from "@nestjs/common";

@Injectable()
export class MockExternalService {
  private callCount = 0;
  private failureRate = 0.4; // 40% failure rate by default

  async unreliableOperation(): Promise<any> {
    this.callCount++;

    // Simulate network delay
    await this.delay(Math.random() * 500 + 100);

    if (Math.random() < this.failureRate) {
      throw new Error(`External service failure (call #${this.callCount})`);
    }

    return {
      success: true,
      callNumber: this.callCount,
      message: "External service call successful",
      timestamp: new Date().toISOString(),
    };
  }

  async slowOperation(delayMs: number = 2000): Promise<any> {
    await this.delay(delayMs);

    return {
      success: true,
      message: `Slow operation completed after ${delayMs}ms`,
      timestamp: new Date().toISOString(),
    };
  }

  async fastOperation(): Promise<any> {
    await this.delay(50);

    return {
      success: true,
      message: "Fast operation completed",
      timestamp: new Date().toISOString(),
    };
  }

  async alwaysFailOperation(): Promise<any> {
    await this.delay(100);
    throw new Error("This operation always fails");
  }

  async intermittentFailOperation(): Promise<any> {
    await this.delay(200);

    // Fail every 3rd call
    if (this.callCount % 3 === 0) {
      throw new Error("Intermittent failure");
    }

    return {
      success: true,
      message: "Intermittent operation succeeded",
      callNumber: this.callCount,
      timestamp: new Date().toISOString(),
    };
  }

  async heavyComputationOperation(): Promise<any> {
    // Simulate heavy computation
    await this.delay(1000 + Math.random() * 1000);

    const iterations = Math.floor(Math.random() * 1000000);
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i);
    }

    return {
      success: true,
      message: "Heavy computation completed",
      iterations,
      result: Math.floor(result),
      timestamp: new Date().toISOString(),
    };
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
