"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const game_service_engine_1 = require("./game.service.engine");
const game_service_1 = require("./game.service");
class SchedulerService {
    engine = new game_service_engine_1.GameEngineService();
    gameService = new game_service_1.GameService();
    async run() {
        try {
            const current = await prisma_1.default.$transaction(async (tx) => {
                return this.gameService.getOrCreateCurrentGame(tx);
            });
            if (!current) {
                return;
            }
            console.log(`[Scheduler] Drawing numbers for Classic Game Round #${current.roundNumber}...`);
            const result = await this.engine.settle(current.id);
            console.log(`[Scheduler] Settled Classic Game Round #${result.roundNumber} with draw numbers: [${result.drawNumbers.join(", ")}]. Total payouts: ${result.totalPayout}`);
            // Ensure next classic waiting round exists
            await prisma_1.default.$transaction(async (tx) => {
                await this.gameService.getOrCreateCurrentGame(tx);
            });
        }
        catch (err) {
            console.warn(`[Scheduler] Notice:`, err?.message || err);
        }
    }
}
exports.SchedulerService = SchedulerService;
