import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";

export class FairnessRepository {
  async create(
    tx: Prisma.TransactionClient,
    data: { gameId: string; serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number },
  ) {
    return tx.fairnessRecord.create({ data });
  }

  async findByGameId(gameId: string) {
    return prisma.fairnessRecord.findUnique({ where: { gameId } });
  }
}
