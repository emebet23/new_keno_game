import prisma from "../config/prisma";
import { GameMode, TicketStatus } from "@prisma/client";

import { WalletService } from "./wallet.service";
import { TicketService } from "./ticket.service";
import { GameService } from "./game.service";
import { PayoutService } from "./payout.service";
import { FairnessService } from "./fairness.service";
import { TransactionService } from "./transaction.service";
import { SettingsRepository } from "../repositories/settings.repository";

import { PlayGameDto, SingleTicketDto } from "../dtos/game/play-game.dto";
import { TicketAcceptedDto } from "../dtos/game/ticket-accepted.dto";
import { TicketSettledDto } from "../dtos/game/ticket-settled.dto";
import { GameSettledDto } from "../dtos/game/game-settled.dto";

import { SOCKET_EVENTS } from "../socket/events";
import { emitBroadcast, emitToUser } from "../socket/socket";

export class GameEngineService {
  private wallet = new WalletService();
  private ticket = new TicketService();
  private game = new GameService();
  private payout = new PayoutService();
  private fairness = new FairnessService();
  private transaction = new TransactionService();
  private settingsRepo = new SettingsRepository();

  async play(userId: string, dto: PlayGameDto) {
    const mode = dto.mode ?? GameMode.INSTANT;
    const clientSeed = dto.clientSeed;
    const ticketsToPlay: SingleTicketDto[] = dto.tickets && dto.tickets.length > 0
      ? dto.tickets
      : [{ bet: dto.bet!, selectedNumbers: dto.selectedNumbers! }];

    const settings = await this.settingsRepo.getSettings();
    const minBet = Number(settings.minBet);
    const maxBet = Number(settings.maxBet);

    for (const t of ticketsToPlay) {
      if (t.bet < minBet || t.bet > maxBet) {
        throw new Error(`Bet amount must be between ${minBet} and ${maxBet}`);
      }
    }

    if (mode === GameMode.INSTANT) {
      return this.playInstant(userId, ticketsToPlay, clientSeed);
    } else {
      return this.playClassic(userId, ticketsToPlay, clientSeed);
    }
  }

  private async playInstant(userId: string, tickets: SingleTicketDto[], clientSeed?: string) {
    return prisma.$transaction(async (tx) => {
      const latest = await this.game.getLatest(tx);
      const nextRound = latest ? latest.roundNumber + 1 : 1;

      const game = await this.game.createInstantGame(tx, nextRound);
      const fairnessRecord = await this.fairness.commit(tx, game.id, clientSeed);

      const drawNumbers = this.fairness.generateDrawNumbers(
        fairnessRecord.serverSeed,
        fairnessRecord.clientSeed,
        fairnessRecord.nonce
      );

      const settledTickets: TicketSettledDto[] = [];
      let totalPayout = 0;

      for (const t of tickets) {
        const walletResult = await this.wallet.deductBet(tx, userId, t.bet);

        await this.transaction.bet(
          tx,
          userId,
          t.bet,
          walletResult.balanceBefore,
          walletResult.balanceAfter,
          `instant-${game.id}`
        );

        const matches = countMatches(t.selectedNumbers, drawNumbers);
        const multiplier = await this.payout.getMultiplier(t.selectedNumbers.length, matches);
        const payoutAmount = t.bet * multiplier;
        const status = payoutAmount > 0 ? TicketStatus.WON : TicketStatus.LOST;

        const ticketRecord = await tx.ticket.create({
          data: {
            userId,
            gameId: game.id,
            mode: GameMode.INSTANT,
            selectedNumbers: t.selectedNumbers,
            betAmount: t.bet,
            matches,
            multiplier,
            payout: payoutAmount,
            status,
          },
        });

        if (payoutAmount > 0) {
          const winResult = await this.wallet.creditWin(tx, userId, payoutAmount);
          await this.transaction.win(
            tx,
            userId,
            payoutAmount,
            winResult.balanceBefore,
            winResult.balanceAfter,
            ticketRecord.id
          );
          totalPayout += payoutAmount;
        }

        settledTickets.push({
          ticketId: ticketRecord.id,
          selectedNumbers: t.selectedNumbers,
          drawNumbers,
          matches,
          multiplier,
          betAmount: t.bet,
          payout: payoutAmount,
          won: payoutAmount > 0,
        });
      }

      await this.game.finish(tx, game.id, drawNumbers);

      return {
        gameId: game.id,
        roundNumber: game.roundNumber,
        mode: GameMode.INSTANT,
        drawNumbers,
        totalTickets: tickets.length,
        settledTickets,
        totalPayout,
        fairness: {
          serverSeedHash: fairnessRecord.serverSeedHash,
          serverSeed: fairnessRecord.serverSeed,
          clientSeed: fairnessRecord.clientSeed,
          nonce: fairnessRecord.nonce,
        },
      };
    });
  }

  private async playClassic(userId: string, tickets: SingleTicketDto[], clientSeed?: string): Promise<TicketAcceptedDto[]> {
    return prisma.$transaction(async (tx) => {
      const game = await this.game.getOrCreateCurrentGame(tx);
      await this.fairness.commit(tx, game.id, clientSeed);

      const acceptedTickets: TicketAcceptedDto[] = [];

      for (const t of tickets) {
        const walletResult = await this.wallet.deductBet(tx, userId, t.bet);

        await this.transaction.bet(
          tx,
          userId,
          t.bet,
          walletResult.balanceBefore,
          walletResult.balanceAfter,
          `classic-${game.id}`
        );

        const ticketRecord = await this.ticket.create(tx, {
          userId,
          gameId: game.id,
          mode: GameMode.CLASSIC,
          selectedNumbers: t.selectedNumbers,
          betAmount: t.bet,
        });

        acceptedTickets.push({
          ticketId: ticketRecord.id,
          gameId: game.id,
          roundNumber: game.roundNumber,
          selectedNumbers: t.selectedNumbers,
          betAmount: t.bet,
          status: "accepted",
        });
      }

      return acceptedTickets.length === 1 ? acceptedTickets[0] as any : acceptedTickets as any;
    });
  }

  async settle(gameId: string): Promise<GameSettledDto> {
    const pendingGame = await this.game.getById(gameId);
    if (pendingGame) {
      emitBroadcast(SOCKET_EVENTS.GAME_STARTED, {
        gameId,
        roundNumber: pendingGame.roundNumber,
      });
    }

    const { result, byUser } = await prisma.$transaction(async (tx) => {
      const drawNumbers = await this.fairness.drawFor(gameId);
      const game = await this.game.startDraw(tx, gameId);
      const tickets = await this.ticket.getByGame(tx, gameId);

      const settledTickets: TicketSettledDto[] = [];
      const byUser = new Map<string, TicketSettledDto[]>();
      let totalPayout = 0;

      for (const t of tickets) {
        const selected = t.selectedNumbers as number[];
        const matches = countMatches(selected, drawNumbers);
        const multiplier = await this.payout.getMultiplier(selected.length, matches);
        const payout = Number(t.betAmount) * multiplier;
        const status = payout > 0 ? TicketStatus.WON : TicketStatus.LOST;

        await this.ticket.settle(tx, t.id, {
          matches,
          multiplier,
          payout,
          status,
        });

        if (payout > 0) {
          const winResult = await this.wallet.creditWin(tx, t.userId, payout);
          await this.transaction.win(
            tx,
            t.userId,
            payout,
            winResult.balanceBefore,
            winResult.balanceAfter,
            t.id
          );
          totalPayout += payout;
        }

        const settledTicket: TicketSettledDto = {
          ticketId: t.id,
          selectedNumbers: selected,
          drawNumbers,
          matches,
          multiplier,
          betAmount: Number(t.betAmount),
          payout,
          won: payout > 0,
        };

        settledTickets.push(settledTicket);

        const userTickets = byUser.get(t.userId) ?? [];
        userTickets.push(settledTicket);
        byUser.set(t.userId, userTickets);
      }

      await this.game.finish(tx, gameId, drawNumbers);

      const fairnessRecord = await this.fairness.getRecord(gameId);

      return {
        result: {
          gameId: game.id,
          roundNumber: game.roundNumber,
          drawNumbers,
          totalTickets: tickets.length,
          settledTickets,
          totalPayout,
          serverSeed: fairnessRecord?.serverSeed,
          serverSeedHash: fairnessRecord?.serverSeedHash,
        },
        byUser,
      };
    });

    // Broadcast the public winning numbers so every connected client sees
    // the classic draw live (feeds the countdown + results feed).
    emitBroadcast(SOCKET_EVENTS.DRAW_NUMBERS, {
      gameId: result.gameId,
      roundNumber: result.roundNumber,
      drawNumbers: result.drawNumbers,
    });

    // Personalized live reveal + wallet sync for every player with a ticket.
    for (const [userId, userTickets] of byUser.entries()) {
      const playerPayout = userTickets.reduce((sum, t) => sum + t.payout, 0);

      emitToUser(userId, SOCKET_EVENTS.GAME_SETTLED, {
        gameId: result.gameId,
        roundNumber: result.roundNumber,
        drawNumbers: result.drawNumbers,
        totalTickets: result.totalTickets,
        totalPayout: result.totalPayout,
        serverSeed: result.serverSeed,
        serverSeedHash: result.serverSeedHash,
        tickets: userTickets,
        playerPayout,
      });

      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (wallet) {
        emitToUser(userId, SOCKET_EVENTS.WALLET_UPDATED, {
          balance: Number(wallet.mainBalance),
          playBalance: Number(wallet.playBalance),
        });
      }
    }

    return result;
  }
}

function countMatches(selected: number[], draw: number[]): number {
  return selected.filter((n) => draw.includes(n)).length;
}
