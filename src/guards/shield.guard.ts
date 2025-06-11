import type { ExecutionContext, CanActivate } from "@nestjs/common";
import { Injectable, Inject } from "@nestjs/common";
import { DI_TOKENS } from "../core/di-tokens";
import type { IShieldConfig } from "../interfaces/shield-config.interface";

@Injectable()
export class ShieldGuard implements CanActivate {
  constructor(@Inject(DI_TOKENS.SHIELD_MODULE_OPTIONS) private readonly options: IShieldConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
