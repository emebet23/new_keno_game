import Redis from "ioredis";
import { env } from "./env";

const redisClient = new Redis(env.REDIS_URL, {
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

export default redisClient;
