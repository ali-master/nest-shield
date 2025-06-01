import { SetMetadata, applyDecorators } from "@nestjs/common";
import { SHIELD_DECORATORS } from "../core/constants";
import {
  ICircuitBreakerConfig,
  IRateLimitConfig,
  IThrottleConfig,
  IOverloadConfig,
  IShieldMetadata,
} from "../interfaces/shield-config.interface";

export const CircuitBreaker = (config?: Partial<ICircuitBreakerConfig>) =>
  SetMetadata(SHIELD_DECORATORS.CIRCUIT_BREAKER, config || {});

export const RateLimit = (config?: Partial<IRateLimitConfig>) =>
  SetMetadata(SHIELD_DECORATORS.RATE_LIMIT, config || {});

export const Throttle = (config?: Partial<IThrottleConfig>) =>
  SetMetadata(SHIELD_DECORATORS.THROTTLE, config || {});

export const Overload = (config?: Partial<IOverloadConfig>) =>
  SetMetadata(SHIELD_DECORATORS.OVERLOAD, config || {});

export const Priority = (priority: number) => SetMetadata(SHIELD_DECORATORS.PRIORITY, priority);

export const BypassShield = () => SetMetadata(SHIELD_DECORATORS.BYPASS, true);

export interface ShieldOptions {
  circuitBreaker?: Partial<ICircuitBreakerConfig>;
  rateLimit?: Partial<IRateLimitConfig>;
  throttle?: Partial<IThrottleConfig>;
  overload?: Partial<IOverloadConfig>;
  priority?: number;
  bypass?: boolean;
}

export const Shield = (options: ShieldOptions = {}) => {
  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [];

  if (options.circuitBreaker) {
    decorators.push(CircuitBreaker(options.circuitBreaker));
  }

  if (options.rateLimit) {
    decorators.push(RateLimit(options.rateLimit));
  }

  if (options.throttle) {
    decorators.push(Throttle(options.throttle));
  }

  if (options.overload) {
    decorators.push(Overload(options.overload));
  }

  if (options.priority !== undefined) {
    decorators.push(Priority(options.priority));
  }

  if (options.bypass) {
    decorators.push(BypassShield());
  }

  decorators.push(SetMetadata(SHIELD_DECORATORS.SHIELD, options));

  return applyDecorators(...decorators);
};

export interface QuickShieldOptions {
  points?: number;
  duration?: number;
  blockDuration?: number;
}

export const QuickRateLimit = (
  points: number = 100,
  duration: number = 60,
  blockDuration?: number,
) =>
  RateLimit({
    enabled: true,
    points,
    duration,
    blockDuration,
  });

export const QuickThrottle = (limit: number = 100, ttl: number = 60) =>
  Throttle({
    enabled: true,
    limit,
    ttl,
  });

export const QuickCircuitBreaker = (
  timeout: number = 3000,
  errorThresholdPercentage: number = 50,
) =>
  CircuitBreaker({
    enabled: true,
    timeout,
    errorThresholdPercentage,
  });

export const ProtectEndpoint = (
  options: {
    rateLimit?: { points: number; duration: number };
    throttle?: { limit: number; ttl: number };
    circuitBreaker?: { timeout: number; errorThreshold: number };
    overload?: boolean;
    priority?: number;
  } = {},
) => {
  const shieldOptions: ShieldOptions = {};

  if (options.rateLimit) {
    shieldOptions.rateLimit = {
      enabled: true,
      points: options.rateLimit.points,
      duration: options.rateLimit.duration,
    };
  }

  if (options.throttle) {
    shieldOptions.throttle = {
      enabled: true,
      limit: options.throttle.limit,
      ttl: options.throttle.ttl,
    };
  }

  if (options.circuitBreaker) {
    shieldOptions.circuitBreaker = {
      enabled: true,
      timeout: options.circuitBreaker.timeout,
      errorThresholdPercentage: options.circuitBreaker.errorThreshold,
    };
  }

  if (options.overload) {
    shieldOptions.overload = {
      enabled: true,
    };
  }

  if (options.priority !== undefined) {
    shieldOptions.priority = options.priority;
  }

  return Shield(shieldOptions);
};
