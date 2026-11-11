"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const fairness_service_1 = require("./fairness.service");
const game_repository_1 = require("../repositories/game.repository");
const prisma_1 = __importDefault(require("../config/prisma"));
class GameService {
    repository = new game_repository_1.GameRepository();
    fairness = new fairness_service_1.FairnessService();
    async getOrCreateCurrentGame(tx) {
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
        return prisma_1.default.$transaction(async (innerTx) => {
            const latest = await this.repository.findLatest(innerTx);
            const nextRound = latest ? latest.roundNumber + 1 : 1;
            const newGame = await this.repository.create(innerTx, nextRound);
            await this.fairness.commit(innerTx, newGame.id);
            return newGame;
        });
    }
    async getLatest(tx) {
        return this.repository.findLatest(tx);
    }
    async createInstantGame(tx, roundNumber) {
        return this.repository.createInstantGame(tx, roundNumber);
    }
    async startDraw(tx, gameId) {
        return this.repository.startDraw(tx, gameId);
    }
    async finish(tx, gameId, draw) {
        return this.repository.finish(tx, gameId, draw);
    }
    async cancel(tx, gameId) {
        return this.repository.cancel(tx, gameId);
    }
    async getHistory(page = 1, limit = 20) {
        return this.repository.history(page, limit);
    }
    async getById(id) {
        return this.repository.findById(id);
    }
}
exports.GameService = GameService;
