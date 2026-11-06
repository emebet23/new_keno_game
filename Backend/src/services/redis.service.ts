import Redis from "ioredis";
import { env } from "../config/env";

export class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private isConnected = false;

  private constructor() {
    try {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) {
            return null; // Stop retrying if Redis is not available locally
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      this.client.connect().then(() => {
        this.isConnected = true;
        console.log("⚡ Redis connected successfully");
      }).catch((err) => {
        this.isConnected = false;
        console.warn("⚠️ Redis connection failed. Operating in Database-Only fallback mode:", err.message);
      });

      this.client.on("error", (err) => {
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        this.isConnected = true;
      });
    } catch (err) {
      console.warn("⚠️ Redis initialization error, using DB fallback.");
      this.client = null;
      this.isConnected = false;
    }
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public isAvailable(): boolean {
    return this.isConnected && this.client?.status === "ready";
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(key);
    } catch {
      return null;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client!.setex(key, ttlSeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch {
      return false;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    return this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.del(key);
      return true;
    } catch {
      return false;
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const redisService = RedisService.getInstance();
