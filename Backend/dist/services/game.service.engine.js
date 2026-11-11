"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngineService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
const wallet_service_1 = require("./wallet.service");
const ticket_service_1 = require("./ticket.service");
const game_service_1 = require("./game.service");
const payout_service_1 = require("./payout.service");
const fairness_service_1 = require("./fairness.service");
const transaction_service_1 = require("./transaction.service");
const settings_repository_1 = require("../repositories/settings.repository");
const events_1 = require("../socket/events");
const socket_1 = require("../socket/socket");
class GameEngineService {
    wallet = new wallet_service_1.WalletService();
    ticket = new ticket_service_1.TicketService();
    game = new game_service_1.GameService();
    payout = new payout_service_1.PayoutService();
    fairness = new fairness_service_1.FairnessService();
    transaction = new transaction_service_1.TransactionService();
    settingsRepo = new settings_repository_1.SettingsRepository();
    async play(userId, dto) {
        const mode = dto.mode ?? client_1.GameMode.INSTANT;
        const clientSeed = dto.clientSeed;
        const ticketsToPlay = dto.tickets && dto.tickets.length > 0
            ? dto.tickets
            : [{ bet: dto.bet, selectedNumbers: dto.selectedNumbers }];
        const settings = await this.settingsRepo.getSettings();
        const minBet = Number(settings.minBet);
        const maxBet = Number(settings.maxBet);
        for (const t of ticketsToPlay) {
            if (t.bet < minBet || t.bet > maxBet) {
                throw new Error(`Bet amount must be between ${minBet} and ${maxBet}`);
            }
        }
        if (mode === client_1.GameMode.INSTANT) {
            return this.playInstant(userId, ticketsToPlay, clientSeed);
        }
        else {
            return this.playClassic(userId, ticketsToPlay, clientSeed);
        }
    }
    async playInstant(userId, tickets, clientSeed) {
        return prisma_1.default.$transaction(async (tx) => {
            const latest = await this.game.getLatest(tx);
            const nextRound = latest ? latest.roundNumber + 1 : 1;
            const game = await this.game.createInstantGame(tx, nextRound);
            const fairnessRecord = await this.fairness.commit(tx, game.id, clientSeed);
            const drawNumbers = this.fairness.generateDrawNumbers(fairnessRecord.serverSeed, fairnessRecord.clientSeed, fairnessRecord.nonce);
            const settledTickets = [];
            let totalPayout = 0;
            for (const t of tickets) {
                const walletResult = await this.wallet.deductBet(tx, userId, t.bet);
                await this.transaction.bet(tx, userId, t.bet, walletResult.balanceBefore, walletResult.balanceAfter, `instant-${game.id}`);
                const matches = countMatches(t.selectedNumbers, drawNumbers);
                const multiplier = await this.payout.getMultiplier(t.selectedNumbers.length, matches);
                const payoutAmount = t.bet * multiplier;
                const status = payoutAmount > 0 ? client_1.TicketStatus.WON : client_1.TicketStatus.LOST;
                const ticketRecord = await tx.ticket.create({
                    data: {
                        userId,
                        gameId: game.id,
                        mode: client_1.GameMode.INSTANT,
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
                    await this.transaction.win(tx, userId, payoutAmount, winResult.balanceBefore, winResult.balanceAfter, ticketRecord.id);
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
                mode: client_1.GameMode.INSTANT,
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
    async playClassic(userId, tickets, clientSeed) {
        return prisma_1.default.$transaction(async (tx) => {
            const game = await this.game.getOrCreateCurrentGame(tx);
            await this.fairness.commit(tx, game.id, clientSeed);
            const acceptedTickets = [];
            for (const t of tickets) {
                const walletResult = await this.wallet.deductBet(tx, userId, t.bet);
                await this.transaction.bet(tx, userId, t.bet, walletResult.balanceBefore, walletResult.balanceAfter, `classic-${game.id}`);
                const ticketRecord = await this.ticket.create(tx, {
                    userId,
                    gameId: game.id,
                    mode: client_1.GameMode.CLASSIC,
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
            return acceptedTickets.length === 1 ? acceptedTickets[0] : acceptedTickets;
        });
    }
    async settle(gameId) {
        const pendingGame = await this.game.getById(gameId);
        if (pendingGame) {
            (0, socket_1.emitBroadcast)(events_1.SOCKET_EVENTS.GAME_STARTED, {
                gameId,
                roundNumber: pendingGame.roundNumber,
            });
        }
        const { result, byUser } = await prisma_1.default.$transaction(async (tx) => {
            const drawNumbers = await this.fairness.drawFor(gameId);
            const game = await this.game.startDraw(tx, gameId);
            const tickets = await this.ticket.getByGame(tx, gameId);
            const settledTickets = [];
            const byUser = new Map();
            let totalPayout = 0;
            for (const t of tickets) {
                const selected = t.selectedNumbers;
                const matches = countMatches(selected, drawNumbers);
                const multiplier = await this.payout.getMultiplier(selected.length, matches);
                const payout = Number(t.betAmount) * multiplier;
                const status = payout > 0 ? client_1.TicketStatus.WON : client_1.TicketStatus.LOST;
                await this.ticket.settle(tx, t.id, {
                    matches,
                    multiplier,
                    payout,
                    status,
                });
                if (payout > 0) {
                    const winResult = await this.wallet.creditWin(tx, t.userId, payout);
                    await this.transaction.win(tx, t.userId, payout, winResult.balanceBefore, winResult.balanceAfter, t.id);
                    totalPayout += payout;
                }
                const settledTicket = {
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
        (0, socket_1.emitBroadcast)(events_1.SOCKET_EVENTS.DRAW_NUMBERS, {
            gameId: result.gameId,
            roundNumber: result.roundNumber,
            drawNumbers: result.drawNumbers,
        });
        // Personalized live reveal + wallet sync for every player with a ticket.
        for (const [userId, userTickets] of byUser.entries()) {
            const playerPayout = userTickets.reduce((sum, t) => sum + t.payout, 0);
            (0, socket_1.emitToUser)(userId, events_1.SOCKET_EVENTS.GAME_SETTLED, {
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
            const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
            if (wallet) {
                (0, socket_1.emitToUser)(userId, events_1.SOCKET_EVENTS.WALLET_UPDATED, {
                    balance: Number(wallet.mainBalance),
                    playBalance: Number(wallet.playBalance),
                });
            }
        }
        return result;
    }
}
exports.GameEngineService = GameEngineService;
function countMatches(selected, draw) {
    return selected.filter((n) => draw.includes(n)).length;
}
