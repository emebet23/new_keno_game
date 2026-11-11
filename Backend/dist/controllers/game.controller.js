"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const game_service_engine_1 = require("../services/game.service.engine");
const game_service_1 = require("../services/game.service");
const ticket_service_1 = require("../services/ticket.service");
const fairness_service_1 = require("../services/fairness.service");
const settings_repository_1 = require("../repositories/settings.repository");
const prisma_1 = __importDefault(require("../config/prisma"));
const play_game_dto_1 = require("../dtos/game/play-game.dto");
const response_1 = require("../utils/response");
const zod_1 = require("zod");
const ProvablyFairQuerySchema = zod_1.z.object({
    serverSeed: zod_1.z.string().optional(),
    clientSeed: zod_1.z.string().optional(),
    nonce: zod_1.z.coerce.number().optional(),
    gameId: zod_1.z.string().optional(),
});
class GameController {
    engine = new game_service_engine_1.GameEngineService();
    gameService = new game_service_1.GameService();
    ticketService = new ticket_service_1.TicketService();
    fairnessService = new fairness_service_1.FairnessService();
    settingsRepo = new settings_repository_1.SettingsRepository();
    play = async (req, res, next) => {
        try {
            const dto = play_game_dto_1.PlayGameSchema.parse(req.body);
            const result = await this.engine.play(req.user.userId, dto);
            return res.status(201).json({
                success: true,
                message: "Ticket placed successfully",
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    };
    getCurrentDraw = async (req, res, next) => {
        try {
            const game = await this.gameService.getOrCreateCurrentGame();
            let fairness = await this.fairnessService.getRecord(game.id);
            if (!fairness) {
                fairness = await prisma_1.default.$transaction((tx) => this.fairnessService.commit(tx, game.id));
            }
            const settings = await this.settingsRepo.getSettings();
            return (0, response_1.success)(res, {
                gameId: game.id,
                roundNumber: game.roundNumber,
                mode: game.mode,
                status: game.status,
                startedAt: game.startedAt,
                drawIntervalSec: Number(settings.drawIntervalSec) || 30,
                minBet: Number(settings.minBet) || 1,
                maxBet: Number(settings.maxBet) || 10000,
                serverSeedHash: fairness.serverSeedHash,
                clientSeed: fairness.clientSeed,
                nonce: fairness.nonce,
            });
        }
        catch (err) {
            next(err);
        }
    };
    getResult = async (req, res, next) => {
        try {
            const id = String(req.params.id);
            const game = await this.gameService.getById(id);
            if (game) {
                return (0, response_1.success)(res, game);
            }
            const ticket = await this.ticketService.getById(id);
            if (ticket) {
                return (0, response_1.success)(res, ticket);
            }
            return res.status(404).json({ success: false, message: "Game or Ticket result not found" });
        }
        catch (err) {
            next(err);
        }
    };
    getHistory = async (req, res, next) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const history = await this.ticketService.getUserTickets(req.user.userId, page, limit);
            return (0, response_1.success)(res, history);
        }
        catch (err) {
            next(err);
        }
    };
    getProvablyFair = async (req, res, next) => {
        try {
            const query = ProvablyFairQuerySchema.parse(req.query);
            if (query.serverSeed && query.clientSeed !== undefined && query.nonce !== undefined) {
                const verification = this.fairnessService.verifyDraw(query.serverSeed, query.clientSeed, query.nonce);
                return (0, response_1.success)(res, verification, "Draw verification completed");
            }
            if (query.gameId) {
                const game = await this.gameService.getById(query.gameId);
                if (!game) {
                    return res.status(404).json({ success: false, message: "Game not found" });
                }
                const isSettled = game.status === "COMPLETED" || game.status === "CANCELLED";
                if (isSettled) {
                    const record = await this.fairnessService.getRecord(query.gameId);
                    if (!record) {
                        return res.status(404).json({ success: false, message: "Fairness record not found" });
                    }
                    return (0, response_1.success)(res, record);
                }
                const record = await this.fairnessService.getRecord(query.gameId);
                return (0, response_1.success)(res, {
                    gameId: query.gameId,
                    serverSeedHash: record?.serverSeedHash,
                    clientSeed: record?.clientSeed,
                    nonce: record?.nonce,
                });
            }
            return res.status(400).json({
                success: false,
                message: "Provide either gameId or (serverSeed, clientSeed, nonce)",
            });
        }
        catch (err) {
            next(err);
        }
    };
    getQuickPick = async (req, res, next) => {
        try {
            const count = Math.min(Math.max(Number(req.query.count) || 5, 1), 10);
            const picked = new Set();
            while (picked.size < count) {
                const randomNum = Math.floor(Math.random() * 80) + 1;
                picked.add(randomNum);
            }
            const numbers = Array.from(picked).sort((a, b) => a - b);
            return (0, response_1.success)(res, { count, numbers }, "Quick pick generated");
        }
        catch (err) {
            next(err);
        }
    };
    getSettledGames = async (_req, res, next) => {
        try {
            const history = await this.gameService.getHistory(1, 10);
            const settled = history.items.filter((g) => g.status === "COMPLETED" || g.status === "CANCELLED");
            return (0, response_1.success)(res, settled);
        }
        catch (err) {
            next(err);
        }
    };
    settle = async (req, res, next) => {
        try {
            const { gameId } = req.body;
            const result = await this.engine.settle(gameId);
            return (0, response_1.success)(res, result, "Game settled successfully");
        }
        catch (err) {
            next(err);
        }
    };
}
exports.GameController = GameController;
