"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
const redis_service_1 = require("../services/redis.service");
function rateLimiter(limit = 10, windowSeconds = 5) {
    const memoryStore = new Map();
    return async (req, res, next) => {
        const identifier = req.user?.userId || req.ip || "global";
        const key = `ratelimit:${req.path}:${identifier}`;
        if (redis_service_1.redisService.isAvailable()) {
            try {
                const countStr = await redis_service_1.redisService.get(key);
                const currentCount = countStr ? parseInt(countStr, 10) : 0;
                if (currentCount >= limit) {
                    return res.status(429).json({
                        success: false,
                        message: "Too many requests. Please slow down.",
                    });
                }
                if (currentCount === 0) {
                    await redis_service_1.redisService.set(key, "1", windowSeconds);
                }
                else {
                    await redis_service_1.redisService.set(key, String(currentCount + 1), windowSeconds);
                }
                return next();
            }
            catch {
                // Fallback to memory if Redis error occurs
            }
        }
        // In-memory fallback
        const now = Date.now();
        const record = memoryStore.get(key);
        if (!record || now > record.expiresAt) {
            memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
            return next();
        }
        if (record.count >= limit) {
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please slow down.",
            });
        }
        record.count++;
        return next();
    };
}
