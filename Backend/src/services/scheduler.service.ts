import prisma from "../config/prisma";
import { GameEngineService } from "./game.service.engine";
import { GameService } from "./game.service";

export class SchedulerService {
  private engine = new GameEngineService();
  private gameService = new GameService();

  async run() {
    const current = await prisma.$transaction(async (tx) => {
      return this.gameService.getOrCreateCurrentGame(tx);
    });

    if (!current) {
      return;
    }

    try {
      console.log(`[Scheduler] Drawing numbers for Classic Game Round #${current.roundNumber}...`);
      const result = await this.engine.settle(current.id);
      console.log(
        `[Scheduler] Settled Classic Game Round #${result.roundNumber} with draw numbers: [${result.drawNumbers.join(", ")}]. Total payouts: ${result.totalPayout}`
      );

      // Ensure next classic waiting round exists
      await prisma.$transaction(async (tx) => {
        await this.gameService.getOrCreateCurrentGame(tx);
      });
    } catch (err) {
      console.error(`[Scheduler] Failed to settle round #${current.roundNumber}:`, err);
    }
  }
}
