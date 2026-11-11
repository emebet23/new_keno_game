"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
class TransactionRepository {
    async create(tx, dto) {
        return tx.transaction.create({
            data: {
                userId: dto.userId,
                type: dto.type,
                status: dto.status ?? client_1.TransactionStatus.SUCCESS,
                amount: new client_1.Prisma.Decimal(dto.amount),
                balanceBefore: new client_1.Prisma.Decimal(dto.balanceBefore),
                balanceAfter: new client_1.Prisma.Decimal(dto.balanceAfter),
                reference: dto.reference,
            },
        });
    }
    async history(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            prisma_1.default.transaction.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.default.transaction.count({ where: { userId } }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}
exports.TransactionRepository = TransactionRepository;
