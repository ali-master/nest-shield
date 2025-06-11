import { Injectable } from "@nestjs/common";
import NodeCache from "node-cache";
import { BaseStorageAdapter } from "./base-storage.adapter";

export interface MemoryStorageOptions {
  stdTTL?: number;
  checkperiod?: number;
  maxKeys?: number;
  deleteOnExpire?: boolean;
  useClones?: boolean;
}

@Injectable()
export class MemoryStorageAdapter extends BaseStorageAdapter {
  private cache: NodeCache;

  constructor(options?: MemoryStorageOptions) {
    super(options);
    this.cache = new NodeCache({
      stdTTL: options?.stdTTL || 0,
      checkperiod: options?.checkperiod || 600,
      maxKeys: options?.maxKeys || -1,
      deleteOnExpire: options?.deleteOnExpire ?? true,
      useClones: options?.useClones ?? false,
    });
  }

  async get(key: string): Promise<any> {
    try {
      const fullKey = this.getKey(key);
      return this.cache.get(fullKey);
    } catch (error) {
      this.handleError(error as Error, "get");
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      this.cache.set(fullKey, value, ttl || 0);
    } catch (error) {
      this.handleError(error as Error, "set");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      this.cache.del(fullKey);
    } catch (error) {
      this.handleError(error as Error, "delete");
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      const _fullKey = this.getKey(key);
      const current = (await this.get(key)) || 0;
      const newValue = Number(current) + value;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      this.handleError(error as Error, "increment");
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      const _fullKey = this.getKey(key);
      const current = (await this.get(key)) || 0;
      const newValue = Number(current) - value;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      this.handleError(error as Error, "decrement");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      return this.cache.has(fullKey);
    } catch (error) {
      this.handleError(error as Error, "exists");
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      this.cache.ttl(fullKey, ttl);
    } catch (error) {
      this.handleError(error as Error, "expire");
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const ttl = this.cache.getTtl(fullKey);
      if (!ttl) return -1;
      return Math.floor((ttl - Date.now()) / 1000);
    } catch (error) {
      this.handleError(error as Error, "ttl");
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.flushAll();
    } catch (error) {
      this.handleError(error as Error, "clear");
    }
  }

  async mget(keys: string[]): Promise<any[]> {
    try {
      const fullKeys = keys.map((key) => this.getKey(key));
      const values = this.cache.mget(fullKeys);
      return keys.map((key) => values[this.getKey(key)]);
    } catch (error) {
      this.handleError(error as Error, "mget");
    }
  }

  async mset(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    try {
      const items = entries.map(([key, value]) => ({
        key: this.getKey(key),
        val: value,
        ttl: ttl || 0,
      }));
      this.cache.mset(items);
    } catch (error) {
      this.handleError(error as Error, "mset");
    }
  }

  getStats() {
    return this.cache.getStats();
  }

  getKeys(): string[] {
    return this.cache.keys();
  }
}
