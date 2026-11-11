"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramLoginSchema = void 0;
const zod_1 = require("zod");
exports.TelegramLoginSchema = zod_1.z.object({
    telegramId: zod_1.z.coerce.bigint(),
    username: zod_1.z.string().optional(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    initData: zod_1.z.string().optional(),
});
