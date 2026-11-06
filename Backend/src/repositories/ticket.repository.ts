import { Prisma, TicketStatus, GameMode } from "@prisma/client";
import prisma from "../config/prisma";

export interface CreateTicketData {
  userId: string;
  gameId: string;
  mode?: GameMode;
  selectedNumbers: number[];
  betAmount: number | Prisma.Decimal;
}

export class TicketRepository {
  async create(tx: Prisma.TransactionClient, data: CreateTicketData) {
    return tx.ticket.create({
      data: {
        userId: data.userId,
        gameId: data.gameId,
        mode: data.mode ?? GameMode.CLASSIC,
        selectedNumbers: data.selectedNumbers,
        betAmount: new Prisma.Decimal(data.betAmount),
        status: TicketStatus.PENDING,
      },
    });
  }

  async getByGame(tx: Prisma.TransactionClient, gameId: string) {
    return tx.ticket.findMany({
      where: { gameId },
    });
  }

  async findByGameId(tx: Prisma.TransactionClient, gameId: string) {
    return tx.ticket.findMany({
      where: { gameId },
    });
  }

  async settle(
    tx: Prisma.TransactionClient,
    ticketId: string,
    data: {
      matches: number;
      multiplier: number | Prisma.Decimal;
      payout: number | Prisma.Decimal;
      status: TicketStatus;
    }
  ) {
    return tx.ticket.update({
      where: { id: ticketId },
      data: {
        matches: data.matches,
        multiplier: new Prisma.Decimal(data.multiplier),
        payout: new Prisma.Decimal(data.payout),
        status: data.status,
      },
    });
  }

  async findByUserId(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total, totals] = await Promise.all([
      prisma.ticket.findMany({
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
      prisma.ticket.count({ where: { userId } }),
      prisma.ticket.aggregate({
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

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        game: {
          include: { fairness: true },
        },
      },
    });
  }
}
