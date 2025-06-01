import { Module } from "@nestjs/common";
import { ShieldModule } from "@usex/nest-shield";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ShieldModule.forRoot({
      global: {
        enabled: true,
        logging: {
          enabled: true,
          level: "info",
        },
      },
      storage: {
        type: "memory",
      },
      rateLimit: {
        enabled: true,
        points: 100,
        duration: 60, // 60 seconds
        blockDuration: 60,
      },
      throttle: {
        enabled: true,
        ttl: 60,
        limit: 10,
      },
      circuitBreaker: {
        enabled: true,
        timeout: 3000,
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
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
