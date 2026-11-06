import { Request, Response, NextFunction } from "express";
import { GameEngineService } from "../services/game.service.engine";
import { GameService } from "../services/game.service";
import { TicketService } from "../services/ticket.service";
import { FairnessService } from "../services/fairness.service";
import { SettingsRepository } from "../repositories/settings.repository";
import prisma from "../config/prisma";
import { PlayGameSchema } from "../dtos/game/play-game.dto";
import { success } from "../utils/response";
import { z } from "zod";

const ProvablyFairQuerySchema = z.object({
  serverSeed: z.string().optional(),
  clientSeed: z.string().optional(),
  nonce: z.coerce.number().optional(),
  gameId: z.string().optional(),
});

export class GameController {
  private engine = new GameEngineService();
  private gameService = new GameService();
  private ticketService = new TicketService();
  private fairnessService = new FairnessService();
  private settingsRepo = new SettingsRepository();

  play = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = PlayGameSchema.parse(req.body);
      const result = await this.engine.play(req.user!.userId, dto);
      return res.status(201).json({
        success: true,
        message: "Ticket placed successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getCurrentDraw = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const game = await this.gameService.getOrCreateCurrentGame();
      let fairness = await this.fairnessService.getRecord(game.id);
      if (!fairness) {
        fairness = await prisma.$transaction((tx) => this.fairnessService.commit(tx, game.id));
      }

      const settings = await this.settingsRepo.getSettings();

      return success(res, {
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
    } catch (err) {
      next(err);
    }
  };

  getResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const game = await this.gameService.getById(id);

      if (game) {
        return success(res, game);
      }

      const ticket = await this.ticketService.getById(id);
      if (ticket) {
        return success(res, ticket);
      }

      return res.status(404).json({ success: false, message: "Game or Ticket result not found" });
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const history = await this.ticketService.getUserTickets(req.user!.userId, page, limit);
      return success(res, history);
    } catch (err) {
      next(err);
    }
  };

  getProvablyFair = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ProvablyFairQuerySchema.parse(req.query);

      if (query.serverSeed && query.clientSeed !== undefined && query.nonce !== undefined) {
        const verification = this.fairnessService.verifyDraw(query.serverSeed, query.clientSeed, query.nonce);
        return success(res, verification, "Draw verification completed");
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
          return success(res, record);
        }

        const record = await this.fairnessService.getRecord(query.gameId);
        return success(res, {
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
    } catch (err) {
      next(err);
    }
  };

  getQuickPick = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = Math.min(Math.max(Number(req.query.count) || 5, 1), 10);
      const picked = new Set<number>();

      while (picked.size < count) {
        const randomNum = Math.floor(Math.random() * 80) + 1;
        picked.add(randomNum);
      }

      const numbers = Array.from(picked).sort((a, b) => a - b);
      return success(res, { count, numbers }, "Quick pick generated");
    } catch (err) {
      next(err);
    }
  };

  getSettledGames = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await this.gameService.getHistory(1, 10);
      const settled = history.items.filter(
        (g: any) => g.status === "COMPLETED" || g.status === "CANCELLED"
      );
      return success(res, settled);
    } catch (err) {
      next(err);
    }
  };

  settle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId } = req.body;
      const result = await this.engine.settle(gameId);
      return success(res, result, "Game settled successfully");
    } catch (err) {
      next(err);
    }
  };
}
