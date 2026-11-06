import prisma from "../config/prisma";
import { Role, UserStatus } from "@prisma/client";
import { SettingsRepository } from "../repositories/settings.repository";
import { UserRepository } from "../repositories/user.repository";

export class AdminService {
  private settingsRepo = new SettingsRepository();
  private userRepo = new UserRepository();

  async getSettings() {
    return this.settingsRepo.getSettings();
  }

  async updateSettings(data: Parameters<SettingsRepository["updateSettings"]>[0]) {
    return this.settingsRepo.updateSettings(data);
  }

  async getFinancialAnalytics() {
    const [totalBetsResult, totalPayoutsResult, largestWinResult, totalTicketsCount] = await Promise.all([
      prisma.ticket.aggregate({
        _sum: { betAmount: true },
        _count: { id: true },
      }),
      prisma.ticket.aggregate({
        where: { status: "WON" },
        _sum: { payout: true },
      }),
      prisma.ticket.findMany({
        where: { status: "WON" },
        orderBy: { payout: "desc" },
        take: 1,
        include: { user: true, game: true },
      }).then((rows) => rows[0] ?? null),
      prisma.ticket.count(),
    ]);

    const totalBets = Number(totalBetsResult._sum.betAmount || 0);
    const totalPayouts = Number(totalPayoutsResult._sum.payout || 0);
    const revenue = totalBets;
    const profit = totalBets - totalPayouts;
    const rtpActual = totalBets > 0 ? (totalPayouts / totalBets) * 100 : 0;

    return {
      totalBets,
      totalPayouts,
      totalTicketsCount,
      revenue,
      profit,
      actualRtpPercentage: Number(rtpActual.toFixed(2)),
      largestWin: largestWinResult ? {
        ticketId: largestWinResult.id,
        userId: largestWinResult.userId,
        username: largestWinResult.user?.username || "N/A",
        betAmount: Number(largestWinResult.betAmount),
        payout: Number(largestWinResult.payout),
        multiplier: Number(largestWinResult.multiplier),
        matches: largestWinResult.matches,
        createdAt: largestWinResult.createdAt,
      } : null,
    };
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    return this.userRepo.findAll(page, limit, search);
  }

  async setUserStatus(userId: string, status: UserStatus) {
    return this.userRepo.updateStatus(userId, status);
  }

  async setUserRole(userId: string, role: Role) {
    return this.userRepo.updateRole(userId, role);
  }

  async getReports() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dailyGames, activeUsersCount, totalUsersCount, tickets, avgBetResult] = await Promise.all([
      prisma.kenoGame.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.ticket.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: today } },
      }),
      prisma.user.count(),
      prisma.ticket.findMany({
        take: 1000,
        orderBy: { createdAt: "desc" },
        select: { selectedNumbers: true, betAmount: true },
      }),
      prisma.ticket.aggregate({
        _avg: { betAmount: true },
      }),
    ]);

    // Popular numbers statistics
    const numberFrequency: Record<number, number> = {};
    for (let i = 1; i <= 80; i++) numberFrequency[i] = 0;

    for (const ticket of tickets) {
      const numbers = ticket.selectedNumbers as number[];
      for (const num of numbers) {
        if (numberFrequency[num] !== undefined) {
          numberFrequency[num]++;
        }
      }
    }

    const popularNumbers = Object.entries(numberFrequency)
      .map(([num, count]) => ({ number: Number(num), count }))
      .sort((a, b) => b.count - a.count);

    return {
      dailyGames,
      activeUsersToday: activeUsersCount.length,
      totalRegisteredUsers: totalUsersCount,
      averageBetAmount: Number(avgBetResult._avg.betAmount || 0),
      popularNumbers: popularNumbers.slice(0, 10),
      numberFrequency,
    };
  }
}
