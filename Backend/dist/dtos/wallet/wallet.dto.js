"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletSchema = void 0;
const zod_1 = require("zod");
exports.WalletSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    playBalance: zod_1.z.number().min(0),
    mainBalance: zod_1.z.number().min(0),
    currency: zod_1.z.string().default("ETB"),
});
