import { Router, Request, Response } from "express";
import TelegramBot from "node-telegram-bot-api";
import { getBot, isBotInitialized } from "../../bot/bot.service";
import { PaymentService } from "../services/payment.service";

export function createTelebirrRoutes(): Router {
  const router = Router();

  router.post("/sms-webhook", async (req: Request, res: Response) => {
    try {
      const { from, message, secret } = req.body;
      if (secret !== process.env.SMS_WEBHOOK_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const isFromTelebirr =
        from?.toLowerCase().includes("telebirr") ||
        from?.includes("8555") ||
        from?.includes("tele");

      if (!isFromTelebirr) {
        return res.json({ status: "ignored" });
      }

      const recordResult = await PaymentService.recordIncomingSms(message);

      if (
        recordResult.success &&
        recordResult.transaction?.claimedBy &&
        isBotInitialized()
      ) {
        const bot = getBot();
        const amount = recordResult.transaction.amount ?? 0;
        await bot
          .sendMessage(
            recordResult.transaction.claimedBy,
            `🔔 *Payment Detected Automatically!*\n\nYour deposit of ${amount} ETB has been confirmed. Balance updated!`,
            { parse_mode: "Markdown" },
          )
          .catch(() => {});
        return res.json({ status: "auto_approved" });
      }

      return res.json({ status: recordResult.success ? "recorded" : "ignored" });
    } catch (error) {
      console.error("SMS Webhook error:", error);
      return res.status(500).json({ error: "Internal Error" });
    }
  });

  router.get("/", async (_req: Request, res: Response) => {
    try {
      if (!isBotInitialized()) {
        return res.send("Bot is running! Please open it in Telegram.");
      }

      const bot = getBot();
      const me = await bot.getMe();
      return res.redirect(`https://t.me/${me.username}`);
    } catch {
      return res.send("Bot is running! Please open it in Telegram.");
    }
  });

  router.post("/callback", async (req: Request, res: Response) => {
    try {
      const result = await PaymentService.processTelebirrCallback(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export function createBotWebhookRoute(bot: TelegramBot): Router {
  const router = Router();

  router.post("/webhook", (req: Request, res: Response) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  return router;
}
