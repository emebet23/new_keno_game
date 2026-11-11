"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSettledSchema = void 0;
const zod_1 = require("zod");
const ticket_settled_dto_1 = require("./ticket-settled.dto");
exports.GameSettledSchema = zod_1.z.object({
    gameId: zod_1.z.string().uuid(),
    roundNumber: zod_1.z.number().int(),
    drawNumbers: zod_1.z.array(zod_1.z.number().int().min(1).max(80)).length(20),
    totalTickets: zod_1.z.number().int().min(0),
    settledTickets: zod_1.z.array(ticket_settled_dto_1.TicketSettledSchema),
    totalPayout: zod_1.z.number().min(0),
    serverSeed: zod_1.z.string().optional(),
    serverSeedHash: zod_1.z.string().optional(),
});
