import Redis from "ioredis";

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        RedisClient.instance = new Redis(redisUrl);
      } else {
        RedisClient.instance = new Redis({
          host: process.env.REDIS_HOST ?? "localhost",
          port: Number(process.env.REDIS_PORT) ?? 6379,
          password: process.env.REDIS_PASSWORD,
          db: Number(process.env.REDIS_DB) ?? 0,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      }

      RedisClient.instance.on("error", (error) => {
        console.error("Redis connection error:", error);
      });

      RedisClient.instance.on("connect", () => {
        console.log("Connected to Redis");
      });

      RedisClient.instance.on("disconnect", () => {
        console.log("Disconnected from Redis");
      });
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.disconnect();
      RedisClient.instance = null;
    }
  }
}

export const redis = RedisClient.getInstance();

// Utility functions for common Redis operations
export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = RedisClient.getInstance();
  }

  // Real-time metrics caching
  async setMetric(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async getMetric(key: string): Promise<any | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async getMetrics(pattern: string): Promise<Record<string, any>> {
    const keys = await this.redis.keys(pattern);
    const pipeline = this.redis.pipeline();

    keys.forEach((key) => {
      pipeline.get(key);
    });

    const results = await pipeline.exec();
    const metrics: Record<string, any> = {};

    keys.forEach((key, index) => {
      const result = results?.[index];
      if (result && result[1]) {
        try {
          metrics[key] = JSON.parse(result[1] as string);
        } catch {
          metrics[key] = result[1];
        }
      }
    });

    return metrics;
  }

  // Real-time data streaming
  async publishMetric(channel: string, data: any): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(data));
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    const subscriber = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT) ?? 6379,
      password: process.env.REDIS_PASSWORD,
      db: Number(process.env.REDIS_DB) ?? 0,
    });

    subscriber.subscribe(channel);
    subscriber.on("message", (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
        }
      }
    });
  }

  // Session and cache management
  async setCache(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async getCache(key: string): Promise<any | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async deleteCache(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clearCachePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Rate limiting support
  async incrementCounter(key: string, window: number): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, window);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) || 0;
  }

  async getCounter(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value ? Number.parseInt(value, 10) : 0;
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<any> {
    try {
      const info = await this.redis.info();
      return this.parseRedisInfo(info);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const parsed: Record<string, any> = {};
    const sections = info.split("\r\n\r\n");

    sections.forEach((section) => {
      const lines = section.split("\r\n");
      const sectionName = lines[0]?.replace("# ", "") || "general";
      parsed[sectionName] = {};

      lines.slice(1).forEach((line) => {
        if (line && line.includes(":")) {
          const [key, value] = line.split(":");
          if (sectionName && key) {
            parsed[sectionName][key] = value;
          }
        }
      });
    });

    return parsed;
  }
}

export default new RedisService();
