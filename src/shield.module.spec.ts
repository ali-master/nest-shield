import { ShieldModule } from "./modules/shield.module";
import { SHIELD_MODULE_OPTIONS } from "./core/constants";

describe("ShieldModule", () => {
  describe("forRoot", () => {
    it("should create a dynamic module with correct configuration", () => {
      const config = {
        global: { enabled: true },
        storage: { type: "memory" as const },
        rateLimit: { enabled: true, points: 10, duration: 60 },
      };

      const module = ShieldModule.forRoot(config);

      expect(module.module).toBe(ShieldModule);
      expect(module.providers).toBeDefined();
      expect(module.exports).toBeDefined();

      // Check that configuration provider is included
      const configProvider = module.providers?.find(
        (provider: any) =>
          typeof provider === "object" && provider.provide === SHIELD_MODULE_OPTIONS,
      );
      expect(configProvider).toBeDefined();
      expect((configProvider as any).useValue).toMatchObject(config);
    });

    it("should include all required providers", () => {
      const module = ShieldModule.forRoot({});

      expect(module.providers).toBeDefined();
      expect(Array.isArray(module.providers)).toBe(true);
      expect(module.providers!.length).toBeGreaterThan(0);
    });

    it("should include all required exports", () => {
      const module = ShieldModule.forRoot({});

      expect(module.exports).toBeDefined();
      expect(Array.isArray(module.exports)).toBe(true);
      expect(module.exports).toContain(SHIELD_MODULE_OPTIONS);
    });
  });

  describe("forRootAsync", () => {
    it("should create a dynamic module with async configuration", () => {
      const asyncOptions = {
        useFactory: () => ({
          global: { enabled: false },
          storage: { type: "memory" as const },
        }),
      };

      const module = ShieldModule.forRootAsync(asyncOptions);

      expect(module.module).toBe(ShieldModule);
      expect(module.providers).toBeDefined();
      expect(module.exports).toBeDefined();
    });

    it("should include imports when provided", () => {
      const asyncOptions = {
        imports: [{ module: class TestModule {} }],
        useFactory: () => ({}),
      };

      const module = ShieldModule.forRootAsync(asyncOptions);

      expect(module.imports).toBeDefined();
      expect(module.imports).toContain(asyncOptions.imports[0]);
    });
  });
});
