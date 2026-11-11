"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTelebirrRoutes = createTelebirrRoutes;
exports.createBotWebhookRoute = createBotWebhookRoute;
const express_1 = require("express");
const bot_service_1 = require("../../bot/bot.service");
const payment_service_1 = require("../services/payment.service");
function createTelebirrRoutes() {
    const router = (0, express_1.Router)();
    router.post("/sms-webhook", async (req, res) => {
        try {
            const { from, message, secret } = req.body;
            if (secret !== process.env.SMS_WEBHOOK_SECRET) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const isFromTelebirr = from?.toLowerCase().includes("telebirr") ||
                from?.includes("8555") ||
                from?.includes("tele");
            if (!isFromTelebirr) {
                return res.json({ status: "ignored" });
            }
            const recordResult = await payment_service_1.PaymentService.recordIncomingSms(message);
            if (recordResult.success &&
                recordResult.transaction?.claimedBy &&
                (0, bot_service_1.isBotInitialized)()) {
                const bot = (0, bot_service_1.getBot)();
                const amount = recordResult.transaction.amount ?? 0;
                await bot
                    .sendMessage(recordResult.transaction.claimedBy, `🔔 *Payment Detected Automatically!*\n\nYour deposit of ${amount} ETB has been confirmed. Balance updated!`, { parse_mode: "Markdown" })
                    .catch(() => { });
                return res.json({ status: "auto_approved" });
            }
            return res.json({ status: recordResult.success ? "recorded" : "ignored" });
        }
        catch (error) {
            console.error("SMS Webhook error:", error);
            return res.status(500).json({ error: "Internal Error" });
        }
    });
    router.get("/", async (_req, res) => {
        try {
            if (!(0, bot_service_1.isBotInitialized)()) {
                return res.send("Bot is running! Please open it in Telegram.");
            }
            const bot = (0, bot_service_1.getBot)();
            const me = await bot.getMe();
            return res.redirect(`https://t.me/${me.username}`);
        }
        catch {
            return res.send("Bot is running! Please open it in Telegram.");
        }
    });
    router.post("/callback", async (req, res) => {
        try {
            const result = await payment_service_1.PaymentService.processTelebirrCallback(req.body);
            res.json(result);
        }
        catch (error) {
            console.error("Webhook error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    return router;
}
function createBotWebhookRoute(bot) {
    const router = (0, express_1.Router)();
    router.post("/webhook", (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
    return router;
}
