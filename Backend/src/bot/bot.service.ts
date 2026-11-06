import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env";

let botInstance: TelegramBot | null = null;

export function getBot(): TelegramBot {
  if (!botInstance) {
    throw new Error("Telegram bot has not been initialized");
  }
  return botInstance;
}

export function isBotInitialized(): boolean {
  return botInstance !== null;
}

export async function initializeBot(): Promise<TelegramBot | null> {
  if (!env.BOT_TOKEN) {
    console.warn("BOT_TOKEN not set — Telegram bot disabled");
    return null;
  }

  const useWebhook = Boolean(env.BOT_WEBHOOK_URL);

  botInstance = useWebhook
  ? new TelegramBot(env.BOT_TOKEN, { webHook: true })
  : new TelegramBot(env.BOT_TOKEN, { polling: true });

  if (useWebhook) {
    await botInstance.setWebHook(`${env.BOT_WEBHOOK_URL}/api/bot/webhook`);
    console.log(`Telegram bot webhook set: ${env.BOT_WEBHOOK_URL}/api/bot/webhook`);
  } else {
    console.log("Telegram bot started (polling mode)");
  }

  return botInstance;
}

export async function stopBot(): Promise<void> {
  if (!botInstance) return;

  if (env.BOT_WEBHOOK_URL) {
    await botInstance.deleteWebHook();
  } else {
    await botInstance.stopPolling();
  }

  botInstance = null;
}
