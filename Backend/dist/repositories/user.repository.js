"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const client_1 = require("@prisma/client");
class UserRepository {
    async findByTelegramId(telegramId) {
        return prisma_1.default.user.findUnique({
            where: { telegramId },
            include: {
                wallet: true,
            },
        });
    }
    async findById(id) {
        return prisma_1.default.user.findUnique({
            where: { id },
            include: {
                wallet: true,
            },
        });
    }
    async create(data) {
        let finalUsername = data.username;
        if (finalUsername) {
            const existing = await prisma_1.default.user.findUnique({
                where: { username: finalUsername },
            });
            if (existing) {
                finalUsername = `${data.username}_${data.telegramId.toString().slice(-4)}`;
            }
        }
        return prisma_1.default.user.create({
            data: {
                telegramId: data.telegramId,
                username: finalUsername,
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role ?? client_1.Role.USER,
                wallet: {
                    create: {},
                },
            },
            include: {
                wallet: true,
            },
        });
    }
    async updateProfile(userId, data) {
        const updateData = {};
        if (data.username !== undefined)
            updateData.username = data.username;
        if (data.firstName !== undefined)
            updateData.firstName = data.firstName;
        if (data.lastName !== undefined)
            updateData.lastName = data.lastName;
        return prisma_1.default.user.update({
            where: { id: userId },
            data: updateData,
            include: { wallet: true },
        });
    }
    async updateStatus(userId, status) {
        return prisma_1.default.user.update({
            where: { id: userId },
            data: { status },
        });
    }
    async updateRole(userId, role) {
        return prisma_1.default.user.update({
            where: { id: userId },
            data: { role },
            include: { wallet: true },
        });
    }
    async findAll(page = 1, limit = 20, search) {
        const skip = (page - 1) * limit;
        const where = search
            ? {
                OR: [
                    { username: { contains: search, mode: "insensitive" } },
                    { firstName: { contains: search, mode: "insensitive" } },
                ],
            }
            : {};
        const [items, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    wallet: true,
                    _count: {
                        select: { tickets: true, transactions: true },
                    },
                },
            }),
            prisma_1.default.user.count({ where }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}
exports.UserRepository = UserRepository;
