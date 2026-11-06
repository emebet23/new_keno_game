import prisma from "../../config/prisma";
import {
  TransactionStatus,
  TransactionType,
  WalletSource,
  Role,
} from "@prisma/client";
import { getIO } from "../../socket/socket";
import { SOCKET_EVENTS } from "../../socket/events";
import { userRoom } from "../../socket/rooms";
import redisClient from "../../config/redis";

export class WithdrawalService {
  private static emitWalletUpdate(userId: string, balance: number, playBalance: number) {
    try {
      getIO().to(userRoom(userId)).emit(SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
    } catch {}
  }

  private static emitSettled(withdrawalId: string, status: string) {
    try {
      getIO().to("admin_room").emit("withdrawal_settled", { withdrawalId, status });
    } catch {}
  }

  static async requestWithdrawal(telegramId: string, amount: number, phone: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: { wallet: true },
      });

      if (!user?.wallet) {
        return { success: false, error: "User not found" };
      }

      const mainBalance = Number(user.wallet.mainBalance);
      if (mainBalance < amount) {
        return {
          success: false,
          error: `Insufficient Main Wallet balance. Available: ${mainBalance.toFixed(2)} ETB.`,
        };
      }

      const walletResult = await prisma.$transaction(async (tx) => {
        const balBefore = Number(user.wallet!.mainBalance);
        const balAfter = balBefore - amount;

        const updated = await tx.wallet.update({
          where: { id: user.wallet!.id },
          data: { mainBalance: { decrement: amount } },
        });

        const wTx = await tx.transaction.create({
          data: {
            userId: user.id,
            walletId: user.wallet!.id,
            amount,
            type: TransactionType.WITHDRAW,
            walletSource: WalletSource.MAIN,
            status: TransactionStatus.PENDING,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            description: `Withdrawal to ${phone}`,
          },
        });

        return { updated, wTx };
      });

      const newBalance = Number(walletResult.updated.mainBalance);
      const playBalance = Number(walletResult.updated.playBalance);
      this.emitWalletUpdate(user.id, newBalance, playBalance);

      try {
        getIO().to("admin_room").emit(SOCKET_EVENTS.NEW_DEPOSIT, {
          type: "withdrawal",
          userName: user.firstName || user.username || "Unknown",
          phone,
          amount,
          createdAt: new Date().toISOString(),
        });
      } catch {}

      try {
        const { getBot } = await import("../../bot/bot.service");
        const bot = getBot();
        const admins = await prisma.user.findMany({
          where: { role: { in: [Role.ADMIN, Role.SUPERADMIN] } },
          select: { telegramId: true },
        });
        const name = user.firstName || user.username || String(user.telegramId);
        const [methodLabel, account] = phone.startsWith("telebirr:")
          ? ["📱 Telebirr", phone.replace("telebirr:", "")]
          : phone.startsWith("cbe:")
            ? ["🏦 CBE", phone.replace("cbe:", "")]
            : ["📱 Phone", phone];

        for (const admin of admins) {
          await bot.sendMessage(
            String(admin.telegramId),
            `🆕 *New Withdrawal Request*\n👤 Name: ${name}\n💰 Amount: ${amount} ETB\n💼 User Balance: ${newBalance.toFixed(2)} ETB\n${methodLabel}: ${account}\n\nApprove or Reject:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Approve", callback_data: `approve_wd:${walletResult.wTx.id}` },
                    { text: "❌ Reject", callback_data: `reject_wd:${walletResult.wTx.id}` },
                  ],
                ],
              },
            },
          );
        }
      } catch (err: any) {
        console.error("Admin withdrawal notification failed:", err.message);
      }

      return { success: true, balance: newBalance };
    } catch (error: any) {
      console.error("requestWithdrawal error:", error?.message || error);
      return { success: false, error: error?.message || "Internal error" };
    }
  }

  static async getPendingWithdrawals() {
    return prisma.transaction.findMany({
      where: {
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PENDING,
      },
      include: {
        wallet: {
          include: {
            user: {
              select: { id: true, telegramId: true, firstName: true, username: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async approveWithdrawal(withdrawalId: string, adminId: string) {
    const lockKey = `wd:lock:${withdrawalId}`;
    const locked = await (redisClient as any).set(lockKey, "1", "EX", 10, "NX");
    if (!locked) {
      return { success: false, error: "Withdrawal is being processed by another admin" };
    }

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: withdrawalId },
        include: { wallet: { include: { user: true } } },
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }
      if (transaction.status !== TransactionStatus.PENDING) {
        return { success: false, error: "Already settled" };
      }

      await prisma.transaction.update({
        where: { id: withdrawalId },
        data: {
          status: TransactionStatus.SUCCESS,
          description: `Withdrawal Approved - ${adminId}`,
        },
      });

      if (transaction.wallet?.user) {
        const user = transaction.wallet.user;
        this.emitWalletUpdate(
          user.id,
          Number(transaction.wallet.mainBalance),
          Number(transaction.wallet.playBalance),
        );
        this.emitSettled(withdrawalId, "COMPLETED");

        try {
          const { getBot } = await import("../../bot/bot.service");
          const bot = getBot();
          const amt = Math.abs(Number(transaction.amount));
          const remainingBalance = Number(transaction.wallet.mainBalance);
          await bot.sendMessage(
            String(user.telegramId),
            `🎉 የእርስዎ የ ${amt} ብር የወጪ ጥያቄ ተቀባይነት አግኝቶ ተጠናቋል።\n\n💼 የተቀረ ሂሳብ: ${remainingBalance.toFixed(2)} ETB`,
          );
        } catch (err: any) {
          console.error("Withdrawal approval notification failed:", err.message);
        }
      }

      return { success: true };
    } finally {
      await redisClient.del(lockKey);
    }
  }

  static async rejectWithdrawal(withdrawalId: string, adminId: string, reason?: string) {
    const lockKey = `wd:lock:${withdrawalId}`;
    const locked = await (redisClient as any).set(lockKey, "1", "EX", 10, "NX");
    if (!locked) {
      return { success: false, error: "Withdrawal is being processed by another admin" };
    }

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: withdrawalId },
        include: { wallet: { include: { user: true } } },
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }
      if (transaction.status !== TransactionStatus.PENDING) {
        return { success: false, error: "Already settled" };
      }

      const refundAmount = Math.abs(Number(transaction.amount));

      await prisma.$transaction(async (tx) => {
        const balBefore = Number(transaction.wallet!.mainBalance);
        const balAfter = balBefore + refundAmount;

        await tx.wallet.update({
          where: { id: transaction.walletId! },
          data: { mainBalance: { increment: refundAmount } },
        });

        await tx.transaction.update({
          where: { id: withdrawalId },
          data: {
            status: TransactionStatus.REJECTED,
            description: `Withdrawal Rejected - ${adminId}${reason ? ` - ${reason}` : ""}`,
          },
        });
      });

      if (transaction.wallet?.user) {
        const user = transaction.wallet.user;

        const updatedWallet = await prisma.wallet.findUnique({
          where: { id: transaction.walletId! },
        });

        this.emitWalletUpdate(
          user.id,
          Number(updatedWallet?.mainBalance ?? 0),
          Number(updatedWallet?.playBalance ?? 0),
        );

        this.emitSettled(withdrawalId, "REJECTED");

        try {
          const { getBot } = await import("../../bot/bot.service");
          const bot = getBot();
          const balance = Number(updatedWallet?.mainBalance ?? 0);
          const rejectionMessage = reason
            ? `❌ የእርስዎ የ ${refundAmount} ብር የወጪ ጥያቄ ውድቅ ተደርጓል።\n\n📝 ምክንያት: ${reason}\n\nገንዘቡ ወደ መለያዎ ተመልሷል።\n💼 የተቀረ ሂሳብ: ${balance.toFixed(2)} ETB`
            : `❌ የእርስዎ የ ${refundAmount} ብር የወጪ ጥያቄ ውድቅ ተደርጓል።\n\nገንዘቡ ወደ መለያዎ ተመልሷል።\n💼 የተቀረ ሂሳብ: ${balance.toFixed(2)} ETB`;
          await bot.sendMessage(String(user.telegramId), rejectionMessage);
        } catch (err: any) {
          console.error("Withdrawal rejection notification failed:", err.message);
        }
      }

      return { success: true };
    } finally {
      await redisClient.del(lockKey);
    }
  }
}
