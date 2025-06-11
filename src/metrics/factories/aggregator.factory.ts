import { OnModuleInit, Injectable } from "@nestjs/common";
import type {
  TimeWindowAggregatorConstructor,
  RollingWindowAggregatorConstructor,
  PercentileAggregatorConstructor,
  ITimeWindowAggregator,
  IRollingWindowAggregator,
  IPercentileAggregator,
  IAggregatorFactory,
} from "../types";

@Injectable()
export class AggregatorFactoryService implements IAggregatorFactory, OnModuleInit {
  private timeWindowAggregatorClass: TimeWindowAggregatorConstructor | null = null;
  private rollingWindowAggregatorClass: RollingWindowAggregatorConstructor | null = null;
  private percentileAggregatorClass: PercentileAggregatorConstructor | null = null;
  private initialized = false;

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const aggregators = await import("../aggregators");
      // Use unknown first to safely cast
      this.timeWindowAggregatorClass =
        aggregators.TimeWindowAggregator as unknown as TimeWindowAggregatorConstructor;
      this.rollingWindowAggregatorClass =
        aggregators.RollingWindowAggregator as unknown as RollingWindowAggregatorConstructor;
      this.percentileAggregatorClass =
        aggregators.PercentileAggregator as unknown as PercentileAggregatorConstructor;
      this.initialized = true;
    } catch {
      // Enhanced aggregators not available, factory will return null
      this.initialized = true; // Mark as initialized even if components aren't available
    }
  }

  createTimeWindowAggregator(windowSize: number, maxWindows: number): ITimeWindowAggregator | null {
    if (!this.timeWindowAggregatorClass) {
      return null;
    }
    try {
      return new this.timeWindowAggregatorClass(windowSize, maxWindows);
    } catch {
      return null;
    }
  }

  createRollingWindowAggregator(windowSize: number): IRollingWindowAggregator | null {
    if (!this.rollingWindowAggregatorClass) {
      return null;
    }
    try {
      return new this.rollingWindowAggregatorClass(windowSize);
    } catch {
      return null;
    }
  }

  createPercentileAggregator(): IPercentileAggregator | null {
    if (!this.percentileAggregatorClass) {
      return null;
    }
    try {
      return new this.percentileAggregatorClass();
    } catch {
      return null;
    }
  }

  isAvailable(): boolean {
    return (
      this.initialized &&
      !!(
        this.timeWindowAggregatorClass &&
        this.rollingWindowAggregatorClass &&
        this.percentileAggregatorClass
      )
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
