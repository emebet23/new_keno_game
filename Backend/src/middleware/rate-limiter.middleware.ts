import { Request, Response, NextFunction } from "express";
import { redisService } from "../services/redis.service";

export function rateLimiter(limit = 10, windowSeconds = 5) {
  const memoryStore = new Map<string, { count: number; expiresAt: number }>();

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.user?.userId || req.ip || "global";
    const key = `ratelimit:${req.path}:${identifier}`;

    if (redisService.isAvailable()) {
      try {
        const countStr = await redisService.get(key);
        const currentCount = countStr ? parseInt(countStr, 10) : 0;

        if (currentCount >= limit) {
          return res.status(429).json({
            success: false,
            message: "Too many requests. Please slow down.",
          });
        }

        if (currentCount === 0) {
          await redisService.set(key, "1", windowSeconds);
        } else {
          await redisService.set(key, String(currentCount + 1), windowSeconds);
        }

        return next();
      } catch {
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
