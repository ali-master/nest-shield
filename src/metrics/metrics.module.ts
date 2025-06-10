import type { Type, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { IMetricsConfig } from "../interfaces";
import { metricsProviderFactory, METRICS_EXPORTS } from "./providers.factory";

/**
 * Metrics Module with enterprise-grade DI patterns
 *
 * This module provides comprehensive metrics collection, aggregation, and export
 * capabilities using Symbol-based dependency injection tokens for type safety
 * and maintainability.
 */
@Module({})
export class MetricsModule {
  /**
   * Configure the metrics module with the provided configuration
   *
   * @param config - Metrics configuration object
   * @returns Dynamic module with all necessary providers
   */
  static forRoot(config: IMetricsConfig): DynamicModule {
    return {
      module: MetricsModule,
      providers: [
        // All providers created through factory for consistency
        ...metricsProviderFactory.createAllProviders(config),
      ],
      exports: [
        // Export both Symbol tokens and legacy string tokens
        ...METRICS_EXPORTS,
      ],
      global: true,
    };
  }

  /**
   * Configure the metrics module asynchronously
   *
   * @param options - Async configuration options
   * @param options.imports - Modules to import
   * @param options.useFactory - Factory function to create configuration
   * @param options.inject - Dependencies to inject into the factory
   * @returns Dynamic module with all necessary providers
   */
  static forRootAsync(options: {
    imports?: (Type | DynamicModule)[];
    useFactory?: (...args: unknown[]) => Promise<IMetricsConfig> | IMetricsConfig;
    inject?: (string | symbol | Type)[];
  }): DynamicModule {
    return {
      module: MetricsModule,
      imports: options.imports || [],
      providers: [
        // Config provider
        {
          provide: "ASYNC_METRICS_CONFIG",
          useFactory: options.useFactory!,
          inject: options.inject || [],
        },
        // Create providers using the async config
        {
          provide: "METRICS_PROVIDERS",
          useFactory: (config: IMetricsConfig) => {
            return metricsProviderFactory.createAllProviders(config);
          },
          inject: ["ASYNC_METRICS_CONFIG"],
        },
      ],
      exports: [...METRICS_EXPORTS],
      global: true,
    };
  }
}
