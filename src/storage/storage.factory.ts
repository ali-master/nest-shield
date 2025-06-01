import { Injectable } from "@nestjs/common";
import { IStorageAdapter, IStorageConfig } from "../interfaces/shield-config.interface";
import { StorageType } from "../core/constants";
import { ConfigurationException } from "../core/exceptions";
import { MemoryStorageAdapter } from "./memory-storage.adapter";
import { RedisStorageAdapter } from "./redis-storage.adapter";
import { MemcachedStorageAdapter } from "./memcached-storage.adapter";

@Injectable()
export class StorageFactory {
  static create(config: IStorageConfig): IStorageAdapter {
    switch (config.type) {
      case StorageType.MEMORY:
        return new MemoryStorageAdapter(config.options);

      case StorageType.REDIS:
        return new RedisStorageAdapter(config.options);

      case StorageType.MEMCACHED:
        return new MemcachedStorageAdapter(config.options);

      case StorageType.CUSTOM:
        if (!config.customAdapter) {
          throw new ConfigurationException(
            "Custom storage adapter must be provided when using custom storage type",
          );
        }
        return config.customAdapter;

      default:
        throw new ConfigurationException(
          `Unknown storage type: ${config.type}. Valid types are: ${Object.values(StorageType).join(", ")}`,
        );
    }
  }

  static async createAsync(config: IStorageConfig): Promise<IStorageAdapter> {
    const adapter = this.create(config);

    if (config.type === StorageType.REDIS && adapter instanceof RedisStorageAdapter) {
      try {
        await adapter.ping();
      } catch (error) {
        throw new ConfigurationException(`Failed to connect to Redis: ${(error as Error).message}`);
      }
    }

    return adapter;
  }
}
