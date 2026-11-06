import { Router, Request, Response } from "express";
import prisma from "../../config/prisma";
import { TransactionType } from "@prisma/client";
import { PaymentService } from "../services/payment.service";
import { WithdrawalService } from "../services/withdrawal.service";
import redisClient from "../../config/redis";

const router = Router();

const PRIZE_POOL_FACTOR = (Number(process.env.PRIZE_POOL_PERCENTAGE) || 80) / 100;

router.get("/wallet/balance", async (req: Request, res: Response) => {
  try {
    const telegramId = req.query.telegramId as string;
    if (!telegramId) {
      return res.status(400).json({ error: "Missing telegramId" });
    }

    const user = await PaymentService.findOrCreateUser(telegramId);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    const gamesPlayed = await prisma.transaction.count({
      where: {
        walletId: wallet?.id ?? "",
        type: TransactionType.BET,
      },
    });

    const gamesWon = await prisma.ticket.count({
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
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

router.get("/wallet/history", async (req: Request, res: Response) => {
  try {
    const telegramId = req.query.telegramId as string;
    if (!telegramId) {
      return res.status(400).json({ error: "Missing telegramId" });
    }

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      return res.json({ transactions: [] });
    }

    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

router.get("/games/history", async (req: Request, res: Response) => {
  try {
    const telegramId = req.query.telegramId as string;
    if (!telegramId) {
      return res.status(400).json({ error: "Missing telegramId" });
    }

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (!user) {
      return res.json({ games: [] });
    }

    const tickets = await prisma.ticket.findMany({
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
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

router.post("/wallet/deposit", async (req: Request, res: Response) => {
  try {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    if (Number(amount) < 20) {
      return res.status(400).json({ error: "Minimum deposit amount is 20 ETB" });
    }

    const result = await PaymentService.createManualDepositRequest(
      telegramId,
      Number(amount),
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

router.post("/wallet/manual-deposit", async (req: Request, res: Response) => {
  try {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const result = await PaymentService.createManualDepositRequest(
      telegramId,
      Number(amount),
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/wallet/withdraw", async (req: Request, res: Response) => {
  try {
    const { telegramId, amount, phone } = req.body;
    if (!telegramId || !amount || !phone) {
      return res.status(400).json({ error: "Missing parameters (telegramId, amount, phone)" });
    }

    if (Number(amount) < 100) {
      return res.status(400).json({ error: "Minimum withdrawal amount is 100 ETB" });
    }

    const result = await WithdrawalService.requestWithdrawal(
      telegramId,
      Number(amount),
      phone,
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

router.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { firstName: true, username: true, telegramId: true },
      where: {
        tickets: { some: { status: "WON" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

router.get("/games/:gameId/stats", async (req: Request, res: Response) => {
  try {
    const gameId = req.params.gameId as string;

    const roomKey = `room:${gameId}`;
    const playersSetKey = `room:${gameId}:players_set`;
    const calledKey = `game:${gameId}:called`;

    const [room, playersCount, calledCount, game] = await Promise.all([
      redisClient.hgetall(roomKey).catch(() => ({})),
      redisClient.scard(playersSetKey).catch(() => 0),
      redisClient.scard(calledKey).catch(() => 0),
      prisma.kenoGame.findUnique({ where: { id: gameId } }).catch(() => null),
    ]);

    const roomObj = room as Record<string, string>;
    if (!game && (!roomObj || Object.keys(roomObj).length === 0)) {
      return res.status(404).json({ error: "Game not found" });
    }

    const drawNumbers = (game as any)?.drawNumbers || [];
    const shortId = gameId.substring(0, 6).toUpperCase();

    res.json({
      gameId,
      shortId,
      roundNumber: (game as any)?.roundNumber || null,
      status: roomObj?.status || (game as any)?.status || "WAITING",
      drawNumbers,
      lastNumber: drawNumbers.length > 0 ? drawNumbers[drawNumbers.length - 1] : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
