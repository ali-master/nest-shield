import { Injectable } from "@nestjs/common";
import type { RedisOptions } from "ioredis";
import { Redis } from "ioredis";
import { BaseStorageAdapter } from "./base-storage.adapter";

export interface RedisStorageOptions extends RedisOptions {
  keyPrefix?: string;
}

@Injectable()
export class RedisStorageAdapter extends BaseStorageAdapter {
  private client: Redis;

  constructor(options?: RedisStorageOptions | Redis) {
    // Pass keyPrefix to base class constructor if provided
    const redisOptions = options && !("get" in options) ? options : undefined;
    super({ ...redisOptions, prefix: redisOptions?.keyPrefix });

    if (options && "get" in options && "set" in options) {
      this.client = options;
    } else {
      const redisOpts = (options as RedisStorageOptions) || {};
      this.client = new Redis({
        host: "localhost",
        port: 6379,
        ...redisOpts,
        keyPrefix: undefined,
      });
    }

    this.client.on("error", (error) => {
      console.error("Redis client error:", error);
    });
  }

  async get(key: string): Promise<any> {
    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.handleError(error as Error, "get");
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const serialized = JSON.stringify(value);

      if (ttl && ttl > 0) {
        await this.client.setex(fullKey, ttl, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }
    } catch (error) {
      this.handleError(error as Error, "set");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      await this.client.del(fullKey);
    } catch (error) {
      this.handleError(error as Error, "delete");
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      return await this.client.incrby(fullKey, value);
    } catch (error) {
      this.handleError(error as Error, "increment");
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      return await this.client.decrby(fullKey, value);
    } catch (error) {
      this.handleError(error as Error, "decrement");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const exists = await this.client.exists(fullKey);
      return exists === 1;
    } catch (error) {
      this.handleError(error as Error, "exists");
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      await this.client.expire(fullKey, ttl);
    } catch (error) {
      this.handleError(error as Error, "expire");
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      return await this.client.ttl(fullKey);
    } catch (error) {
      this.handleError(error as Error, "ttl");
    }
  }

  async clear(): Promise<void> {
    try {
      const pattern = `${this.prefix}*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.handleError(error as Error, "clear");
    }
  }

  async mget(keys: string[]): Promise<any[]> {
    try {
      const fullKeys = keys.map((key) => this.getKey(key));
      const values = await this.client.mget(...fullKeys);
      return values.map((value) => (value ? JSON.parse(value) : null));
    } catch (error) {
      this.handleError(error as Error, "mget");
    }
  }

  async mset(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.client.pipeline();

      for (const [key, value] of entries) {
        const fullKey = this.getKey(key);
        const serialized = JSON.stringify(value);

        if (ttl && ttl > 0) {
          pipeline.setex(fullKey, ttl, serialized);
        } else {
          pipeline.set(fullKey, serialized);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.handleError(error as Error, "mset");
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async scan(pattern: string, count: number = 100): Promise<string[]> {
    const fullPattern = this.getKey(pattern);
    const keys: string[] = [];
    const stream = this.client.scanStream({
      match: fullPattern,
      count,
    });

    return new Promise((resolve, reject) => {
      stream.on("data", (resultKeys) => {
        keys.push(...resultKeys);
      });
      stream.on("end", () => {
        resolve(keys.map((key) => key.replace(this.prefix, "")));
      });
      stream.on("error", reject);
    });
  }
}
