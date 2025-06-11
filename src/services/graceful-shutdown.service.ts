import type { OnApplicationShutdown } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { InjectShieldLogger, InjectShieldConfig } from "../core/injection.decorators";
import type { IGracefulShutdownConfig } from "../interfaces";
import type { ShieldLoggerService } from "./shield-logger.service";

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly config: IGracefulShutdownConfig;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private metricsFlushCalled = false;

  constructor(
    @InjectShieldConfig() private readonly options: any,
    @InjectShieldLogger() private readonly logger: ShieldLoggerService,
  ) {
    this.config = this.options.advanced?.gracefulShutdown || { enabled: false, timeout: 30000 };
    this.setupShutdownHandlers();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (!this.config.enabled || this.isShuttingDown) {
      return;
    }

    this.logger.shutdown(`Initiating graceful shutdown... Signal: ${signal}`);
    this.isShuttingDown = true;

    if (!this.shutdownPromise) {
      this.shutdownPromise = this.performShutdown();
    }

    await this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    const shutdownTimeout = setTimeout(() => {
      this.logger.shutdownError("Graceful shutdown timeout exceeded, forcing shutdown");
      process.exit(1);
    }, this.config.timeout);

    try {
      this.logger.shutdown("Graceful shutdown initiated");

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

      this.logger.shutdown("Graceful shutdown completed successfully");
    } catch (error) {
      this.logger.shutdownError("Error during graceful shutdown", error as Error);
      throw error;
    } finally {
      clearTimeout(shutdownTimeout);
    }
  }

  private async stopAcceptingNewRequests(): Promise<void> {
    this.logger.shutdown("Stopping acceptance of new requests");

    // Set global shutdown flag that can be checked by guards and interceptors
    process.env.SHIELD_SHUTDOWN_MODE = "true";

    // Emit shutdown event for services to listen to
    if (typeof process.emit === "function") {
      process.emit("shield:shutdown-initiated" as any);
    }
  }

  private async drainExistingRequests(): Promise<void> {
    this.logger.shutdown("Draining existing requests");

    const maxDrainTime = Math.min(this.config.timeout * 0.8, 60000);
    this.logger.shutdown(`Waiting up to ${maxDrainTime}ms for requests to drain`);

    // Simple timeout-based drain without service dependencies
    await new Promise((resolve) => setTimeout(resolve, Math.min(maxDrainTime, 5000)));
    this.logger.shutdown("Request drain completed");
  }

  private async closeCircuitBreakers(): Promise<void> {
    this.logger.shutdown("Circuit breakers shutdown signaled");

    // Emit event for circuit breakers to listen to and gracefully close
    if (typeof process.emit === "function") {
      process.emit("shield:circuit-breakers-shutdown" as any);
    }

    // Wait a short time for circuit breakers to process the shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async flushMetrics(): Promise<void> {
    // Prevent duplicate flush calls
    if (this.metricsFlushCalled) {
      this.logger.shutdownDebug("Metrics flush already called, skipping duplicate");
      return;
    }

    this.metricsFlushCalled = true;
    this.logger.shutdown("Metrics flush signaled");

    // Emit event for metrics service to listen to and flush data
    if (typeof process.emit === "function") {
      process.emit("shield:metrics-flush" as any);
    }

    // Wait a short time for metrics to flush
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  private setupShutdownHandlers(): void {
    if (!this.config.enabled) {
      return;
    }

    const signals = ["SIGTERM", "SIGINT", "SIGUSR2"];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.shutdown(`Received ${signal} signal`);
        await this.onApplicationShutdown(signal);
        process.exit(0);
      });
    });

    process.on("beforeExit", async (code) => {
      this.logger.shutdown(`Process beforeExit with code: ${code}`);
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
    return {
      isShuttingDown: this.isShuttingDown,
      activeRequests: process.env.SHIELD_ACTIVE_REQUESTS
        ? parseInt(process.env.SHIELD_ACTIVE_REQUESTS, 10)
        : 0,
      queueLength: process.env.SHIELD_QUEUE_LENGTH
        ? parseInt(process.env.SHIELD_QUEUE_LENGTH, 10)
        : 0,
    };
  }
}
