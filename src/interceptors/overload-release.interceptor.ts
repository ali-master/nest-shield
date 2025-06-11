import type { NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Injectable, Inject } from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { DI_TOKENS } from "../core/di-tokens";
import type { OverloadService } from "../services";

@Injectable()
export class OverloadReleaseInterceptor implements NestInterceptor {
  constructor(
    @Inject(DI_TOKENS.OVERLOAD_SERVICE) private readonly overloadService: OverloadService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const hasOverloadProtection = request.overloadInfo !== undefined;

    if (!hasOverloadProtection) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.overloadService.release();
      }),
      catchError((error) => {
        this.overloadService.release();
        throw error;
      }),
    );
  }
}
