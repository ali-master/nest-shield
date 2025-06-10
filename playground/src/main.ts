import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for testing
  app.enableCors();

  // Add global prefix
  app.setGlobalPrefix("api");

  const logger = new Logger("PlaygroundApp");

  await app.listen(3000);

  logger.log("🛡️  NestShield Playground is running on: http://localhost:3000/api");
  logger.log("📊 Available endpoints:");
  logger.log("  - GET  /api/basic - Basic protected endpoint");
  logger.log("  - GET  /api/rate-limit/* - Rate limiting examples");
  logger.log("  - GET  /api/throttle/* - Throttling examples");
  logger.log("  - GET  /api/circuit-breaker/* - Circuit breaker examples");
  logger.log("  - GET  /api/overload/* - Overload protection examples");
  logger.log("  - GET  /api/metrics/* - Metrics collection examples");
  logger.log("  - GET  /api/anomaly-detection/* - Anomaly detection examples");
  logger.log("  - GET  /api/config/* - Configuration examples");
  logger.log("  - GET  /api/combined/* - Combined protection examples");
  logger.log("  - GET  /api/advanced/* - Advanced features");
}

void bootstrap();
