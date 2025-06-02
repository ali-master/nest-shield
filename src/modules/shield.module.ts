import { Module, DynamicModule, Global, Provider, Type } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { IShieldConfig } from "../interfaces/shield-config.interface";
import { SHIELD_MODULE_OPTIONS, DEFAULT_CONFIG } from "../core/constants";
import { StorageFactory } from "../storage";
import {
  CircuitBreakerService,
  RateLimitService,
  ThrottleService,
  OverloadService,
  MetricsService,
  EnhancedMetricsService,
  GracefulShutdownService,
  DistributedSyncService,
  PriorityManagerService,
  AnomalyDetectionService,
} from "../services";
import { ShieldGuard } from "../guards/shield.guard";
import { CircuitBreakerInterceptor, OverloadReleaseInterceptor } from "../interceptors";
import { AdapterFactory } from "../adapters";
import { AnomalyDetectionModule } from "../anomaly-detection/anomaly-detection.module";

export interface ShieldModuleOptions extends IShieldConfig {}

export interface ShieldModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<ShieldModuleOptions> | ShieldModuleOptions;
  inject?: any[];
  useClass?: Type<ShieldOptionsFactory>;
  useExisting?: Type<ShieldOptionsFactory>;
}

export interface ShieldOptionsFactory {
  createShieldOptions(): Promise<ShieldModuleOptions> | ShieldModuleOptions;
}

@Global()
@Module({})
export class ShieldModule {
  static forRoot(options: ShieldModuleOptions = {}): DynamicModule {
    const mergedOptions = this.mergeWithDefaults(options);

    return {
      module: ShieldModule,
      imports: [AnomalyDetectionModule],
      providers: [
        {
          provide: SHIELD_MODULE_OPTIONS,
          useValue: mergedOptions,
        },
        ...this.createProviders(),
      ],
      exports: [
        SHIELD_MODULE_OPTIONS,
        CircuitBreakerService,
        RateLimitService,
        ThrottleService,
        OverloadService,
        MetricsService,
        EnhancedMetricsService,
        GracefulShutdownService,
        DistributedSyncService,
        PriorityManagerService,
        AnomalyDetectionService,
        AnomalyDetectionModule,
      ],
    };
  }

  static forRootAsync(options: ShieldModuleAsyncOptions): DynamicModule {
    return {
      module: ShieldModule,
      imports: [AnomalyDetectionModule, ...(options.imports || [])],
      providers: [...this.createAsyncProviders(options), ...this.createProviders()],
      exports: [
        SHIELD_MODULE_OPTIONS,
        CircuitBreakerService,
        RateLimitService,
        ThrottleService,
        OverloadService,
        MetricsService,
        EnhancedMetricsService,
        GracefulShutdownService,
        DistributedSyncService,
        PriorityManagerService,
        AnomalyDetectionService,
        AnomalyDetectionModule,
      ],
    };
  }

  private static createProviders(): Provider[] {
    return [
      AdapterFactory,
      MetricsService,
      EnhancedMetricsService,
      CircuitBreakerService,
      RateLimitService,
      ThrottleService,
      OverloadService,
      GracefulShutdownService,
      DistributedSyncService,
      PriorityManagerService,
      AnomalyDetectionService,
      ShieldGuard,
      CircuitBreakerInterceptor,
      OverloadReleaseInterceptor,
      {
        provide: APP_GUARD,
        useClass: ShieldGuard,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: CircuitBreakerInterceptor,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: OverloadReleaseInterceptor,
      },
      {
        provide: "SHIELD_STORAGE",
        useFactory: async (options: IShieldConfig) => {
          return await StorageFactory.createAsync(options.storage || { type: "memory" });
        },
        inject: [SHIELD_MODULE_OPTIONS],
      },
    ];
  }

  private static createAsyncProviders(options: ShieldModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: SHIELD_MODULE_OPTIONS,
          useFactory: async (...args: any[]) => {
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
        provide: SHIELD_MODULE_OPTIONS,
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

  static getStorageProvider(options: IShieldConfig): Provider {
    return {
      provide: "SHIELD_STORAGE",
      useFactory: async () => {
        return await StorageFactory.createAsync(options.storage || { type: "memory" });
      },
    };
  }
}
