import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ShieldModule } from "./modules/shield.module";
import {
  ThrottleService,
  RateLimitService,
  OverloadService,
  CircuitBreakerService,
} from "./services";
import { SHIELD_MODULE_OPTIONS } from "./core/constants";

describe("ShieldModule", () => {
  let module: TestingModule;

  describe("forRoot", () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          ShieldModule.forRoot({
            global: { enabled: true },
            storage: { type: "memory" },
            rateLimit: { enabled: true, points: 10, duration: 60 },
          }),
        ],
      }).compile();
    });

    afterEach(async () => {
      await module.close();
    });

    it("should be defined", () => {
      expect(module).toBeDefined();
    });

    it("should provide shield options", () => {
      const options = module.get(SHIELD_MODULE_OPTIONS);
      expect(options).toBeDefined();
      expect(options.global.enabled).toBe(true);
      expect(options.storage.type).toBe("memory");
    });

    it("should provide all services", () => {
      expect(module.get(CircuitBreakerService)).toBeDefined();
      expect(module.get(RateLimitService)).toBeDefined();
      expect(module.get(ThrottleService)).toBeDefined();
      expect(module.get(OverloadService)).toBeDefined();
    });
  });

  describe("forRootAsync", () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          ShieldModule.forRootAsync({
            useFactory: () => ({
              global: { enabled: false },
              storage: { type: "memory" },
            }),
          }),
        ],
      }).compile();
    });

    afterEach(async () => {
      await module.close();
    });

    it("should work with async configuration", () => {
      const options = module.get(SHIELD_MODULE_OPTIONS);
      expect(options.global.enabled).toBe(false);
    });
  });
});
