import { Module } from "@nestjs/common";
// import { ShieldModule } from "nest-shield"; // Temporarily disabled to test startup
// import { DI_TOKENS } from "nest-shield/core";

// Controllers - only basic ones for testing
import { BasicController } from "./controllers/basic.controller";

@Module({
  imports: [
    // ShieldModule temporarily disabled to test basic startup
  ],
  controllers: [
    BasicController,
    // All other controllers temporarily disabled
  ],
  providers: [
    // Basic provider for testing
    {
      provide: "PLAYGROUND_CONFIG",
      useValue: {
        name: "NestShield Playground",
        version: "1.0.0",
        features: {
          basicTest: true,
        },
      },
    },
  ],
})
export class AppModule {}
