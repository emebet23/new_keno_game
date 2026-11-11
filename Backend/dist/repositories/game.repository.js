"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
class GameRepository {
    async findCurrent(tx) {
        const client = tx || prisma_1.default;
        return client.kenoGame.findFirst({
            where: {
                status: client_1.GameStatus.WAITING,
                mode: client_1.GameMode.CLASSIC,
            },
            orderBy: {
                createdAt: "asc",
            },
            include: {
                fairness: true,
            },
        });
    }
    async findLatest(tx) {
        const client = tx || prisma_1.default;
        return client.kenoGame.findFirst({
            orderBy: {
                roundNumber: "desc",
            },
        });
    }
    async create(tx, roundNumber, mode = client_1.GameMode.CLASSIC) {
        return tx.kenoGame.create({
            data: {
                roundNumber,
                mode,
                status: client_1.GameStatus.WAITING,
                drawNumbers: [],
            },
        });
    }
    async createInstantGame(tx, roundNumber) {
        return tx.kenoGame.create({
            data: {
                roundNumber,
                mode: client_1.GameMode.INSTANT,
                status: client_1.GameStatus.COMPLETED,
                drawNumbers: [],
            },
        });
    }
    async startDraw(tx, gameId) {
        return tx.kenoGame.update({
            where: { id: gameId },
            data: { status: client_1.GameStatus.DRAWING },
        });
    }
    async finish(tx, gameId, drawNumbers) {
        return tx.kenoGame.update({
            where: { id: gameId },
            data: {
                status: client_1.GameStatus.COMPLETED,
                drawNumbers,
                finishedAt: new Date(),
            },
        });
    }
    async cancel(tx, gameId) {
        return tx.kenoGame.update({
            where: { id: gameId },
            data: { status: client_1.GameStatus.CANCELLED },
        });
    }
    async findById(id) {
        return prisma_1.default.kenoGame.findUnique({
            where: { id },
            include: {
                tickets: true,
                fairness: true,
            },
        });
    }
    async history(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            prisma_1.default.kenoGame.findMany({
                skip,
                take: limit,
                orderBy: { roundNumber: "desc" },
                include: { fairness: true },
            }),
            prisma_1.default.kenoGame.count(),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}
exports.GameRepository = GameRepository;
