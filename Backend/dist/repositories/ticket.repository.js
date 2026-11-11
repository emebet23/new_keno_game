"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
class TicketRepository {
    async create(tx, data) {
        return tx.ticket.create({
            data: {
                userId: data.userId,
                gameId: data.gameId,
                mode: data.mode ?? client_1.GameMode.CLASSIC,
                selectedNumbers: data.selectedNumbers,
                betAmount: new client_1.Prisma.Decimal(data.betAmount),
                status: client_1.TicketStatus.PENDING,
            },
        });
    }
    async getByGame(tx, gameId) {
        return tx.ticket.findMany({
            where: { gameId },
        });
    }
    async findByGameId(tx, gameId) {
        return tx.ticket.findMany({
            where: { gameId },
        });
    }
    async settle(tx, ticketId, data) {
        return tx.ticket.update({
            where: { id: ticketId },
            data: {
                matches: data.matches,
                multiplier: new client_1.Prisma.Decimal(data.multiplier),
                payout: new client_1.Prisma.Decimal(data.payout),
                status: data.status,
            },
        });
    }
    async findByUserId(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total, totals] = await Promise.all([
            prisma_1.default.ticket.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    game: {
                        include: { fairness: true },
                    },
                },
            }),
            prisma_1.default.ticket.count({ where: { userId } }),
            prisma_1.default.ticket.aggregate({
                where: { userId },
                _sum: {
                    betAmount: true,
                    payout: true,
                },
            }),
        ]);
        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalBets: Number(totals._sum.betAmount || 0),
            totalWinnings: Number(totals._sum.payout || 0),
        };
    }
    async findById(id) {
        return prisma_1.default.ticket.findUnique({
            where: { id },
            include: {
                game: {
                    include: { fairness: true },
                },
            },
        });
    }
}
exports.TicketRepository = TicketRepository;
