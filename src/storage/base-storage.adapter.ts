import { Logger } from "@nestjs/common";
import { IStorageAdapter } from "../interfaces/shield-config.interface";
import { ErrorHandlerUtil } from "../common/utils";

// Re-export the interface for convenience
export { IStorageAdapter };

/**
 * Base class for storage adapters with common error handling
 */
export abstract class BaseStorageAdapter implements IStorageAdapter {
  protected readonly logger: Logger;
  protected readonly keyPrefix: string;

  constructor(
    protected readonly adapterName: string,
    keyPrefix = "",
  ) {
    this.logger = new Logger(adapterName);
    this.keyPrefix = keyPrefix;
  }

  /**
   * Get a key with optional prefix
   */
  protected getKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  /**
   * Handle storage operation errors consistently
   */
  protected handleError(error: unknown, operation: string): void {
    ErrorHandlerUtil.handle(error, `${this.adapterName}.${operation}`, this.logger, true);
  }

  /**
   * Wrap async operations with error handling
   */
  protected async wrapOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    fallbackValue?: T,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (fallbackValue !== undefined) {
        return ErrorHandlerUtil.handleWithFallback(
          error,
          `${this.adapterName}.${operation}`,
          fallbackValue,
          this.logger,
        );
      }
      this.handleError(error, operation);
      throw error; // This line won't be reached due to handleError throwing
    }
  }

  // Abstract methods that must be implemented by subclasses
  abstract get(key: string): Promise<any>;
  abstract set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract increment(key: string, delta?: number): Promise<number>;
  abstract decrement(key: string, delta?: number): Promise<number>;
  abstract exists(key: string): Promise<boolean>;
  abstract expire(key: string, ttlSeconds: number): Promise<void>;
  abstract ttl(key: string): Promise<number>;
  abstract clear(): Promise<void>;
  abstract isConnected(): Promise<boolean>;

  // Optional methods with default implementations
  async scan(_pattern: string): Promise<string[]> {
    this.logger.warn(`scan operation not supported in ${this.adapterName}`);
    return [];
  }

  async bulkGet(keys: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    for (const key of keys) {
      try {
        const value = await this.get(key);
        if (value !== null) {
          results.set(key, value);
        }
      } catch {
        // Continue with other keys
      }
    }
    return results;
  }

  async bulkSet(entries: Map<string, any>, ttlSeconds?: number): Promise<void> {
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.set(key, value, ttlSeconds).catch(() => {
        // Continue with other entries
      }),
    );
    await Promise.all(promises);
  }

  async bulkDelete(keys: string[]): Promise<void> {
    const promises = keys.map((key) =>
      this.delete(key).catch(() => {
        // Continue with other deletions
      }),
    );
    await Promise.all(promises);
  }

  /**
   * Get storage statistics (for monitoring)
   */
  async getStats(): Promise<Record<string, any>> {
    return {
      adapter: this.adapterName,
      connected: await this.isConnected(),
      keyPrefix: this.keyPrefix,
    };
  }
}
