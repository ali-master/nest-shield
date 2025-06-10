import type { Type, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { IMetricsConfig } from "../interfaces";
import { DI_TOKENS } from "../core/di-tokens";
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
        // Export Symbol tokens only
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
    const asyncConfigProvider = {
      provide: "ASYNC_METRICS_CONFIG",
      useFactory: options.useFactory!,
      inject: options.inject || [],
    };

    return {
      module: MetricsModule,
      imports: options.imports || [],
      providers: [
        asyncConfigProvider,
        // Create providers dynamically based on async config
        {
          provide: DI_TOKENS.METRICS_CONFIG,
          useFactory: (config: IMetricsConfig) => config,
          inject: ["ASYNC_METRICS_CONFIG"],
        },
        // Service providers
        ...metricsProviderFactory.createServiceProviders(),
        // Aggregator providers
        ...metricsProviderFactory.createAggregatorProviders(),
        // Collector and exporter will be created by the service itself
      ],
      exports: [...METRICS_EXPORTS],
      global: true,
    };
  }
}
