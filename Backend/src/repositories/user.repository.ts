import prisma from "../config/prisma";
import { Role, UserStatus } from "@prisma/client";

export class UserRepository {
  async findByTelegramId(telegramId: bigint) {
    return prisma.user.findUnique({
      where: { telegramId },
      include: {
        wallet: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
      },
    });
  }

  async create(data: {
    telegramId: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: Role;
  }) {
    let finalUsername = data.username;

    if (finalUsername) {
      const existing = await prisma.user.findUnique({
        where: { username: finalUsername },
      });
      if (existing) {
        finalUsername = `${data.username}_${data.telegramId.toString().slice(-4)}`;
      }
    }

    return prisma.user.create({
      data: {
        telegramId: data.telegramId,
        username: finalUsername,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ?? Role.USER,
        wallet: {
          create: {},
        },
      },
      include: {
        wallet: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    data: { username?: string; firstName?: string; lastName?: string }
  ) {
    const updateData: any = {};
    if (data.username !== undefined) updateData.username = data.username;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { wallet: true },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async updateRole(userId: string, role: Role) {
    return prisma.user.update({
      where: { id: userId },
      data: { role },
      include: { wallet: true },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
