"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalService = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
const socket_1 = require("../../socket/socket");
const events_1 = require("../../socket/events");
const rooms_1 = require("../../socket/rooms");
const redis_1 = __importDefault(require("../../config/redis"));
class WithdrawalService {
    static emitWalletUpdate(userId, balance, playBalance) {
        try {
            (0, socket_1.getIO)().to((0, rooms_1.userRoom)(userId)).emit(events_1.SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
        }
        catch { }
    }
    static emitSettled(withdrawalId, status) {
        try {
            (0, socket_1.getIO)().to("admin_room").emit("withdrawal_settled", { withdrawalId, status });
        }
        catch { }
    }
    static async requestWithdrawal(telegramId, amount, phone) {
        try {
            const user = await prisma_1.default.user.findUnique({
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
            const walletResult = await prisma_1.default.$transaction(async (tx) => {
                const balBefore = Number(user.wallet.mainBalance);
                const balAfter = balBefore - amount;
                const updated = await tx.wallet.update({
                    where: { id: user.wallet.id },
                    data: { mainBalance: { decrement: amount } },
                });
                const wTx = await tx.transaction.create({
                    data: {
                        userId: user.id,
                        walletId: user.wallet.id,
                        amount,
                        type: client_1.TransactionType.WITHDRAW,
                        walletSource: client_1.WalletSource.MAIN,
                        status: client_1.TransactionStatus.PENDING,
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
                (0, socket_1.getIO)().to("admin_room").emit(events_1.SOCKET_EVENTS.NEW_DEPOSIT, {
                    type: "withdrawal",
                    userName: user.firstName || user.username || "Unknown",
                    phone,
                    amount,
                    createdAt: new Date().toISOString(),
                });
            }
            catch { }
            try {
                const { getBot } = await Promise.resolve().then(() => __importStar(require("../../bot/bot.service")));
                const bot = getBot();
                const admins = await prisma_1.default.user.findMany({
                    where: { role: { in: [client_1.Role.ADMIN, client_1.Role.SUPERADMIN] } },
                    select: { telegramId: true },
                });
                const name = user.firstName || user.username || String(user.telegramId);
                const [methodLabel, account] = phone.startsWith("telebirr:")
                    ? ["📱 Telebirr", phone.replace("telebirr:", "")]
                    : phone.startsWith("cbe:")
                        ? ["🏦 CBE", phone.replace("cbe:", "")]
                        : ["📱 Phone", phone];
                for (const admin of admins) {
                    await bot.sendMessage(String(admin.telegramId), `🆕 *New Withdrawal Request*\n👤 Name: ${name}\n💰 Amount: ${amount} ETB\n💼 User Balance: ${newBalance.toFixed(2)} ETB\n${methodLabel}: ${account}\n\nApprove or Reject:`, {
                        parse_mode: "Markdown",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "✅ Approve", callback_data: `approve_wd:${walletResult.wTx.id}` },
                                    { text: "❌ Reject", callback_data: `reject_wd:${walletResult.wTx.id}` },
                                ],
                            ],
                        },
                    });
                }
            }
            catch (err) {
                console.error("Admin withdrawal notification failed:", err.message);
            }
            return { success: true, balance: newBalance };
        }
        catch (error) {
            console.error("requestWithdrawal error:", error?.message || error);
            return { success: false, error: error?.message || "Internal error" };
        }
    }
    static async getPendingWithdrawals() {
        return prisma_1.default.transaction.findMany({
            where: {
                type: client_1.TransactionType.WITHDRAW,
                status: client_1.TransactionStatus.PENDING,
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
    static async approveWithdrawal(withdrawalId, adminId) {
        const lockKey = `wd:lock:${withdrawalId}`;
        const locked = await redis_1.default.set(lockKey, "1", "EX", 10, "NX");
        if (!locked) {
            return { success: false, error: "Withdrawal is being processed by another admin" };
        }
        try {
            const transaction = await prisma_1.default.transaction.findUnique({
                where: { id: withdrawalId },
                include: { wallet: { include: { user: true } } },
            });
            if (!transaction) {
                return { success: false, error: "Transaction not found" };
            }
            if (transaction.status !== client_1.TransactionStatus.PENDING) {
                return { success: false, error: "Already settled" };
            }
            await prisma_1.default.transaction.update({
                where: { id: withdrawalId },
                data: {
                    status: client_1.TransactionStatus.SUCCESS,
                    description: `Withdrawal Approved - ${adminId}`,
                },
            });
            if (transaction.wallet?.user) {
                const user = transaction.wallet.user;
                this.emitWalletUpdate(user.id, Number(transaction.wallet.mainBalance), Number(transaction.wallet.playBalance));
                this.emitSettled(withdrawalId, "COMPLETED");
                try {
                    const { getBot } = await Promise.resolve().then(() => __importStar(require("../../bot/bot.service")));
                    const bot = getBot();
                    const amt = Math.abs(Number(transaction.amount));
                    const remainingBalance = Number(transaction.wallet.mainBalance);
                    await bot.sendMessage(String(user.telegramId), `🎉 የእርስዎ የ ${amt} ብር የወጪ ጥያቄ ተቀባይነት አግኝቶ ተጠናቋል።\n\n💼 የተቀረ ሂሳብ: ${remainingBalance.toFixed(2)} ETB`);
                }
                catch (err) {
                    console.error("Withdrawal approval notification failed:", err.message);
                }
            }
            return { success: true };
        }
        finally {
            await redis_1.default.del(lockKey);
        }
    }
    static async rejectWithdrawal(withdrawalId, adminId, reason) {
        const lockKey = `wd:lock:${withdrawalId}`;
        const locked = await redis_1.default.set(lockKey, "1", "EX", 10, "NX");
        if (!locked) {
            return { success: false, error: "Withdrawal is being processed by another admin" };
        }
        try {
            const transaction = await prisma_1.default.transaction.findUnique({
                where: { id: withdrawalId },
                include: { wallet: { include: { user: true } } },
            });
            if (!transaction) {
                return { success: false, error: "Transaction not found" };
            }
            if (transaction.status !== client_1.TransactionStatus.PENDING) {
                return { success: false, error: "Already settled" };
            }
            const refundAmount = Math.abs(Number(transaction.amount));
            await prisma_1.default.$transaction(async (tx) => {
                const balBefore = Number(transaction.wallet.mainBalance);
                const balAfter = balBefore + refundAmount;
                await tx.wallet.update({
                    where: { id: transaction.walletId },
                    data: { mainBalance: { increment: refundAmount } },
                });
                await tx.transaction.update({
                    where: { id: withdrawalId },
                    data: {
                        status: client_1.TransactionStatus.REJECTED,
                        description: `Withdrawal Rejected - ${adminId}${reason ? ` - ${reason}` : ""}`,
                    },
                });
            });
            if (transaction.wallet?.user) {
                const user = transaction.wallet.user;
                const updatedWallet = await prisma_1.default.wallet.findUnique({
                    where: { id: transaction.walletId },
                });
                this.emitWalletUpdate(user.id, Number(updatedWallet?.mainBalance ?? 0), Number(updatedWallet?.playBalance ?? 0));
                this.emitSettled(withdrawalId, "REJECTED");
                try {
                    const { getBot } = await Promise.resolve().then(() => __importStar(require("../../bot/bot.service")));
                    const bot = getBot();
                    const balance = Number(updatedWallet?.mainBalance ?? 0);
                    const rejectionMessage = reason
                        ? `❌ የእርስዎ የ ${refundAmount} ብር የወጪ ጥያቄ ውድቅ ተደርጓል።\n\n📝 ምክንያት: ${reason}\n\nገንዘቡ ወደ መለያዎ ተመልሷል።\n💼 የተቀረ ሂሳብ: ${balance.toFixed(2)} ETB`
                        : `❌ የእርስዎ የ ${refundAmount} ብር የወጪ ጥያቄ ውድቅ ተደርጓል።\n\nገንዘቡ ወደ መለያዎ ተመልሷል።\n💼 የተቀረ ሂሳብ: ${balance.toFixed(2)} ETB`;
                    await bot.sendMessage(String(user.telegramId), rejectionMessage);
                }
                catch (err) {
                    console.error("Withdrawal rejection notification failed:", err.message);
                }
            }
            return { success: true };
        }
        finally {
            await redis_1.default.del(lockKey);
        }
    }
}
exports.WithdrawalService = WithdrawalService;
