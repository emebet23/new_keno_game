"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
class RedisService {
    static instance;
    client = null;
    isConnected = false;
    constructor() {
        try {
            this.client = new ioredis_1.default(env_1.env.REDIS_URL, {
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
        }
        catch (err) {
            console.warn("⚠️ Redis initialization error, using DB fallback.");
            this.client = null;
            this.isConnected = false;
        }
    }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    isAvailable() {
        return this.isConnected && this.client?.status === "ready";
    }
    async get(key) {
        if (!this.isAvailable())
            return null;
        try {
            return await this.client.get(key);
        }
        catch {
            return null;
        }
    }
    async getJson(key) {
        const data = await this.get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.isAvailable())
            return false;
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await this.client.setex(key, ttlSeconds, value);
            }
            else {
                await this.client.set(key, value);
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async setJson(key, value, ttlSeconds) {
        return this.set(key, JSON.stringify(value), ttlSeconds);
    }
    async del(key) {
        if (!this.isAvailable())
            return false;
        try {
            await this.client.del(key);
            return true;
        }
        catch {
            return false;
        }
    }
    async delPattern(pattern) {
        if (!this.isAvailable())
            return false;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.RedisService = RedisService;
exports.redisService = RedisService.getInstance();
