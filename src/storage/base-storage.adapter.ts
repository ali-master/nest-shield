import { Injectable } from "@nestjs/common";
import { IStorageAdapter } from "../interfaces/shield-config.interface";
import { StorageException } from "../core/exceptions";

@Injectable()
export abstract class BaseStorageAdapter implements IStorageAdapter {
  protected readonly prefix: string;

  constructor(protected readonly options?: any) {
    this.prefix = options?.prefix || "shield:";
  }

  protected getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  protected handleError(error: Error, operation: string): never {
    throw new StorageException(`Storage ${operation} failed: ${error.message}`, error);
  }

  abstract get(key: string): Promise<any>;
  abstract set(key: string, value: any, ttl?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract increment(key: string, value?: number): Promise<number>;
  abstract decrement(key: string, value?: number): Promise<number>;
  abstract exists(key: string): Promise<boolean>;
  abstract expire(key: string, ttl: number): Promise<void>;
  abstract ttl(key: string): Promise<number>;
  abstract clear?(): Promise<void>;
  abstract mget?(keys: string[]): Promise<any[]>;
  abstract mset?(entries: Array<[string, any]>, ttl?: number): Promise<void>;

  async getMultiple(keys: string[]): Promise<any[]> {
    if (this.mget) {
      return this.mget(keys);
    }
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async setMultiple(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    if (this.mset) {
      return this.mset(entries, ttl);
    }
    await Promise.all(entries.map(([key, value]) => this.set(key, value, ttl)));
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }
}
