import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";
import { redisService } from "../services/redis.service";

export type PayoutTable = Record<string, Record<string, number>>;

export const DEFAULT_PAYOUT_TABLE: PayoutTable = {
  "1": { "1": 3.8 },
  "2": { "2": 15 },
  "3": { "2": 2, "3": 42 },
  "4": { "2": 1, "3": 10, "4": 100 },
  "5": { "3": 2, "4": 15, "5": 300 },
  "6": { "3": 1, "4": 7, "5": 70, "6": 1000 },
  "7": { "4": 3, "5": 20, "6": 200, "7": 4000 },
  "8": { "4": 2, "5": 10, "6": 90, "7": 750, "8": 10000 },
  "9": { "5": 5, "6": 40, "7": 300, "8": 2500, "9": 25000 },
  "10": { "0": 2, "5": 2, "6": 15, "7": 100, "8": 500, "9": 3000, "10": 100000 }
};

const SETTINGS_CACHE_KEY = "keno:settings";

export class SettingsRepository {
  async getSettings(tx?: Prisma.TransactionClient) {
    if (!tx) {
      const cached = await redisService.getJson<any>(SETTINGS_CACHE_KEY);
      if (cached) return cached;
    }

    const client = tx || prisma;
    let settings = await client.gameSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await client.gameSettings.create({
        data: {
          id: "default",
          numberPoolSize: 80,
          drawCount: 20,
          minPick: 1,
          maxPick: 10,
          minBet: new Prisma.Decimal(1),
          maxBet: new Prisma.Decimal(10000),
          payoutTable: DEFAULT_PAYOUT_TABLE,
          rtpPercentage: new Prisma.Decimal(95.0),
          houseEdge: new Prisma.Decimal(5.0),
          drawIntervalSec: 30,
        },
      });
    }

    if (!tx) {
      await redisService.setJson(SETTINGS_CACHE_KEY, settings, 600);
    }

    return settings;
  }

  async updateSettings(data: {
    numberPoolSize?: number;
    drawCount?: number;
    minPick?: number;
    maxPick?: number;
    minBet?: number;
    maxBet?: number;
    payoutTable?: PayoutTable;
    rtpPercentage?: number;
    houseEdge?: number;
    drawIntervalSec?: number;
  }) {
    const updated = await prisma.gameSettings.upsert({
      where: { id: "default" },
      update: {
        ...(data.numberPoolSize !== undefined && { numberPoolSize: data.numberPoolSize }),
        ...(data.drawCount !== undefined && { drawCount: data.drawCount }),
        ...(data.minPick !== undefined && { minPick: data.minPick }),
        ...(data.maxPick !== undefined && { maxPick: data.maxPick }),
        ...(data.minBet !== undefined && { minBet: new Prisma.Decimal(data.minBet) }),
        ...(data.maxBet !== undefined && { maxBet: new Prisma.Decimal(data.maxBet) }),
        ...(data.payoutTable !== undefined && { payoutTable: data.payoutTable }),
        ...(data.rtpPercentage !== undefined && { rtpPercentage: new Prisma.Decimal(data.rtpPercentage) }),
        ...(data.houseEdge !== undefined && { houseEdge: new Prisma.Decimal(data.houseEdge) }),
        ...(data.drawIntervalSec !== undefined && { drawIntervalSec: data.drawIntervalSec }),
      },
      create: {
        id: "default",
        numberPoolSize: data.numberPoolSize ?? 80,
        drawCount: data.drawCount ?? 20,
        minPick: data.minPick ?? 1,
        maxPick: data.maxPick ?? 10,
        minBet: new Prisma.Decimal(data.minBet ?? 1),
        maxBet: new Prisma.Decimal(data.maxBet ?? 10000),
        payoutTable: data.payoutTable ?? DEFAULT_PAYOUT_TABLE,
        rtpPercentage: new Prisma.Decimal(data.rtpPercentage ?? 95.0),
        houseEdge: new Prisma.Decimal(data.houseEdge ?? 5.0),
        drawIntervalSec: data.drawIntervalSec ?? 30,
      },
    });

    await redisService.del(SETTINGS_CACHE_KEY);
    return updated;
  }
}
