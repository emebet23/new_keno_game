"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBot = getBot;
exports.isBotInitialized = isBotInitialized;
exports.initializeBot = initializeBot;
exports.stopBot = stopBot;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const env_1 = require("../config/env");
let botInstance = null;
function getBot() {
    if (!botInstance) {
        throw new Error("Telegram bot has not been initialized");
    }
    return botInstance;
}
function isBotInitialized() {
    return botInstance !== null;
}
async function initializeBot() {
    if (!env_1.env.BOT_TOKEN) {
        console.warn("BOT_TOKEN not set — Telegram bot disabled");
        return null;
    }
    const useWebhook = Boolean(env_1.env.BOT_WEBHOOK_URL);
    botInstance = useWebhook
        ? new node_telegram_bot_api_1.default(env_1.env.BOT_TOKEN, { webHook: true })
        : new node_telegram_bot_api_1.default(env_1.env.BOT_TOKEN, { polling: true });
    if (useWebhook) {
        await botInstance.setWebHook(`${env_1.env.BOT_WEBHOOK_URL}/api/bot/webhook`);
        console.log(`Telegram bot webhook set: ${env_1.env.BOT_WEBHOOK_URL}/api/bot/webhook`);
    }
    else {
        console.log("Telegram bot started (polling mode)");
    }
    return botInstance;
}
async function stopBot() {
    if (!botInstance)
        return;
    if (env_1.env.BOT_WEBHOOK_URL) {
        await botInstance.deleteWebHook();
    }
    else {
        await botInstance.stopPolling();
    }
    botInstance = null;
}
