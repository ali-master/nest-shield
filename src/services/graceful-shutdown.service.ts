import type { OnApplicationShutdown } from "@nestjs/common";
import { Logger, Injectable, Inject } from "@nestjs/common";
import { SHIELD_MODULE_OPTIONS } from "../core/constants";
import type { IGracefulShutdownConfig } from "../interfaces/shield-config.interface";
import type { OverloadService } from "./overload.service";
import type { CircuitBreakerService } from "./circuit-breaker.service";
import type { MetricsService } from "./metrics.service";

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly config: IGracefulShutdownConfig;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    @Inject(SHIELD_MODULE_OPTIONS) private readonly options: any,
    private readonly overloadService: OverloadService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly metricsService: MetricsService,
  ) {
    this.config = this.options.advanced?.gracefulShutdown || { enabled: false, timeout: 30000 };
    this.setupShutdownHandlers();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (!this.config.enabled || this.isShuttingDown) {
      return;
    }

    this.logger.log(`Initiating graceful shutdown... Signal: ${signal}`);
    this.isShuttingDown = true;

    if (!this.shutdownPromise) {
      this.shutdownPromise = this.performShutdown();
    }

    await this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    const shutdownTimeout = setTimeout(() => {
      this.logger.error("Graceful shutdown timeout exceeded, forcing shutdown");
      process.exit(1);
    }, this.config.timeout);

    try {
      this.metricsService.increment("graceful_shutdown_initiated");

      if (this.config.beforeShutdown) {
        await this.config.beforeShutdown();
      }

      await this.stopAcceptingNewRequests();
      await this.drainExistingRequests();
      await this.closeCircuitBreakers();
      await this.flushMetrics();

      if (this.config.onShutdown) {
        await this.config.onShutdown();
      }

      this.logger.log("Graceful shutdown completed successfully");
      this.metricsService.increment("graceful_shutdown_completed");
    } catch (error) {
      this.logger.error("Error during graceful shutdown", error);
      this.metricsService.increment("graceful_shutdown_error");
      throw error;
    } finally {
      clearTimeout(shutdownTimeout);
    }
  }

  private async stopAcceptingNewRequests(): Promise<void> {
    this.logger.log("Stopping acceptance of new requests");
    this.overloadService.clearQueue();
  }

  private async drainExistingRequests(): Promise<void> {
    this.logger.log("Draining existing requests");

    const drainInterval = setInterval(() => {
      const status = this.overloadService.getStatus();
      this.logger.debug(
        `Active requests: ${status.currentRequests}, Queue length: ${status.queueLength}`,
      );

      if (status.currentRequests === 0 && status.queueLength === 0) {
        clearInterval(drainInterval);
      }
    }, 1000);

    const maxDrainTime = Math.min(this.config.timeout * 0.8, 60000);
    const startTime = Date.now();

    while (true) {
      const status = this.overloadService.getStatus();

      if (status.currentRequests === 0 && status.queueLength === 0) {
        break;
      }

      if (Date.now() - startTime > maxDrainTime) {
        this.logger.warn(`Drain timeout reached. Remaining requests: ${status.currentRequests}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    clearInterval(drainInterval);
  }

  private async closeCircuitBreakers(): Promise<void> {
    this.logger.log("Closing circuit breakers");
    const stats = this.circuitBreakerService.getAllStats();

    for (const key in stats) {
      this.circuitBreakerService.disable(key);
    }
  }

  private async flushMetrics(): Promise<void> {
    this.logger.log("Flushing metrics");
    this.metricsService.gauge("graceful_shutdown_status", 1);
  }

  private setupShutdownHandlers(): void {
    if (!this.config.enabled) {
      return;
    }

    const signals = ["SIGTERM", "SIGINT", "SIGUSR2"];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.log(`Received ${signal} signal`);
        await this.onApplicationShutdown(signal);
        process.exit(0);
      });
    });

    process.on("beforeExit", async (code) => {
      this.logger.log(`Process beforeExit with code: ${code}`);
      await this.onApplicationShutdown("beforeExit");
    });
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  getShutdownStatus(): {
    isShuttingDown: boolean;
    activeRequests: number;
    queueLength: number;
  } {
    const status = this.overloadService.getStatus();

    return {
      isShuttingDown: this.isShuttingDown,
      activeRequests: status.currentRequests,
      queueLength: status.queueLength,
    };
  }
}
