"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = exports.DEFAULT_PAYOUT_TABLE = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const redis_service_1 = require("../services/redis.service");
exports.DEFAULT_PAYOUT_TABLE = {
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
class SettingsRepository {
    async getSettings(tx) {
        if (!tx) {
            const cached = await redis_service_1.redisService.getJson(SETTINGS_CACHE_KEY);
            if (cached)
                return cached;
        }
        const client = tx || prisma_1.default;
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
                    minBet: new client_1.Prisma.Decimal(1),
                    maxBet: new client_1.Prisma.Decimal(10000),
                    payoutTable: exports.DEFAULT_PAYOUT_TABLE,
                    rtpPercentage: new client_1.Prisma.Decimal(95.0),
                    houseEdge: new client_1.Prisma.Decimal(5.0),
                    drawIntervalSec: 30,
                },
            });
        }
        if (!tx) {
            await redis_service_1.redisService.setJson(SETTINGS_CACHE_KEY, settings, 600);
        }
        return settings;
    }
    async updateSettings(data) {
        const updated = await prisma_1.default.gameSettings.upsert({
            where: { id: "default" },
            update: {
                ...(data.numberPoolSize !== undefined && { numberPoolSize: data.numberPoolSize }),
                ...(data.drawCount !== undefined && { drawCount: data.drawCount }),
                ...(data.minPick !== undefined && { minPick: data.minPick }),
                ...(data.maxPick !== undefined && { maxPick: data.maxPick }),
                ...(data.minBet !== undefined && { minBet: new client_1.Prisma.Decimal(data.minBet) }),
                ...(data.maxBet !== undefined && { maxBet: new client_1.Prisma.Decimal(data.maxBet) }),
                ...(data.payoutTable !== undefined && { payoutTable: data.payoutTable }),
                ...(data.rtpPercentage !== undefined && { rtpPercentage: new client_1.Prisma.Decimal(data.rtpPercentage) }),
                ...(data.houseEdge !== undefined && { houseEdge: new client_1.Prisma.Decimal(data.houseEdge) }),
                ...(data.drawIntervalSec !== undefined && { drawIntervalSec: data.drawIntervalSec }),
            },
            create: {
                id: "default",
                numberPoolSize: data.numberPoolSize ?? 80,
                drawCount: data.drawCount ?? 20,
                minPick: data.minPick ?? 1,
                maxPick: data.maxPick ?? 10,
                minBet: new client_1.Prisma.Decimal(data.minBet ?? 1),
                maxBet: new client_1.Prisma.Decimal(data.maxBet ?? 10000),
                payoutTable: data.payoutTable ?? exports.DEFAULT_PAYOUT_TABLE,
                rtpPercentage: new client_1.Prisma.Decimal(data.rtpPercentage ?? 95.0),
                houseEdge: new client_1.Prisma.Decimal(data.houseEdge ?? 5.0),
                drawIntervalSec: data.drawIntervalSec ?? 30,
            },
        });
        await redis_service_1.redisService.del(SETTINGS_CACHE_KEY);
        return updated;
    }
}
exports.SettingsRepository = SettingsRepository;
