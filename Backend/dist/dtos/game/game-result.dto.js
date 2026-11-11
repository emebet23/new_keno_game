"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameResultSchema = void 0;
const zod_1 = require("zod");
exports.GameResultSchema = zod_1.z.object({
    draw: zod_1.z.array(zod_1.z.number().int().min(1).max(80)).length(20),
    matches: zod_1.z.number().int().min(0),
    multiplier: zod_1.z.number().positive(),
    prize: zod_1.z.number().min(0),
});
