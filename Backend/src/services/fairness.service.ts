import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { FairnessRepository } from "../repositories/fairness.repository";
import { RevealedFairnessDto } from "../dtos/game/revealed-fairness.dto";

export class FairnessService {
  private repository = new FairnessRepository();

  generateServerSeed(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  hashServerSeed(serverSeed: string): string {
    return crypto.createHash("sha256").update(serverSeed).digest("hex");
  }

  generateClientSeed(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Generates 20 unique winning numbers between 1 and 80 deterministically.
   * Uses HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${counter}`).
   */
  generateDrawNumbers(serverSeed: string, clientSeed: string, nonce: number, poolSize = 80, drawCount = 20): number[] {
    const pool = new Set<number>();
    let counter = 0;

    while (pool.size < drawCount) {
      const hmac = crypto
        .createHmac("sha256", serverSeed)
        .update(`${clientSeed}:${nonce}:${counter}`)
        .digest("hex");

      for (let i = 0; i < hmac.length - 1 && pool.size < drawCount; i += 2) {
        const value = parseInt(hmac.substring(i, i + 2), 16);
        const number = (value % poolSize) + 1;
        pool.add(number);
      }

      counter++;
    }

    return Array.from(pool).sort((a, b) => a - b);
  }

  async commit(tx: Prisma.TransactionClient, gameId: string, providedClientSeed?: string) {
    const existing = await this.repository.findByGameId(gameId);
    if (existing) {
      return existing;
    }

    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.hashServerSeed(serverSeed);
    const clientSeed = providedClientSeed ?? this.generateClientSeed();
    const nonce = 0;

    return this.repository.create(tx, {
      gameId,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
    });
  }

  async getRecord(gameId: string) {
    return this.repository.findByGameId(gameId);
  }

  async reveal(gameId: string): Promise<RevealedFairnessDto> {
    const record = await this.repository.findByGameId(gameId);
    if (!record) {
      throw new Error(`Fairness record not found for game ${gameId}`);
    }

    return {
      gameId: record.gameId,
      serverSeed: record.serverSeed,
      serverSeedHash: record.serverSeedHash,
      clientSeed: record.clientSeed,
      nonce: record.nonce,
    };
  }

  async drawFor(gameId: string): Promise<number[]> {
    const record = await this.repository.findByGameId(gameId);
    if (!record) {
      throw new Error(`Fairness record not found for game ${gameId}`);
    }

    return this.generateDrawNumbers(
      record.serverSeed,
      record.clientSeed,
      record.nonce
    );
  }

  verifyDraw(serverSeed: string, clientSeed: string, nonce: number): {
    serverSeedHash: string;
    drawNumbers: number[];
  } {
    const serverSeedHash = this.hashServerSeed(serverSeed);
    const drawNumbers = this.generateDrawNumbers(serverSeed, clientSeed, nonce);

    return {
      serverSeedHash,
      drawNumbers,
    };
  }
}
