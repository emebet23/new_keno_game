"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FairnessService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fairness_repository_1 = require("../repositories/fairness.repository");
class FairnessService {
    repository = new fairness_repository_1.FairnessRepository();
    generateServerSeed() {
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    hashServerSeed(serverSeed) {
        return crypto_1.default.createHash("sha256").update(serverSeed).digest("hex");
    }
    generateClientSeed() {
        return crypto_1.default.randomBytes(16).toString("hex");
    }
    /**
     * Generates 20 unique winning numbers between 1 and 80 deterministically.
     * Uses HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${counter}`).
     */
    generateDrawNumbers(serverSeed, clientSeed, nonce, poolSize = 80, drawCount = 20) {
        const pool = new Set();
        let counter = 0;
        while (pool.size < drawCount) {
            const hmac = crypto_1.default
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
    async commit(tx, gameId, providedClientSeed) {
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
    async getRecord(gameId) {
        return this.repository.findByGameId(gameId);
    }
    async reveal(gameId) {
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
    async drawFor(gameId) {
        const record = await this.repository.findByGameId(gameId);
        if (!record) {
            throw new Error(`Fairness record not found for game ${gameId}`);
        }
        return this.generateDrawNumbers(record.serverSeed, record.clientSeed, record.nonce);
    }
    verifyDraw(serverSeed, clientSeed, nonce) {
        const serverSeedHash = this.hashServerSeed(serverSeed);
        const drawNumbers = this.generateDrawNumbers(serverSeed, clientSeed, nonce);
        return {
            serverSeedHash,
            drawNumbers,
        };
    }
}
exports.FairnessService = FairnessService;
