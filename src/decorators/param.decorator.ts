import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { IProtectionContext } from "../interfaces/shield-config.interface";

export const ShieldContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IProtectionContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.shieldContext || null;
  },
);

export const ShieldMetrics = createParamDecorator((data: unknown, ctx: ExecutionContext): any => {
  const request = ctx.switchToHttp().getRequest();
  return request.shieldMetrics || null;
});

export const RateLimitInfo = createParamDecorator((data: unknown, ctx: ExecutionContext): any => {
  const request = ctx.switchToHttp().getRequest();
  return request.rateLimitInfo || null;
});

export const ThrottleInfo = createParamDecorator((data: unknown, ctx: ExecutionContext): any => {
  const request = ctx.switchToHttp().getRequest();
  return request.throttleInfo || null;
});

export const CircuitBreakerInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    return request.circuitBreakerInfo || null;
  },
);

export const OverloadInfo = createParamDecorator((data: unknown, ctx: ExecutionContext): any => {
  const request = ctx.switchToHttp().getRequest();
  return request.overloadInfo || null;
});
