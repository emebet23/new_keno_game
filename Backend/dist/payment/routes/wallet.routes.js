"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
const payment_service_1 = require("../services/payment.service");
const withdrawal_service_1 = require("../services/withdrawal.service");
const redis_1 = __importDefault(require("../../config/redis"));
const router = (0, express_1.Router)();
const PRIZE_POOL_FACTOR = (Number(process.env.PRIZE_POOL_PERCENTAGE) || 80) / 100;
router.get("/wallet/balance", async (req, res) => {
    try {
        const telegramId = req.query.telegramId;
        if (!telegramId) {
            return res.status(400).json({ error: "Missing telegramId" });
        }
        const user = await payment_service_1.PaymentService.findOrCreateUser(telegramId);
        const wallet = await prisma_1.default.wallet.findUnique({
            where: { userId: user.id },
        });
        const gamesPlayed = await prisma_1.default.transaction.count({
            where: {
                walletId: wallet?.id ?? "",
                type: client_1.TransactionType.BET,
            },
        });
        const gamesWon = await prisma_1.default.ticket.count({
            where: {
                userId: user.id,
                status: "WON",
            },
        });
        res.json({
            mainWallet: Number(wallet?.mainBalance ?? 0),
            playWallet: Number(wallet?.playBalance ?? 0),
            phoneNumber: "Not Registered",
            name: user.firstName || user.username || "Player",
            gamesWon,
            gamesPlayed,
            totalInvited: 0,
            totalEarnings: 0,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
router.get("/wallet/history", async (req, res) => {
    try {
        const telegramId = req.query.telegramId;
        if (!telegramId) {
            return res.status(400).json({ error: "Missing telegramId" });
        }
        const user = await prisma_1.default.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const wallet = await prisma_1.default.wallet.findUnique({
            where: { userId: user.id },
        });
        if (!wallet) {
            return res.json({ transactions: [] });
        }
        const transactions = await prisma_1.default.transaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
        res.json({ transactions });
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
router.get("/games/history", async (req, res) => {
    try {
        const telegramId = req.query.telegramId;
        if (!telegramId) {
            return res.status(400).json({ error: "Missing telegramId" });
        }
        const user = await prisma_1.default.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
        if (!user) {
            return res.json({ games: [] });
        }
        const tickets = await prisma_1.default.ticket.findMany({
            where: {
                userId: user.id,
                status: { in: ["WON", "LOST"] },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { game: true },
        });
        const gamesList = tickets.map((t) => ({
            gameId: t.gameId.substring(0, 6).toUpperCase(),
            roundNumber: t.game.roundNumber,
            date: t.game.finishedAt || t.createdAt,
            bet: Number(t.betAmount),
            won: t.status === "WON",
            payout: t.status === "WON" ? Number(t.payout) : 0,
            matches: t.matches,
            selectedNumbers: t.selectedNumbers,
        }));
        res.json({ games: gamesList });
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
router.post("/wallet/deposit", async (req, res) => {
    try {
        const { telegramId, amount } = req.body;
        if (!telegramId || !amount) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        if (Number(amount) < 20) {
            return res.status(400).json({ error: "Minimum deposit amount is 20 ETB" });
        }
        const result = await payment_service_1.PaymentService.createManualDepositRequest(telegramId, Number(amount));
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
router.post("/wallet/manual-deposit", async (req, res) => {
    try {
        const { telegramId, amount } = req.body;
        if (!telegramId || !amount) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        const result = await payment_service_1.PaymentService.createManualDepositRequest(telegramId, Number(amount));
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post("/wallet/withdraw", async (req, res) => {
    try {
        const { telegramId, amount, phone } = req.body;
        if (!telegramId || !amount || !phone) {
            return res.status(400).json({ error: "Missing parameters (telegramId, amount, phone)" });
        }
        if (Number(amount) < 100) {
            return res.status(400).json({ error: "Minimum withdrawal amount is 100 ETB" });
        }
        const result = await withdrawal_service_1.WithdrawalService.requestWithdrawal(telegramId, Number(amount), phone);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
router.get("/leaderboard", async (_req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            select: { firstName: true, username: true, telegramId: true },
            where: {
                tickets: { some: { status: "WON" } },
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
        });
        res.json({ users });
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
router.get("/games/:gameId/stats", async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const roomKey = `room:${gameId}`;
        const playersSetKey = `room:${gameId}:players_set`;
        const calledKey = `game:${gameId}:called`;
        const [room, playersCount, calledCount, game] = await Promise.all([
            redis_1.default.hgetall(roomKey).catch(() => ({})),
            redis_1.default.scard(playersSetKey).catch(() => 0),
            redis_1.default.scard(calledKey).catch(() => 0),
            prisma_1.default.kenoGame.findUnique({ where: { id: gameId } }).catch(() => null),
        ]);
        const roomObj = room;
        if (!game && (!roomObj || Object.keys(roomObj).length === 0)) {
            return res.status(404).json({ error: "Game not found" });
        }
        const drawNumbers = game?.drawNumbers || [];
        const shortId = gameId.substring(0, 6).toUpperCase();
        res.json({
            gameId,
            shortId,
            roundNumber: game?.roundNumber || null,
            status: roomObj?.status || game?.status || "WAITING",
            drawNumbers,
            lastNumber: drawNumbers.length > 0 ? drawNumbers[drawNumbers.length - 1] : null,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal Error" });
    }
});
exports.default = router;
