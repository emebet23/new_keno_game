"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevealedFairnessSchema = void 0;
const zod_1 = require("zod");
exports.RevealedFairnessSchema = zod_1.z.object({
    gameId: zod_1.z.string().uuid(),
    serverSeed: zod_1.z.string(),
    serverSeedHash: zod_1.z.string(),
    clientSeed: zod_1.z.string(),
    nonce: zod_1.z.number().int(),
});
