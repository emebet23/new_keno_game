"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const settings_repository_1 = require("../repositories/settings.repository");
const user_repository_1 = require("../repositories/user.repository");
class AdminService {
    settingsRepo = new settings_repository_1.SettingsRepository();
    userRepo = new user_repository_1.UserRepository();
    async getSettings() {
        return this.settingsRepo.getSettings();
    }
    async updateSettings(data) {
        return this.settingsRepo.updateSettings(data);
    }
    async getFinancialAnalytics() {
        const [totalBetsResult, totalPayoutsResult, largestWinResult, totalTicketsCount] = await Promise.all([
            prisma_1.default.ticket.aggregate({
                _sum: { betAmount: true },
                _count: { id: true },
            }),
            prisma_1.default.ticket.aggregate({
                where: { status: "WON" },
                _sum: { payout: true },
            }),
            prisma_1.default.ticket.findMany({
                where: { status: "WON" },
                orderBy: { payout: "desc" },
                take: 1,
                include: { user: true, game: true },
            }).then((rows) => rows[0] ?? null),
            prisma_1.default.ticket.count(),
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
    async getUsers(page = 1, limit = 20, search) {
        return this.userRepo.findAll(page, limit, search);
    }
    async setUserStatus(userId, status) {
        return this.userRepo.updateStatus(userId, status);
    }
    async setUserRole(userId, role) {
        return this.userRepo.updateRole(userId, role);
    }
    async getReports() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [dailyGames, activeUsersCount, totalUsersCount, tickets, avgBetResult] = await Promise.all([
            prisma_1.default.kenoGame.count({
                where: { createdAt: { gte: today } },
            }),
            prisma_1.default.ticket.groupBy({
                by: ["userId"],
                where: { createdAt: { gte: today } },
            }),
            prisma_1.default.user.count(),
            prisma_1.default.ticket.findMany({
                take: 1000,
                orderBy: { createdAt: "desc" },
                select: { selectedNumbers: true, betAmount: true },
            }),
            prisma_1.default.ticket.aggregate({
                _avg: { betAmount: true },
            }),
        ]);
        // Popular numbers statistics
        const numberFrequency = {};
        for (let i = 1; i <= 80; i++)
            numberFrequency[i] = 0;
        for (const ticket of tickets) {
            const numbers = ticket.selectedNumbers;
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
exports.AdminService = AdminService;
