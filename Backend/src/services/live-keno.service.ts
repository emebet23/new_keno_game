import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/prisma";
import { Server, Socket } from "socket.io";

export const KENO_PAYTABLE: number[][] = [
  [0, 3.5], // 1 pick: [0: 0, 1: 3.5]
  [0, 1, 10], // 2 picks: [0: 0, 1: 1, 2: 10]
  [0, 0, 2, 50], // 3 picks: [0: 0, 1: 0, 2: 2, 3: 50]
  [0, 0, 1.5, 10, 80], // 4 picks
  [0, 0, 1, 3, 30, 150], // 5 picks
  [0, 0, 0, 2, 15, 60, 500], // 6 picks
  [1, 0, 0, 2, 4, 20, 80, 1000], // 7 picks
  [1, 0, 0, 0, 5, 15, 50, 200, 2000], // 8 picks
  [2, 0, 0, 0, 2, 10, 25, 125, 1000, 5000], // 9 picks
  [2, 0, 0, 0, 0, 5, 30, 100, 300, 2000, 10000], // 10 picks
];

export interface LiveTicket {
  id: string;
  userId: string;
  gameId: number;
  bet: number;
  numbers: number[];
  matches?: number;
  multiplier?: number;
  payout?: number;
  won?: boolean;
  createdAt: number;
}

export interface LiveRound {
  gameId: number;
  dbId?: string;
  drawNumbers: number[];
  salt: string;
  randomSeq: string;
  key: string;
  hash: string;
  status: "WAITING" | "DRAWING";
  time: number;
  drawTime: number;
  tickets: LiveTicket[];
  totalTickets: number;
  date: number;
}

export interface ChatMessage {
  id: number;
  user: string;
  text?: string;
  gif?: string;
  rain?: {
    amount: number;
    players: number;
    claimedBy: string[];
    expiresAt: number;
  };
  timestamp: number;
  likes: number;
}

export class LiveKenoEngine {
  private static instance: LiveKenoEngine;
  private ioNamespace: any = null;

  public currentRound!: LiveRound;
  public history: any[] = [];
  public statistics: number[] = new Array(80).fill(0);
  public leaders: Array<{ id: string; b: number; w: number }> = [];
  public chatMessages: ChatMessage[] = [];
  private chatCounter = 1;
  private intervalTimer: NodeJS.Timeout | null = null;
  private roundSeq = 3013000 + Math.floor(Math.random() * 5000);

  // In-memory wallet cache for speed & demo fallbacks
  private userBalances = new Map<string, number>();

  private constructor() {
    this.initStatistics();
    this.initSampleLeaders();
    this.initSampleChat();
    this.startNewRound(true);
  }

  public static getInstance(): LiveKenoEngine {
    if (!LiveKenoEngine.instance) {
      LiveKenoEngine.instance = new LiveKenoEngine();
    }
    return LiveKenoEngine.instance;
  }

  public attachNamespace(namespace: any) {
    this.ioNamespace = namespace;
    if (!this.intervalTimer) {
      this.intervalTimer = setInterval(() => this.tick(), 1000);
    }
  }

  private initStatistics() {
    for (let i = 0; i < 80; i++) {
      this.statistics[i] = Math.floor(15 + Math.random() * 25);
    }
  }

  private initSampleLeaders() {
    this.leaders = [
      { id: "player_8921", b: 200, w: 10000 },
      { id: "player_4412", b: 100, w: 5000 },
      { id: "player_7730", b: 50, w: 2500 },
      { id: "player_1209", b: 150, w: 2250 },
      { id: "player_9941", b: 20, w: 1600 },
    ];
  }

  private initSampleChat() {
    this.chatMessages = [
      { id: 1, user: "System", text: "Welcome to Keno Live! Good luck everyone!", timestamp: Date.now() - 60000, likes: 3 },
    ];
    this.chatCounter = 2;
  }

  private generateDrawNumbers(): number[] {
    const nums = new Set<number>();
    while (nums.size < 20) {
      nums.add(Math.floor(Math.random() * 80) + 1);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }

  private startNewRound(isInitial = false) {
    this.roundSeq++;
    const drawNumbers = this.generateDrawNumbers();
    const salt = crypto.randomBytes(6).toString("hex");
    const randomSeq = uuidv4();
    const key = `${this.roundSeq}_numbers_${drawNumbers.join(",")}_Keno_${randomSeq}`;
    const hash = crypto.createHash("sha512").update(key + salt).digest("hex").toUpperCase();

    this.currentRound = {
      gameId: this.roundSeq,
      drawNumbers,
      salt,
      randomSeq,
      key,
      hash,
      status: "WAITING",
      time: 30, // 30 seconds betting time
      drawTime: 22, // 22 seconds draw animation time
      tickets: [],
      totalTickets: 0,
      date: Date.now(),
    };

    // Attempt to persist game to DB asynchronously
    prisma.kenoGame
      .create({
        data: {
          roundNumber: this.roundSeq,
          drawNumbers: [],
          status: "WAITING",
        },
      })
      .then((rec: any) => {
        this.currentRound.dbId = rec.id;
      })
      .catch(() => {
        // DB not ready or running offline: seamless memory fallback
      });

    if (!isInitial && this.ioNamespace) {
      this.ioNamespace.emit("message", {
        status: "roomevent",
        data: {
          status: "newgame",
          game_id: this.currentRound.gameId,
          hash: this.currentRound.hash,
          min_bet: 1,
          max_bet: 1000,
          max_win: 30000,
        },
      });
    }
  }

  private async tick() {
    if (!this.ioNamespace) return;

    if (this.currentRound.status === "WAITING") {
      this.currentRound.time--;

      // Format other tickets for roomevent
      const recentTickets = this.currentRound.tickets.slice(-10).map((t) => ({
        t: t.id,
        n: t.numbers,
        p: t.userId,
        bet: t.bet,
      }));

      this.ioNamespace.emit("message", {
        status: "roomevent",
        data: {
          status: "wait",
          time: this.currentRound.time,
          total_count: this.currentRound.totalTickets,
          tickets: recentTickets,
        },
      });

      if (this.currentRound.time <= 0) {
        this.transitionToDraw();
      }
    } else if (this.currentRound.status === "DRAWING") {
      this.currentRound.drawTime--;

      if (this.currentRound.drawTime <= 0) {
        // Record in history
        this.history.unshift({
          game_id: this.currentRound.gameId,
          date: this.currentRound.date.toString(),
          numbers: this.currentRound.drawNumbers,
          salt: this.currentRound.salt,
          key: this.currentRound.key,
          hash: this.currentRound.hash,
          tickets: this.currentRound.tickets.map((t) => ({
            t: t.id,
            b: t.bet,
            n: t.numbers,
            p: t.userId,
            w: t.payout || 0,
            m: t.matches || 0,
          })),
        });

        if (this.history.length > 50) {
          this.history.pop();
        }

        this.startNewRound(false);
      }
    }
  }

  private transitionToDraw() {
    this.currentRound.status = "DRAWING";
    const drawNumbers = this.currentRound.drawNumbers;

    // Update statistics
    for (const num of drawNumbers) {
      if (num >= 1 && num <= 80) {
        this.statistics[num - 1]++;
      }
    }

    // Broadcast draw event to all clients
    this.ioNamespace.emit("message", {
      status: "roomevent",
      data: {
        status: "play",
        numbers: drawNumbers,
        date: Date.now().toString(),
        salt: this.currentRound.salt,
        key: this.currentRound.key,
        skip_stats: false,
      },
    });

    // Evaluate all tickets
    this.settleRoundTickets();
  }

  private async settleRoundTickets() {
    const drawNumbers = this.currentRound.drawNumbers;
    const userPayouts = new Map<string, number>();

    for (const ticket of this.currentRound.tickets) {
      const picks = ticket.numbers.length;
      const matches = ticket.numbers.filter((n) => drawNumbers.includes(n)).length;
      ticket.matches = matches;

      let multiplier = 0;
      if (picks >= 1 && picks <= 10 && KENO_PAYTABLE[picks - 1]) {
        multiplier = KENO_PAYTABLE[picks - 1][matches] || 0;
      }

      ticket.multiplier = multiplier;
      const payout = Math.round(ticket.bet * multiplier * 100) / 100;
      ticket.payout = payout;
      ticket.won = payout > 0;

      const currentTotal = userPayouts.get(ticket.userId) || 0;
      userPayouts.set(ticket.userId, currentTotal + payout);

      if (payout >= ticket.bet * 10 && payout >= 500) {
        this.leaders.unshift({
          id: ticket.userId,
          b: ticket.bet,
          w: payout,
        });
        if (this.leaders.length > 10) this.leaders.pop();
      }
    }

    // Credit winnings and update balances
    for (const [userId, payout] of userPayouts.entries()) {
      if (payout > 0) {
        await this.creditUser(userId, payout);
        const newBalance = await this.getUserBalance(userId);

        // Find sockets for this user and emit balance event
        if (this.ioNamespace && this.ioNamespace.sockets) {
          for (const [_, sock] of this.ioNamespace.sockets) {
            if (sock.data && sock.data.userId === userId) {
              sock.emit("message", {
                status: "eventresp",
                data: {
                  status: "balance",
                  credit: newBalance,
                },
              });
            }
          }
        }
      }
    }

    // Update DB game status
    if (this.currentRound.dbId) {
      prisma.kenoGame
        .update({
          where: { id: this.currentRound.dbId },
          data: {
            drawNumbers,
            status: "COMPLETED",
            finishedAt: new Date(),
          },
        })
        .catch(() => {});
    }
  }

  public async getUserBalance(userId: string): Promise<number> {
    if (this.userBalances.has(userId)) {
      return this.userBalances.get(userId)!;
    }

    try {
      // Check Postgres wallet
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { username: userId }, { telegramId: !isNaN(Number(userId)) ? BigInt(userId) : -1 }],
        },
        include: { wallet: true },
      });

      if (user && user.wallet) {
        const bal = Number(user.wallet.mainBalance);
        this.userBalances.set(userId, bal);
        return bal;
      }
    } catch {}

    // Default starting balance for player
    const initialBal = 1000.0;
    this.userBalances.set(userId, initialBal);
    return initialBal;
  }

  public async deductUser(userId: string, amount: number): Promise<number> {
    const cur = await this.getUserBalance(userId);
    const updated = Math.max(0, Math.round((cur - amount) * 100) / 100);
    this.userBalances.set(userId, updated);

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { username: userId }, { telegramId: !isNaN(Number(userId)) ? BigInt(userId) : -1 }],
        },
        include: { wallet: true },
      });
      if (user && user.wallet) {
        await prisma.wallet.update({
          where: { id: user.wallet.id },
          data: { mainBalance: updated },
        });
      }
    } catch {}

    return updated;
  }

  public async creditUser(userId: string, amount: number): Promise<number> {
    const cur = await this.getUserBalance(userId);
    const updated = Math.round((cur + amount) * 100) / 100;
    this.userBalances.set(userId, updated);

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { username: userId }, { telegramId: !isNaN(Number(userId)) ? BigInt(userId) : -1 }],
        },
        include: { wallet: true },
      });
      if (user && user.wallet) {
        await prisma.wallet.update({
          where: { id: user.wallet.id },
          data: { mainBalance: updated },
        });
      }
    } catch {}

    return updated;
  }

  public async placeBet(
    userId: string,
    bet: number,
    numbers: number[]
  ): Promise<{ success: boolean; error?: string; ticket?: LiveTicket; balance?: number }> {
    if (this.currentRound.status !== "WAITING") {
      return { success: false, error: "Round in progress. Please wait for the next game." };
    }
    if (!bet || bet < 1 || bet > 1000) {
      return { success: false, error: "Bet must be between 1 and 1000 ETB" };
    }
    if (!Array.isArray(numbers) || numbers.length < 1 || numbers.length > 10) {
      return { success: false, error: "Select between 1 and 10 numbers" };
    }

    const uniqueNumbers = Array.from(new Set(numbers));
    if (uniqueNumbers.length !== numbers.length || uniqueNumbers.some((n) => n < 1 || n > 80)) {
      return { success: false, error: "Invalid numbers selected" };
    }

    const balance = await this.getUserBalance(userId);
    if (balance < bet) {
      return { success: false, error: "Insufficient balance", balance };
    }

    const newBalance = await this.deductUser(userId, bet);
    const ticketId = "tk_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    const ticket: LiveTicket = {
      id: ticketId,
      userId,
      gameId: this.currentRound.gameId,
      bet,
      numbers: uniqueNumbers,
      createdAt: Date.now(),
    };

    this.currentRound.tickets.push(ticket);
    this.currentRound.totalTickets++;

    // Record ticket in DB asynchronously
    if (this.currentRound.dbId) {
      prisma.user
        .findFirst({
          where: {
            OR: [{ id: userId }, { username: userId }, { telegramId: !isNaN(Number(userId)) ? BigInt(userId) : -1 }],
          },
        })
        .then((u: any) => {
          if (u) {
            prisma.ticket.create({
              data: {
                userId: u.id,
                gameId: this.currentRound.dbId!,
                betAmount: bet,
                selectedNumbers: uniqueNumbers,
                status: "PENDING",
              },
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    return {
      success: true,
      ticket,
      balance: newBalance,
    };
  }

  public getLoginSnapshot(userId: string, socketId: string) {
    const userTickets = this.currentRound.tickets
      .filter((t) => t.userId === userId)
      .map((t) => ({
        t: t.id,
        b: t.bet,
        n: t.numbers,
      }));

    const otherTickets = this.currentRound.tickets
      .filter((t) => t.userId !== userId)
      .slice(-20)
      .map((t) => ({
        t: t.id,
        n: t.numbers,
        p: t.userId,
        bet: t.bet,
      }));

    const online = this.ioNamespace ? (this.ioNamespace.sockets ? this.ioNamespace.sockets.size : 1) : 1;

    return {
      status: "login",
      game_id: this.currentRound.gameId,
      hash: this.currentRound.hash,
      credit: this.userBalances.get(userId) || 1000.0,
      player_id: userId,
      sid: socketId,
      ticket: "ticket_" + socketId,
      min_bet: 1,
      max_bet: 1000,
      max_win: 30000,
      free_bets: [],
      tickets: otherTickets,
      my_tickets: userTickets,
      leaders: this.leaders,
      history: this.history.slice(0, 20),
      statistics: this.statistics,
      game_status: this.currentRound.status === "WAITING" ? 1 : 0,
      time: this.currentRound.status === "WAITING" ? this.currentRound.time : 0,
      chat: this.chatMessages.slice(-50),
      online,
    };
  }

  public addChatMessage(user: string, text: string): ChatMessage {
    const msg: ChatMessage = {
      id: this.chatCounter++,
      user,
      text: text.slice(0, 160),
      timestamp: Date.now(),
      likes: 0,
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();
    return msg;
  }

  public async createRain(user: string, amount: number, players: number): Promise<{ success: boolean; error?: string; message?: ChatMessage }> {
    const total = Math.round(amount * players * 100) / 100;
    const balance = await this.getUserBalance(user);
    if (balance < total) {
      return { success: false, error: "Not enough balance for rain" };
    }
    await this.deductUser(user, total);

    const msg: ChatMessage = {
      id: this.chatCounter++,
      user,
      rain: {
        amount,
        players,
        claimedBy: [],
        expiresAt: Date.now() + 5 * 60 * 1000,
      },
      timestamp: Date.now(),
      likes: 0,
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();
    return { success: true, message: msg };
  }

  public async claimRain(userId: string, messageId: number): Promise<{ success: boolean; amount?: number; error?: string }> {
    const msg = this.chatMessages.find((m) => m.id === messageId);
    if (!msg || !msg.rain) {
      return { success: false, error: "Rain not found" };
    }
    if (Date.now() > msg.rain.expiresAt) {
      return { success: false, error: "Rain has expired" };
    }
    if (msg.rain.claimedBy.includes(userId)) {
      return { success: false, error: "Already claimed" };
    }
    if (msg.rain.claimedBy.length >= msg.rain.players) {
      return { success: false, error: "All rain has been claimed" };
    }

    msg.rain.claimedBy.push(userId);
    const amount = msg.rain.amount;
    await this.creditUser(userId, amount);
    return { success: true, amount };
  }

  public toggleLike(messageId: number): number {
    const msg = this.chatMessages.find((m) => m.id === messageId);
    if (!msg) return 0;
    msg.likes = (msg.likes || 0) + 1;
    return msg.likes;
  }

  public getUserGameHistory(userId: string, page = 0) {
    const userGames = this.history
      .filter((h) => h.tickets && h.tickets.some((t: any) => t.p === userId))
      .map((h) => ({
        game_id: h.game_id,
        date: h.date,
        numbers: h.numbers,
        salt: h.salt,
        key: h.key,
        hash: h.hash,
        tickets: h.tickets.filter((t: any) => t.p === userId),
      }));

    return {
      games: userGames.slice(page * 20, (page + 1) * 20),
    };
  }

  public verifyHash(key: string, salt: string): string {
    return crypto.createHash("sha512").update(key + salt).digest("hex").toUpperCase();
  }
}
