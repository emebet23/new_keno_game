"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FairnessRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class FairnessRepository {
    async create(tx, data) {
        return tx.fairnessRecord.create({ data });
    }
    async findByGameId(gameId) {
        return prisma_1.default.fairnessRecord.findUnique({ where: { gameId } });
    }
}
exports.FairnessRepository = FairnessRepository;
