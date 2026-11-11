"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    PORT: Number(process.env.PORT) || 5000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || "supersecretkey",
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    NODE_ENV: process.env.NODE_ENV || "development",
    BOT_TOKEN: process.env.BOT_TOKEN || "",
    BOT_WEBHOOK_URL: process.env.BOT_WEBHOOK_URL || "",
    WEBAPP_URL: process.env.WEBAPP_URL || "https://mines-telegram-games.vercel.app",
};
