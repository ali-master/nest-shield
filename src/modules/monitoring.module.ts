import { Module, DynamicModule } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { MonitoringService } from "../services/monitoring.service";
import { ConfigurationService } from "../services/configuration.service";
import { MonitoringGateway } from "../gateways/monitoring.gateway";
import { MonitoringController } from "../controllers/monitoring.controller";
import { ConfigurationController } from "../controllers/configuration.controller";
import { MetricsService } from "../services/metrics.service";
import { ShieldLoggerService } from "../services/shield-logger.service";
import { StorageFactory } from "../storage/storage.factory";
import { STORAGE_ADAPTER } from "../core/di-tokens";

@Module({})
export class MonitoringModule {
  static forRoot(): DynamicModule {
    return {
      module: MonitoringModule,
      imports: [EventEmitterModule.forRoot(), ScheduleModule.forRoot()],
      controllers: [MonitoringController, ConfigurationController],
      providers: [
        MonitoringService,
        ConfigurationService,
        MonitoringGateway,
        MetricsService,
        ShieldLoggerService,
        {
          provide: STORAGE_ADAPTER,
          useFactory: () => {
            return StorageFactory.create({
              type: "memory",
              options: { maxSize: 10000, ttl: 3600000 },
            });
          },
        },
      ],
      exports: [MonitoringService, ConfigurationService, MonitoringGateway],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory?: (...args: any[]) => any;
    inject?: any[];
  }): DynamicModule {
    return {
      module: MonitoringModule,
      imports: [EventEmitterModule.forRoot(), ScheduleModule.forRoot(), ...(options.imports || [])],
      controllers: [MonitoringController, ConfigurationController],
      providers: [
        MonitoringService,
        ConfigurationService,
        MonitoringGateway,
        MetricsService,
        ShieldLoggerService,
        {
          provide: STORAGE_ADAPTER,
          useFactory: () => {
            return StorageFactory.create({
              type: "memory",
              options: { maxSize: 10000, ttl: 3600000 },
            });
          },
        },
        ...(options.useFactory
          ? [
              {
                provide: "MONITORING_CONFIG",
                useFactory: options.useFactory,
                inject: options.inject || [],
              },
            ]
          : []),
      ],
      exports: [MonitoringService, ConfigurationService, MonitoringGateway],
    };
  }
}
