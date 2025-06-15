import { Injectable } from "@nestjs/common";
import * as memjs from "memjs";
import { BaseStorageAdapter } from "./base-storage.adapter";

export interface MemcachedStorageOptions {
  servers?: string | string[];
  username?: string;
  password?: string;
  expires?: number;
  retries?: number;
  retry_delay?: number;
  failover?: boolean;
  timeout?: number;
  keepAlive?: boolean;
}

@Injectable()
export class MemcachedStorageAdapter extends BaseStorageAdapter {
  private client: memjs.Client;
  private defaultTTL: number;

  constructor(options?: MemcachedStorageOptions) {
    super(options);

    const servers = options?.servers || "localhost:11211";
    const serverString = Array.isArray(servers) ? servers.join(",") : servers;

    this.client = memjs.Client.create(serverString, {
      username: options?.username,
      password: options?.password,
      expires: options?.expires || 0,
      retries: options?.retries || 2,
      retry_delay: options?.retry_delay || 0.2,
      failover: options?.failover ?? true,
      timeout: options?.timeout || 0.5,
      keepAlive: options?.keepAlive ?? true,
    });

    this.defaultTTL = options?.expires || 0;
  }

  async get(key: string): Promise<any> {
    try {
      const fullKey = this.getKey(key);
      const result = await new Promise<{ value: Buffer | null }>((resolve, reject) => {
        this.client.get(fullKey, (err, value) => {
          if (err) reject(err);
          else resolve({ value });
        });
      });

      if (!result.value) return null;

      try {
        return JSON.parse(result.value.toString());
      } catch {
        return result.value.toString();
      }
    } catch (error) {
      this.handleError(error as Error, "get");
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const serialized = JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;

      await new Promise<void>((resolve, reject) => {
        this.client.set(fullKey, serialized, { expires: expiration }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      this.handleError(error as Error, "set");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      await new Promise<void>((resolve, reject) => {
        this.client.delete(fullKey, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      this.handleError(error as Error, "delete");
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const result = await new Promise<number>((resolve, reject) => {
        this.client.increment(fullKey, value, (err, success, resultValue) => {
          if (err) reject(err);
          else if (!success) reject(new Error("Increment failed"));
          else resolve(resultValue || 0);
        });
      });
      return result;
    } catch {
      // Fallback to get-increment-set pattern
      const current = (await this.get(key)) || 0;
      const newValue = Number(current) + value;
      await this.set(key, newValue);
      return newValue;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      return await new Promise<number>((resolve, reject) => {
        this.client.decrement(fullKey, value, (err, success, resultValue) => {
          if (err) reject(err);
          else if (!success) reject(new Error("Decrement failed"));
          else resolve(resultValue || 0);
        });
      });
    } catch {
      // Fallback to get-decrement-set pattern
      const current = (await this.get(key)) || 0;
      const newValue = Math.max(0, Number(current) - value);
      await this.set(key, newValue);
      return newValue;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      await new Promise<void>((resolve, reject) => {
        this.client.touch(fullKey, ttl, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch {
      const value = await this.get(key);
      if (value !== null) {
        await this.set(key, value, ttl);
      }
    }
  }

  async ttl(_key: string): Promise<number> {
    return -1;
  }

  async clear(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.client.flush((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      this.handleError(error as Error, "clear");
    }
  }

  async mget(keys: string[]): Promise<any[]> {
    // Use parallel processing for better performance
    return await Promise.all(keys.map((key) => this.get(key).catch(() => null)));
  }

  async mset(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    await Promise.all(entries.map(([key, value]) => this.set(key, value, ttl)));
  }

  async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.client.close();
      resolve();
    });
  }

  async stats(): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      this.client.stats((err, server, stats) => {
        if (err) reject(err);
        else resolve({ [server]: stats });
      });
    });
  }
}
