import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET || "supersecretkey",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  NODE_ENV: process.env.NODE_ENV || "development",
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  BOT_WEBHOOK_URL: process.env.BOT_WEBHOOK_URL || "",
  WEBAPP_URL: process.env.WEBAPP_URL || "https://mines-telegram-games.vercel.app",
};
