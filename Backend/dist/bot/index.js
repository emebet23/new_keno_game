"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBot = exports.getBot = void 0;
exports.setupBot = setupBot;
const bot_service_1 = require("./bot.service");
Object.defineProperty(exports, "initializeBot", { enumerable: true, get: function () { return bot_service_1.initializeBot; } });
Object.defineProperty(exports, "getBot", { enumerable: true, get: function () { return bot_service_1.getBot; } });
const bot_handlers_1 = require("./bot.handlers");
async function setupBot() {
    const bot = await (0, bot_service_1.initializeBot)();
    if (!bot)
        return;
    (0, bot_handlers_1.registerBotHandlers)(bot);
    console.log("Telegram bot handlers registered");
}
