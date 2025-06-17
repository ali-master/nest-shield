import { Module, Logger, DynamicModule } from "@nestjs/common";

/**
 * Optional Monitoring Module that loads monitoring features on demand
 * Only requires monitoring dependencies when explicitly imported
 */
@Module({})
export class OptionalMonitoringModule {
  private static readonly logger = new Logger("OptionalMonitoringModule");

  /**
   * Synchronous module registration with feature detection
   */
  static forRoot(
    options: {
      enableWebSocket?: boolean;
      enableScheduler?: boolean;
      enableSwagger?: boolean;
    } = {},
  ): DynamicModule {
    const { enableWebSocket = true, enableScheduler = true, enableSwagger = true } = options;

    return {
      module: OptionalMonitoringModule,
      imports: this.getConditionalImports({ enableWebSocket, enableScheduler }),
      controllers: this.getConditionalControllers({ enableSwagger }),
      providers: this.getConditionalProviders({ enableWebSocket, enableScheduler }),
      exports: this.getConditionalExports(),
    };
  }

  /**
   * Asynchronous module registration with dynamic loading
   */
  static forRootAsync(
    options: {
      imports?: any[];
      useFactory?: (...args: any[]) => any | Promise<any>;
      inject?: any[];
      enableWebSocket?: boolean;
      enableScheduler?: boolean;
      enableSwagger?: boolean;
    } = {},
  ): DynamicModule {
    const {
      imports: userImports = [],
      useFactory,
      inject = [],
      enableWebSocket = true,
      enableScheduler = true,
      enableSwagger = true,
    } = options;

    return {
      module: OptionalMonitoringModule,
      imports: [
        ...this.getConditionalImports({ enableWebSocket, enableScheduler }),
        ...userImports,
      ],
      controllers: this.getConditionalControllers({ enableSwagger }),
      providers: [
        ...this.getConditionalProviders({ enableWebSocket, enableScheduler }),
        ...(useFactory
          ? [
              {
                provide: "MONITORING_CONFIG",
                useFactory,
                inject,
              },
            ]
          : []),
      ],
      exports: this.getConditionalExports(),
    };
  }

  /**
   * Load monitoring module lazily when needed
   */
  static async loadLazy(
    options: {
      enableWebSocket?: boolean;
      enableScheduler?: boolean;
      enableSwagger?: boolean;
    } = {},
  ): Promise<DynamicModule> {
    this.logger.log("Loading monitoring module lazily...");

    // Check for optional dependencies
    const capabilities = await this.detectCapabilities();

    const finalOptions = {
      enableWebSocket: options.enableWebSocket && capabilities.hasWebSocket,
      enableScheduler: options.enableScheduler && capabilities.hasScheduler,
      enableSwagger: options.enableSwagger && capabilities.hasSwagger,
    };

    this.logger.log(`Monitoring capabilities detected: ${JSON.stringify(capabilities)}`);
    this.logger.log(`Enabling features: ${JSON.stringify(finalOptions)}`);

    return this.forRoot(finalOptions);
  }

  private static getConditionalImports(options: {
    enableWebSocket: boolean;
    enableScheduler: boolean;
  }): any[] {
    const imports: any[] = [];

    if (options.enableScheduler) {
      try {
        // Use dynamic imports instead of require
        Promise.resolve()
          .then(() => import("@nestjs/event-emitter"))
          .then(({ EventEmitterModule }) => {
            Promise.resolve()
              .then(() => import("@nestjs/schedule"))
              .then(({ ScheduleModule }) => {
                imports.push(EventEmitterModule.forRoot(), ScheduleModule.forRoot());
              });
          });
      } catch {
        this.logger.warn("Scheduler dependencies not available, disabling scheduling features");
      }
    }

    return imports;
  }

  private static getConditionalControllers(_options: { enableSwagger: boolean }): any[] {
    const controllers: any[] = [];

    try {
      // Use dynamic imports
      Promise.resolve()
        .then(() => import("../controllers/monitoring.controller"))
        .then(({ MonitoringController }) => {
          Promise.resolve()
            .then(() => import("../controllers/configuration.controller"))
            .then(({ ConfigurationController }) => {
              controllers.push(MonitoringController, ConfigurationController);
            });
        });
    } catch {
      this.logger.warn("Controller dependencies not available, controllers will not be registered");
    }

    return controllers;
  }

  private static getConditionalProviders(options: {
    enableWebSocket: boolean;
    enableScheduler: boolean;
  }): any[] {
    const providers: any[] = [];

    // Always try to include core monitoring services
    try {
      // Use dynamic imports
      Promise.resolve()
        .then(() => import("../services/monitoring.service"))
        .then(({ MonitoringService }) => {
          Promise.resolve()
            .then(() => import("../services/configuration.service"))
            .then(({ ConfigurationService }) => {
              Promise.resolve()
                .then(() => import("../services/metrics.service"))
                .then(({ MetricsService }) => {
                  Promise.resolve()
                    .then(() => import("../services/shield-logger.service"))
                    .then(({ ShieldLoggerService }) => {
                      providers.push(
                        MonitoringService,
                        ConfigurationService,
                        MetricsService,
                        ShieldLoggerService,
                      );
                    });
                });
            });
        });
    } catch {
      this.logger.warn("Core monitoring service dependencies not available");
    }

    // Add WebSocket gateway if enabled and available
    if (options.enableWebSocket) {
      try {
        Promise.resolve()
          .then(() => import("../gateways/monitoring.gateway"))
          .then(({ MonitoringGateway }) => {
            providers.push(MonitoringGateway);
          });
      } catch {
        this.logger.warn("WebSocket dependencies not available, real-time features disabled");
      }
    }

    return providers;
  }

  private static getConditionalExports(): any[] {
    const exports: any[] = [];

    try {
      Promise.resolve()
        .then(() => import("../services/monitoring.service"))
        .then(({ MonitoringService }) => {
          Promise.resolve()
            .then(() => import("../services/configuration.service"))
            .then(({ ConfigurationService }) => {
              exports.push(MonitoringService, ConfigurationService);
            });
        });
    } catch {
      this.logger.warn("Core monitoring services not available for export");
    }

    try {
      Promise.resolve()
        .then(() => import("../gateways/monitoring.gateway"))
        .then(({ MonitoringGateway }) => {
          exports.push(MonitoringGateway);
        });
    } catch {
      // WebSocket gateway is optional
    }

    return exports;
  }

  /**
   * Detect available optional dependencies
   */
  private static async detectCapabilities(): Promise<{
    hasWebSocket: boolean;
    hasScheduler: boolean;
    hasSwagger: boolean;
  }> {
    const capabilities = {
      hasWebSocket: false,
      hasScheduler: false,
      hasSwagger: false,
    };

    // Check for WebSocket dependencies
    try {
      await import("@nestjs/websockets");
      await import("socket.io");
      capabilities.hasWebSocket = true;
    } catch {
      // WebSocket not available
    }

    // Check for Scheduler dependencies
    try {
      await import("@nestjs/event-emitter");
      await import("@nestjs/schedule");
      capabilities.hasScheduler = true;
    } catch {
      // Scheduler not available
    }

    // Check for Swagger dependencies
    try {
      await import("@nestjs/swagger");
      capabilities.hasSwagger = true;
    } catch {
      // Swagger not available
    }

    return capabilities;
  }

  /**
   * Get information about available monitoring features
   */
  static async getFeatureInfo(): Promise<{
    available: string[];
    missing: string[];
    recommendations: string[];
  }> {
    const capabilities = await this.detectCapabilities();
    const available: string[] = [];
    const missing: string[] = [];
    const recommendations: string[] = [];

    if (capabilities.hasWebSocket) {
      available.push("Real-time WebSocket communication");
    } else {
      missing.push("WebSocket support");
      recommendations.push("Install @nestjs/websockets and socket.io for real-time features");
    }

    if (capabilities.hasScheduler) {
      available.push("Scheduled monitoring tasks");
    } else {
      missing.push("Scheduler support");
      recommendations.push(
        "Install @nestjs/event-emitter and @nestjs/schedule for automated monitoring",
      );
    }

    if (capabilities.hasSwagger) {
      available.push("API documentation");
    } else {
      missing.push("API documentation");
      recommendations.push("Install @nestjs/swagger for automatic API documentation");
    }

    return { available, missing, recommendations };
  }
}
