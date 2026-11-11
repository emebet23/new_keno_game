"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayGameSchema = exports.SingleTicketSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.SingleTicketSchema = zod_1.z.object({
    bet: zod_1.z.number().positive("Bet must be greater than 0"),
    selectedNumbers: zod_1.z
        .array(zod_1.z.number().int().min(1).max(80))
        .min(1, "Select at least 1 number")
        .max(10, "Select at most 10 numbers")
        .refine((nums) => new Set(nums).size === nums.length, "Duplicate numbers are not allowed in ticket"),
});
exports.PlayGameSchema = zod_1.z.object({
    mode: zod_1.z.nativeEnum(client_1.GameMode).optional().default(client_1.GameMode.INSTANT),
    clientSeed: zod_1.z.string().optional(),
    bet: zod_1.z.number().positive("Bet must be greater than 0").optional(),
    selectedNumbers: zod_1.z
        .array(zod_1.z.number().int().min(1).max(80))
        .min(1, "Select at least 1 number")
        .max(10, "Select at most 10 numbers")
        .refine((nums) => new Set(nums).size === nums.length, "Duplicate numbers are not allowed")
        .optional(),
    tickets: zod_1.z.array(exports.SingleTicketSchema).optional(),
}).refine((data) => (data.bet && data.selectedNumbers) || (data.tickets && data.tickets.length > 0), "Must provide either (bet and selectedNumbers) or a list of tickets");
