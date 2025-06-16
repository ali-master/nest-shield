import { Injectable } from "@nestjs/common";
import { BaseStorageAdapter } from "./base-storage.adapter";

// eslint-disable-next-line ts/no-require-imports
const NodeCache = require("node-cache");

export interface MemoryStorageOptions {
  stdTTL?: number;
  checkperiod?: number;
  maxKeys?: number;
  deleteOnExpire?: boolean;
  useClones?: boolean;
}

@Injectable()
export class MemoryStorageAdapter extends BaseStorageAdapter {
  private cache: any;

  constructor(options?: MemoryStorageOptions) {
    super("MemoryStorageAdapter", options?.stdTTL?.toString() || "0");
    this.cache = new NodeCache({
      stdTTL: options?.stdTTL || 0,
      checkperiod: options?.checkperiod || 120, // Reduced from 600 for better cleanup
      maxKeys: options?.maxKeys || 50000, // Set reasonable default limit
      deleteOnExpire: options?.deleteOnExpire ?? true,
      useClones: options?.useClones ?? false, // Disable cloning for better performance
      errorOnMissing: false, // Don't throw errors on missing keys
      forceString: false, // Allow any value type
    });
  }

  async get(key: string): Promise<any> {
    try {
      const fullKey = this.getKey(key);
      return this.cache.get(fullKey);
    } catch (error) {
      this.handleError(error as Error, "get");
      return null;
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
      const fullKey = this.getKey(key);
      // Direct cache access for better performance
      const current = this.cache.get(fullKey) || 0;
      const newValue = Number(current) + value;
      this.cache.set(fullKey, newValue);
      return newValue;
    } catch (error) {
      this.handleError(error as Error, "increment");
      return 0;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      // Direct cache access for better performance
      const current = this.cache.get(fullKey) || 0;
      const newValue = Number(current) - value;
      this.cache.set(fullKey, newValue);
      return newValue;
    } catch (error) {
      this.handleError(error as Error, "decrement");
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      return this.cache.has(fullKey);
    } catch (error) {
      this.handleError(error as Error, "exists");
      return false;
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
      return -1;
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
      return [];
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

  async scan(pattern: string): Promise<string[]> {
    try {
      const allKeys: string[] = this.cache.keys();
      const sanitizedPattern = this.sanitizePattern(pattern);
      const regex = new RegExp(sanitizedPattern);

      // Add timeout protection for regex execution to prevent ReDoS
      return await this.timeoutedRegexFilter(allKeys, regex, 5000); // 5 second timeout
    } catch (error) {
      this.handleError(error as Error, "scan");
      return [];
    }
  }

  /**
   * Sanitize pattern to prevent ReDoS attacks
   */
  private sanitizePattern(pattern: string): string {
    // Remove potentially dangerous regex constructs
    let sanitized = pattern
      .replace(/[|()[\]{}+?^$\\]/g, "\\$&") // Escape special regex chars
      .replace(/\*/g, ".*") // Convert wildcards to safe regex
      .substring(0, 100); // Limit pattern length

    // Ensure the pattern doesn't contain excessive quantifiers
    if (/(\.\*){3,}/.test(sanitized)) {
      sanitized = sanitized.replace(/(\.\*){3,}/g, ".*");
    }

    return sanitized;
  }

  /**
   * Execute regex filter with timeout protection to prevent ReDoS
   */
  private async timeoutedRegexFilter(
    keys: string[],
    regex: RegExp,
    timeoutMs: number,
  ): Promise<string[]> {
    try {
      return await new Promise<string[]>((resolve, reject) => {
        const results: string[] = [];
        let index = 0;

        const timeout = setTimeout(() => {
          reject(new Error("Regex operation timed out - possible ReDoS attack"));
        }, timeoutMs);

        const processNext = () => {
          const batchSize = 100; // Process in batches
          const endIndex = Math.min(index + batchSize, keys.length);

          try {
            for (let i = index; i < endIndex; i++) {
              if (regex.test(keys[i])) {
                results.push(keys[i].replace(this.keyPrefix, ""));
              }
            }

            index = endIndex;

            if (index >= keys.length) {
              clearTimeout(timeout);
              resolve(results);
            } else {
              // Use setImmediate to prevent blocking event loop
              setImmediate(processNext);
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        processNext();
      });
    } catch {
      // Return empty array on timeout or error
      return [];
    }
  }

  async isConnected(): Promise<boolean> {
    return this.cache !== null && this.cache !== undefined;
  }

  // Additional methods for test compatibility
  async getMultiple(keys: string[]): Promise<any[]> {
    return this.mget(keys);
  }

  async setMultiple(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    return this.mset(entries, ttl);
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    try {
      const fullKeys = keys.map((key) => this.getKey(key));
      this.cache.del(fullKeys);
    } catch (error) {
      this.handleError(error as Error, "deleteMultiple");
    }
  }

  async close(): Promise<void> {
    // Close the node-cache instance to clean up internal timers
    if (this.cache && this.cache.close) {
      this.cache.close();
    }
  }
}
