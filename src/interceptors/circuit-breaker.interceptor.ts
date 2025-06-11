import type { NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { throwError, Observable, firstValueFrom } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import type { Reflector } from "@nestjs/core";
import { SHIELD_DECORATORS } from "../core/constants";
import {
  InjectShieldConfig,
  InjectReflector,
  InjectCircuitBreaker,
} from "../core/injection.decorators";
import type { IShieldConfig, ICircuitBreakerConfig } from "../interfaces/shield-config.interface";
import type { CircuitBreakerService } from "../services";

@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  constructor(
    @InjectShieldConfig() private readonly options: IShieldConfig,
    @InjectReflector() private readonly reflector: Reflector,
    @InjectCircuitBreaker() private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const config = this.getConfig(context);

    if (!config?.enabled) {
      return next.handle();
    }

    const handler = context.getHandler();
    const classRef = context.getClass();
    const key = `${classRef.name}.${handler.name}`;
    const request = context.switchToHttp().getRequest();
    const protectionContext = request.shieldContext;

    const breaker = this.circuitBreakerService.createBreaker(
      key,
      () => firstValueFrom(next.handle()),
      config,
    );

    return new Observable((subscriber) => {
      breaker
        .fire(protectionContext)
        .then((result) => {
          if (result instanceof Observable) {
            result.subscribe({
              next: (value) => subscriber.next(value),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
          } else {
            subscriber.next(result);
            subscriber.complete();
          }
        })
        .catch((error) => {
          request.circuitBreakerInfo = {
            state: this.circuitBreakerService.getState(key),
            stats: this.circuitBreakerService.getStats(key),
          };
          subscriber.error(error);
        });
    }).pipe(
      tap(() => {
        request.circuitBreakerInfo = {
          state: this.circuitBreakerService.getState(key),
          stats: this.circuitBreakerService.getStats(key),
        };
      }),
      catchError((error) => {
        request.circuitBreakerInfo = {
          state: this.circuitBreakerService.getState(key),
          stats: this.circuitBreakerService.getStats(key),
          error: error.message,
        };
        return throwError(() => error);
      }),
    );
  }

  private getConfig(context: ExecutionContext): ICircuitBreakerConfig | undefined {
    const handler = context.getHandler();
    const classRef = context.getClass();

    const handlerConfig = this.reflector.get<Partial<ICircuitBreakerConfig>>(
      SHIELD_DECORATORS.CIRCUIT_BREAKER,
      handler,
    );
    const classConfig = this.reflector.get<Partial<ICircuitBreakerConfig>>(
      SHIELD_DECORATORS.CIRCUIT_BREAKER,
      classRef,
    );
    const globalConfig = this.options.circuitBreaker;

    const merged: any = { ...globalConfig, ...classConfig, ...handlerConfig };
    // Ensure enabled is always a boolean
    if (merged.enabled === undefined) {
      merged.enabled = false;
    }
    return merged as ICircuitBreakerConfig;
  }
}
