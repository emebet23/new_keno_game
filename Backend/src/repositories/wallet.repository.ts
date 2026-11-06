import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

export class WalletRepository {
  async findByUserId(userId: string) {
    return prisma.wallet.findUnique({
      where: { userId },
    });
  }

  async findByUserIdTx(tx: Prisma.TransactionClient, userId: string) {
    return tx.wallet.findUnique({
      where: { userId },
    });
  }

  async update(
    tx: Prisma.TransactionClient,
    userId: string,
    playBalance: number | Prisma.Decimal,
    mainBalance: number | Prisma.Decimal
  ) {
    return tx.wallet.update({
      where: { userId },
      data: {
        playBalance: new Prisma.Decimal(playBalance),
        mainBalance: new Prisma.Decimal(mainBalance),
      },
    });
  }
}