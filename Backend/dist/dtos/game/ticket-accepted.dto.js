"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketAcceptedSchema = void 0;
const zod_1 = require("zod");
exports.TicketAcceptedSchema = zod_1.z.object({
    ticketId: zod_1.z.string().uuid(),
    gameId: zod_1.z.string().uuid(),
    roundNumber: zod_1.z.number().int(),
    selectedNumbers: zod_1.z.array(zod_1.z.number().int().min(1).max(80)),
    betAmount: zod_1.z.number().positive(),
    status: zod_1.z.literal("accepted"),
});
