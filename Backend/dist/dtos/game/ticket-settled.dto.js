"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketSettledSchema = void 0;
const zod_1 = require("zod");
exports.TicketSettledSchema = zod_1.z.object({
    ticketId: zod_1.z.string().uuid(),
    selectedNumbers: zod_1.z.array(zod_1.z.number().int().min(1).max(80)),
    drawNumbers: zod_1.z.array(zod_1.z.number().int().min(1).max(80)).length(20),
    matches: zod_1.z.number().int().min(0),
    multiplier: zod_1.z.number().min(0),
    betAmount: zod_1.z.number().positive(),
    payout: zod_1.z.number().min(0),
    won: zod_1.z.boolean(),
});
