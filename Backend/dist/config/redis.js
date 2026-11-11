"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const redisClient = new ioredis_1.default(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
    },
    lazyConnect: true,
});
redisClient.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
});
redisClient.on("connect", () => {
    console.log("[Redis] Connected");
});
exports.default = redisClient;
