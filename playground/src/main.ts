import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for testing
  app.enableCors();
  app.enableShutdownHooks();

  // Add global prefix
  app.setGlobalPrefix("api");

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("NestShield Playground API")
    .setDescription(
      `
## About NestShield
NestShield is a comprehensive protection library for NestJS applications that provides:
- **Circuit Breaker** - Prevents cascade failures by stopping calls to failing services
- **Rate Limiting** - Controls request rate per time window
- **Throttling** - Limits request frequency with burst capacity
- **Overload Protection** - Manages system capacity and request queuing
- **Metrics Collection** - Collects and exports performance metrics
- **Anomaly Detection** - AI-powered anomaly detection with multiple detector types

## Usage
Each endpoint demonstrates different protection mechanisms. Try sending multiple rapid requests
to see the protection features in action. Monitor the responses to understand how each
protection type behaves under different load conditions.

## Rate Limiting vs Throttling
- **Rate Limiting**: Fixed window approach (e.g., 100 requests per minute)
- **Throttling**: Token bucket approach with burst capacity and refill rate

## Circuit Breaker States
- **Closed**: Normal operation, requests pass through
- **Open**: Failing fast, requests are immediately rejected
- **Half-Open**: Testing if service has recovered

## Metrics
All endpoints collect metrics that can be viewed at /api/metrics endpoints.
`,
    )
    .setVersion("1.0")
    .addServer("http://localhost:3000", "Development server")
    .build();

  // @ts-ignore
  const document = SwaggerModule.createDocument(app, config);
  // @ts-ignore
  SwaggerModule.setup("docs", app, document, {
    customSiteTitle: "NestShield Playground API",
    customfavIcon: "/favicon.ico",
    explorer: false,
    jsonDocumentUrl: `api/docs/openapi.json`,
    yamlDocumentUrl: `api/docs/openapi.yaml`,
    swaggerOptions: {
      filter: true,
      tryItOutEnabled: true,
      displayOperationId: true,
      persistAuthorization: true,
      deepLinking: true,
      showExtensions: true,
      showCommonExtensions: true,
      apisSorter: false,
      tagsSorter: false,
      operationsSorter: false,
      requestSnippetsEnabled: true,
      requestSnippets: {
        generators: {
          curl_bash: {
            title: "cURL (bash)",
            syntax: "bash",
          },
        },
        defaultExpanded: false,
        languages: null,
      },
      withCredentials: true,
    },
  });

  const logger = new Logger("PlaygroundApp");

  await app.listen(3000);

  logger.log("🛡️  NestShield Playground is running on: http://localhost:3000/api");
  logger.log("📚 Swagger Documentation: http://localhost:3000/docs");
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
