import { Controller, Get, Post, Body, Inject } from "@nestjs/common";
import {
  CircuitBreaker,
  QuickCircuitBreaker,
  ShieldContext,
  CircuitBreakerInfo,
} from "@usex/nest-shield";
import type { IProtectionContext, ICircuitBreakerInfo } from "@usex/nest-shield";
import { MockExternalService } from "../services/mock-external.service";

@Controller("circuit-breaker")
export class CircuitBreakerController {
  constructor(
    @Inject(MockExternalService)
    private readonly mockService: MockExternalService,
  ) {}

  @Get("basic")
  @CircuitBreaker({ timeout: 2000, errorThresholdPercentage: 50 })
  async basicCircuitBreaker(@CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo) {
    const result = await this.mockService.unreliableOperation();
    return {
      message: "Basic circuit breaker protection",
      result,
      circuitBreakerInfo: cbInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("fast-fail")
  @CircuitBreaker({ timeout: 1000, errorThresholdPercentage: 30 })
  async fastFailCircuitBreaker(@CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo) {
    const result = await this.mockService.slowOperation(1500); // Will timeout
    return {
      message: "Fast-fail circuit breaker (1s timeout)",
      result,
      circuitBreakerInfo: cbInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("tolerant")
  @CircuitBreaker({ timeout: 5000, errorThresholdPercentage: 80 })
  async tolerantCircuitBreaker(@CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo) {
    const result = await this.mockService.unreliableOperation();
    return {
      message: "Tolerant circuit breaker (80% error threshold)",
      result,
      circuitBreakerInfo: cbInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("with-fallback")
  @CircuitBreaker({
    timeout: 2000,
    errorThresholdPercentage: 50,
    fallback: () => ({ fallback: true, message: "Service is temporarily unavailable" }),
  })
  async withFallbackCircuitBreaker(
    @Body() body: { shouldFail?: boolean },
    @CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo,
  ) {
    if (body.shouldFail) {
      throw new Error("Simulated service failure");
    }

    const result = await this.mockService.unreliableOperation();
    return {
      message: "Circuit breaker with fallback",
      result,
      circuitBreakerInfo: cbInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("quick/:timeout")
  @QuickCircuitBreaker(3000, 40)
  async quickCircuitBreaker(@ShieldContext() context: IProtectionContext) {
    const timeoutMs = parseInt(context.path.split("/").pop() || "3000", 10);
    const result = await this.mockService.slowOperation(timeoutMs - 500);

    return {
      message: `Quick circuit breaker (${timeoutMs}ms timeout, 40% error threshold)`,
      result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("status")
  async getCircuitBreakerStatus(@CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo) {
    return {
      message: "Circuit breaker status check",
      circuitBreakerInfo: cbInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("reset")
  async resetCircuitBreaker() {
    // This would typically reset the circuit breaker state
    // In a real implementation, you'd call a reset method on the circuit breaker service
    return {
      message: "Circuit breaker reset requested",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("metrics")
  @CircuitBreaker({ timeout: 2000, errorThresholdPercentage: 50 })
  async getMetrics(@CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo) {
    const result = await this.mockService.fastOperation();

    return {
      message: "Circuit breaker metrics endpoint",
      result,
      stats: cbInfo.stats,
      state: cbInfo.state,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("cascading-failure/:depth")
  @CircuitBreaker({ timeout: 3000, errorThresholdPercentage: 60 })
  async cascadingFailureDemo(
    @ShieldContext() context: IProtectionContext,
    @CircuitBreakerInfo() cbInfo: ICircuitBreakerInfo,
  ) {
    const depth = parseInt(context.path.split("/").pop() || "1", 10);

    try {
      // Simulate cascading failure by calling multiple operations
      const results: any[] = [];
      for (let i = 0; i < depth; i++) {
        const result = await this.mockService.unreliableOperation();
        results.push(result);
      }

      return {
        message: `Cascading failure simulation (depth: ${depth})`,
        results,
        circuitBreakerInfo: cbInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        message: `Cascading failure caught (depth: ${depth})`,
        error: (error as Error).message,
        circuitBreakerInfo: cbInfo,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
