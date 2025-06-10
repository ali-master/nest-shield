import type { Type } from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import type { IHttpAdapter, IAdapterConfig } from "../interfaces";
import { AdapterType } from "../core/constants";
import { ConfigurationException } from "../core/exceptions";
import { ExpressAdapter } from "./express.adapter";
import { FastifyAdapter } from "./fastify.adapter";
import type { BaseHttpAdapter } from "./base-http.adapter";

export class AdapterFactory {
  static create(config: IAdapterConfig, httpAdapterHost?: HttpAdapterHost): IHttpAdapter {
    if (config.customAdapter) {
      return config.customAdapter;
    }

    switch (config.type) {
      case AdapterType.EXPRESS:
        return new ExpressAdapter();

      case AdapterType.FASTIFY:
        return new FastifyAdapter();

      case AdapterType.AUTO:
        return AdapterFactory.detectAdapter(httpAdapterHost);

      default:
        throw new ConfigurationException(
          `Unknown adapter type: ${config.type}. Valid types are: ${Object.values(AdapterType).join(", ")}`,
        );
    }
  }

  private static detectAdapter(httpAdapterHost?: HttpAdapterHost): IHttpAdapter {
    if (!httpAdapterHost) {
      throw new ConfigurationException("HttpAdapterHost not available. Please specify adapter type explicitly or provide a custom adapter.");
    }

    const httpAdapter = httpAdapterHost.httpAdapter;

    if (!httpAdapter) {
      throw new ConfigurationException("No HTTP adapter found");
    }

    const instance = httpAdapter.getInstance();

    if (AdapterFactory.isExpress(instance)) {
      return new ExpressAdapter();
    }

    if (AdapterFactory.isFastify(instance)) {
      return new FastifyAdapter();
    }

    throw new ConfigurationException(
      "Unable to detect HTTP adapter type. Please specify adapter type explicitly or provide a custom adapter.",
    );
  }

  private static isExpress(instance: any): boolean {
    return (
      instance &&
      typeof instance.use === "function" &&
      typeof instance.get === "function" &&
      typeof instance.post === "function" &&
      !instance.server
    );
  }

  private static isFastify(instance: any): boolean {
    return (
      instance &&
      typeof instance.register === "function" &&
      typeof instance.route === "function" &&
      instance.server
    );
  }

  static createAdapter(type: AdapterType | Type<BaseHttpAdapter>): IHttpAdapter {
    if (typeof type === "string") {
      switch (type) {
        case AdapterType.EXPRESS:
          return new ExpressAdapter();
        case AdapterType.FASTIFY:
          return new FastifyAdapter();
        default:
          throw new ConfigurationException(`Unknown adapter type: ${type}`);
      }
    }

    return new (type as new () => IHttpAdapter)();
  }
}
