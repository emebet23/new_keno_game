"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTicketSchema = void 0;
const zod_1 = require("zod");
exports.CreateTicketSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    gameId: zod_1.z.string().uuid(),
    selectedNumbers: zod_1.z
        .array(zod_1.z.number().int().min(1).max(80))
        .min(1)
        .max(10),
    betAmount: zod_1.z.number().positive(),
    matches: zod_1.z.number().int().min(0).optional(),
    multiplier: zod_1.z.number().positive().optional(),
    payout: zod_1.z.number().min(0).optional(),
});
