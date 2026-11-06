import { initializeBot, getBot } from "./bot.service";
import { registerBotHandlers } from "./bot.handlers";

export async function setupBot(): Promise<void> {
  const bot = await initializeBot();
  if (!bot) return;

  registerBotHandlers(bot);
  console.log("Telegram bot handlers registered");
}

export { getBot, initializeBot };
