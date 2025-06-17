import type { Type, Provider, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import type { IShieldConfig } from "../interfaces";
import { DEFAULT_CONFIG } from "../core/constants";
import { DI_TOKENS } from "../core/di-tokens";
import { providerFactory, createConfigProvider } from "../core/providers.factory";
import { MetricsModule } from "../metrics";
import { ShieldGuard } from "../guards/shield.guard";
// AnomalyDetectionModule is imported separately in playground

export interface ShieldModuleOptions extends IShieldConfig {}

export interface ShieldModuleAsyncOptions {
  imports?: (Type | DynamicModule)[];
  useFactory?: (...args: unknown[]) => Promise<ShieldModuleOptions> | ShieldModuleOptions;
  inject?: (string | symbol | Type)[];
  useClass?: Type<ShieldOptionsFactory>;
  useExisting?: Type<ShieldOptionsFactory>;
}

export interface ShieldOptionsFactory {
  createShieldOptions: () => Promise<ShieldModuleOptions> | ShieldModuleOptions;
}

@Module({})
export class ShieldModule {
  static forRoot(options: ShieldModuleOptions = {}): DynamicModule {
    console.log("*** SHIELD MODULE forRoot CALLED ***");
    const mergedOptions = this.mergeWithDefaults(options);

    // ShieldModule initialization will be logged by the logger service itself
    console.log("Creating ShieldModule providers...");

    return {
      global: true,
      module: ShieldModule,
      imports: [MetricsModule.forRoot(mergedOptions.metrics || DEFAULT_CONFIG.metrics)],
      providers: [
        createConfigProvider(DI_TOKENS.SHIELD_MODULE_OPTIONS, mergedOptions),
        (() => {
          console.log("Calling providerFactory.createCoreProviders()...");
          const coreProviders = providerFactory.createCoreProviders();
          console.log("Core providers created:", coreProviders.length);
          return coreProviders;
        })(),
        // Explicitly register the guard as a global guard
        {
          provide: APP_GUARD,
          useClass: ShieldGuard,
        },
      ].flat(),
      exports: [
        DI_TOKENS.SHIELD_MODULE_OPTIONS,
        DI_TOKENS.CIRCUIT_BREAKER_SERVICE,
        DI_TOKENS.RATE_LIMIT_SERVICE,
        DI_TOKENS.THROTTLE_SERVICE,
        DI_TOKENS.OVERLOAD_SERVICE,
        DI_TOKENS.METRICS_SERVICE,
        DI_TOKENS.GRACEFUL_SHUTDOWN_SERVICE,
        DI_TOKENS.DISTRIBUTED_SYNC_SERVICE,
        DI_TOKENS.PRIORITY_MANAGER_SERVICE,
        DI_TOKENS.ANOMALY_DETECTION_SERVICE,
      ],
    };
  }

  static forRootAsync(options: ShieldModuleAsyncOptions): DynamicModule {
    return {
      global: true,
      module: ShieldModule,
      imports: [
        MetricsModule.forRootAsync({
          useFactory: async (...args: unknown[]) => {
            const config = options.useFactory ? await options.useFactory(...args) : {};
            return this.mergeWithDefaults(config).metrics || DEFAULT_CONFIG.metrics;
          },
          inject: options.inject || [],
        }),
        ...(options.imports || []),
      ],
      providers: [
        ...this.createAsyncProviders(options),
        ...providerFactory.createCoreProviders(),
        // Explicitly register the guard as a global guard
        {
          provide: APP_GUARD,
          useClass: ShieldGuard,
        },
      ],
      exports: [
        DI_TOKENS.SHIELD_MODULE_OPTIONS,
        DI_TOKENS.CIRCUIT_BREAKER_SERVICE,
        DI_TOKENS.RATE_LIMIT_SERVICE,
        DI_TOKENS.THROTTLE_SERVICE,
        DI_TOKENS.OVERLOAD_SERVICE,
        DI_TOKENS.METRICS_SERVICE,
        DI_TOKENS.GRACEFUL_SHUTDOWN_SERVICE,
        DI_TOKENS.DISTRIBUTED_SYNC_SERVICE,
        DI_TOKENS.PRIORITY_MANAGER_SERVICE,
        DI_TOKENS.ANOMALY_DETECTION_SERVICE,
      ],
    };
  }

  private static createAsyncProviders(options: ShieldModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: DI_TOKENS.SHIELD_MODULE_OPTIONS,
          useFactory: async (...args: unknown[]) => {
            const config = await options.useFactory!(...args);
            return this.mergeWithDefaults(config);
          },
          inject: options.inject || [],
        },
      ];
    }

    const useClass = options.useClass || options.useExisting;
    if (!useClass) {
      throw new Error("Invalid ShieldModule async options");
    }

    return [
      {
        provide: DI_TOKENS.SHIELD_MODULE_OPTIONS,
        useFactory: async (optionsFactory: ShieldOptionsFactory) => {
          const config = await optionsFactory.createShieldOptions();
          return this.mergeWithDefaults(config);
        },
        inject: [useClass],
      },
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static mergeWithDefaults(options: ShieldModuleOptions): IShieldConfig {
    return {
      global: { ...DEFAULT_CONFIG.global, ...options.global },
      storage: { ...DEFAULT_CONFIG.storage, ...options.storage },
      circuitBreaker: { ...DEFAULT_CONFIG.circuitBreaker, ...options.circuitBreaker },
      rateLimit: { ...DEFAULT_CONFIG.rateLimit, ...options.rateLimit },
      throttle: { ...DEFAULT_CONFIG.throttle, ...options.throttle },
      overload: { ...DEFAULT_CONFIG.overload, ...options.overload },
      metrics: { ...DEFAULT_CONFIG.metrics, ...options.metrics },
      adapters: { ...DEFAULT_CONFIG.adapters, ...options.adapters },
      advanced: { ...DEFAULT_CONFIG.advanced, ...options.advanced },
    };
  }

  /**
   * Creates a storage provider for external use
   * @deprecated Use providerFactory.createStorageProvider() instead
   */
  static getStorageProvider(_options: IShieldConfig): Provider {
    return providerFactory.createStorageProvider();
  }
}
