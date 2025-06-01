import { Injectable, CanActivate, ExecutionContext, Inject } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { SHIELD_MODULE_OPTIONS, SHIELD_DECORATORS, HEADER_NAMES } from "../core/constants";
import {
  IShieldConfig,
  IProtectionContext,
  IHttpAdapter,
} from "../interfaces/shield-config.interface";
import {
  CircuitBreakerService,
  RateLimitService,
  ThrottleService,
  OverloadService,
  MetricsService,
} from "../services";
import { AdapterFactory } from "../adapters";

@Injectable()
export class ShieldGuard implements CanActivate {
  private httpAdapter: IHttpAdapter;

  constructor(
    @Inject(SHIELD_MODULE_OPTIONS) private readonly options: IShieldConfig,
    private readonly reflector: Reflector,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly rateLimitService: RateLimitService,
    private readonly throttleService: ThrottleService,
    private readonly overloadService: OverloadService,
    private readonly metricsService: MetricsService,
    private readonly adapterFactory: AdapterFactory,
  ) {
    this.httpAdapter = this.adapterFactory.create(this.options.adapters || { type: "auto" });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options.global?.enabled) {
      return true;
    }

    const isBypassed =
      this.reflector.get<boolean>(SHIELD_DECORATORS.BYPASS, context.getHandler()) ||
      this.reflector.get<boolean>(SHIELD_DECORATORS.BYPASS, context.getClass());

    if (isBypassed) {
      return true;
    }

    const protectionContext = this.createProtectionContext(context);
    const request = this.httpAdapter.getRequest(context);
    const response = this.httpAdapter.getResponse(context);

    request.shieldContext = protectionContext;

    if (this.shouldExclude(protectionContext)) {
      return true;
    }

    const timer = this.metricsService.startTimer("shield_request_duration", {
      path: protectionContext.path,
      method: protectionContext.method,
    });

    try {
      await this.applyOverloadProtection(context, protectionContext);
      await this.applyThrottleProtection(context, protectionContext, response);
      await this.applyRateLimitProtection(context, protectionContext, response);

      timer();
      return true;
    } catch (error) {
      timer();
      this.overloadService.release();
      throw error;
    }
  }

  private createProtectionContext(context: ExecutionContext): IProtectionContext {
    const request = this.httpAdapter.getRequest(context);
    const handler = context.getHandler();
    const classRef = context.getClass();

    const priority =
      this.reflector.get<number>(SHIELD_DECORATORS.PRIORITY, handler) ||
      this.reflector.get<number>(SHIELD_DECORATORS.PRIORITY, classRef);

    return {
      request,
      response: this.httpAdapter.getResponse(context),
      handler: handler.name,
      class: classRef.name,
      ip: this.httpAdapter.getIp(request),
      userAgent: this.httpAdapter.getUserAgent(request),
      path: this.httpAdapter.getPath(request),
      method: this.httpAdapter.getMethod(request),
      headers: this.httpAdapter.getHeaders(request),
      metadata: { priority },
      timestamp: Date.now(),
    };
  }

  private shouldExclude(context: IProtectionContext): boolean {
    const { excludePaths, includePaths, bypassTokens } = this.options.global || {};

    if (bypassTokens && bypassTokens.length > 0) {
      const authHeader = context.headers.authorization;
      if (authHeader && bypassTokens.includes(authHeader.replace("Bearer ", ""))) {
        return true;
      }
    }

    if (includePaths && includePaths.length > 0) {
      return !this.matchPath(context.path, includePaths);
    }

    if (excludePaths && excludePaths.length > 0) {
      return this.matchPath(context.path, excludePaths);
    }

    return false;
  }

  private matchPath(path: string, patterns: Array<string | RegExp>): boolean {
    return patterns.some((pattern) => {
      if (typeof pattern === "string") {
        return path.startsWith(pattern);
      }
      return pattern.test(path);
    });
  }

  private async applyOverloadProtection(
    context: ExecutionContext,
    protectionContext: IProtectionContext,
  ): Promise<void> {
    const config = this.getConfig(context, SHIELD_DECORATORS.OVERLOAD, "overload");

    if (!config?.enabled) {
      return;
    }

    const result = await this.overloadService.acquire(protectionContext, config);
    const request = this.httpAdapter.getRequest(context);
    request.overloadInfo = result.metadata;
  }

  private async applyThrottleProtection(
    context: ExecutionContext,
    protectionContext: IProtectionContext,
    response: any,
  ): Promise<void> {
    const config = this.getConfig(context, SHIELD_DECORATORS.THROTTLE, "throttle");

    if (!config?.enabled) {
      return;
    }

    const result = await this.throttleService.consume(protectionContext, config);

    if (result.metadata?.headers) {
      this.httpAdapter.setHeaders(response, result.metadata.headers);
    }

    const request = this.httpAdapter.getRequest(context);
    request.throttleInfo = result.metadata;
  }

  private async applyRateLimitProtection(
    context: ExecutionContext,
    protectionContext: IProtectionContext,
    response: any,
  ): Promise<void> {
    const config = this.getConfig(context, SHIELD_DECORATORS.RATE_LIMIT, "rateLimit");

    if (!config?.enabled) {
      return;
    }

    const result = await this.rateLimitService.consume(protectionContext, config);

    if (result.metadata?.headers) {
      this.httpAdapter.setHeaders(response, result.metadata.headers);
    }

    const request = this.httpAdapter.getRequest(context);
    request.rateLimitInfo = result.metadata;
  }

  private getConfig(context: ExecutionContext, metadataKey: string, configKey: string): any {
    const handler = context.getHandler();
    const classRef = context.getClass();

    const handlerConfig = this.reflector.get(metadataKey, handler);
    const classConfig = this.reflector.get(metadataKey, classRef);
    const globalConfig = this.options[configKey];

    return { ...globalConfig, ...classConfig, ...handlerConfig };
  }
}
