"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevLoginSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.DevLoginSchema = zod_1.z.object({
    telegramId: zod_1.z.coerce.bigint().optional(),
    username: zod_1.z.string().optional(),
    firstName: zod_1.z.string().default("Dev User"),
    role: zod_1.z.nativeEnum(client_1.Role).default(client_1.Role.USER),
});
