import { Prisma, GameStatus, GameMode } from "@prisma/client";
import prisma from "../config/prisma";

export class GameRepository {
  async findCurrent(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.kenoGame.findFirst({
      where: {
        status: GameStatus.WAITING,
        mode: GameMode.CLASSIC,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        fairness: true,
      },
    });
  }

  async findLatest(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.kenoGame.findFirst({
      orderBy: {
        roundNumber: "desc",
      },
    });
  }

  async create(tx: Prisma.TransactionClient, roundNumber: number, mode: GameMode = GameMode.CLASSIC) {
    return tx.kenoGame.create({
      data: {
        roundNumber,
        mode,
        status: GameStatus.WAITING,
        drawNumbers: [],
      },
    });
  }

  async createInstantGame(tx: Prisma.TransactionClient, roundNumber: number) {
    return tx.kenoGame.create({
      data: {
        roundNumber,
        mode: GameMode.INSTANT,
        status: GameStatus.COMPLETED,
        drawNumbers: [],
      },
    });
  }

  async startDraw(tx: Prisma.TransactionClient, gameId: string) {
    return tx.kenoGame.update({
      where: { id: gameId },
      data: { status: GameStatus.DRAWING },
    });
  }

  async finish(tx: Prisma.TransactionClient, gameId: string, drawNumbers: number[]) {
    return tx.kenoGame.update({
      where: { id: gameId },
      data: {
        status: GameStatus.COMPLETED,
        drawNumbers,
        finishedAt: new Date(),
      },
    });
  }

  async cancel(tx: Prisma.TransactionClient, gameId: string) {
    return tx.kenoGame.update({
      where: { id: gameId },
      data: { status: GameStatus.CANCELLED },
    });
  }

  async findById(id: string) {
    return prisma.kenoGame.findUnique({
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
      prisma.kenoGame.findMany({
        skip,
        take: limit,
        orderBy: { roundNumber: "desc" },
        include: { fairness: true },
      }),
      prisma.kenoGame.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
