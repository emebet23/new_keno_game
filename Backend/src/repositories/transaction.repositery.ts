import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import prisma from "../config/prisma";

export interface CreateTransactionData {
  userId: string;
  type: TransactionType;
  status?: TransactionStatus;
  amount: number | Prisma.Decimal;
  balanceBefore: number | Prisma.Decimal;
  balanceAfter: number | Prisma.Decimal;
  reference?: string;
}

export class TransactionRepository {
  async create(tx: Prisma.TransactionClient, dto: CreateTransactionData) {
    return tx.transaction.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        status: dto.status ?? TransactionStatus.SUCCESS,
        amount: new Prisma.Decimal(dto.amount),
        balanceBefore: new Prisma.Decimal(dto.balanceBefore),
        balanceAfter: new Prisma.Decimal(dto.balanceAfter),
        reference: dto.reference,
      },
    });
  }

  async history(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
