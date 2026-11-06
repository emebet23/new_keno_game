import { FairnessService } from "./fairness.service";
import { Prisma, GameMode } from "@prisma/client";
import { GameRepository } from "../repositories/game.repository";
import prisma from "../config/prisma";

export class GameService {
  private repository = new GameRepository();
  private fairness = new FairnessService();

  async getOrCreateCurrentGame(tx?: Prisma.TransactionClient) {
    let game = await this.repository.findCurrent(tx);
    if (game) {
      return game;
    }

    if (tx) {
      const latest = await this.repository.findLatest(tx);
      const nextRound = latest ? latest.roundNumber + 1 : 1;
      const newGame = await this.repository.create(tx, nextRound);
      await this.fairness.commit(tx, newGame.id);
      return newGame;
    }

    return prisma.$transaction(async (innerTx) => {
      const latest = await this.repository.findLatest(innerTx);
      const nextRound = latest ? latest.roundNumber + 1 : 1;
      const newGame = await this.repository.create(innerTx, nextRound);
      await this.fairness.commit(innerTx, newGame.id);
      return newGame;
    });
  }

  async getLatest(tx?: Prisma.TransactionClient) {
    return this.repository.findLatest(tx);
  }

  async createInstantGame(tx: Prisma.TransactionClient, roundNumber: number) {
    return this.repository.createInstantGame(tx, roundNumber);
  }

  async startDraw(tx: Prisma.TransactionClient, gameId: string) {
    return this.repository.startDraw(tx, gameId);
  }

  async finish(tx: Prisma.TransactionClient, gameId: string, draw: number[]) {
    return this.repository.finish(tx, gameId, draw);
  }

  async cancel(tx: Prisma.TransactionClient, gameId: string) {
    return this.repository.cancel(tx, gameId);
  }

  async getHistory(page = 1, limit = 20) {
    return this.repository.history(page, limit);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }
}
