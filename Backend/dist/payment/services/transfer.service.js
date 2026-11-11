"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferService = exports.MIN_TRANSFER_AMOUNT = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const client_1 = require("@prisma/client");
const socket_1 = require("../../socket/socket");
const events_1 = require("../../socket/events");
const rooms_1 = require("../../socket/rooms");
exports.MIN_TRANSFER_AMOUNT = 20;
class TransferService {
    static emitWalletUpdate(userId, balance, playBalance) {
        try {
            (0, socket_1.getIO)().to((0, rooms_1.userRoom)(userId)).emit(events_1.SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
        }
        catch { }
    }
    static async transfer(senderTelegramId, recipientTelegramId, amount) {
        if (!amount || Number.isNaN(amount) || amount <= 0) {
            return { success: false, errorCode: "INVALID_AMOUNT" };
        }
        if (amount < exports.MIN_TRANSFER_AMOUNT) {
            return { success: false, errorCode: "BELOW_MINIMUM" };
        }
        amount = Math.round(amount * 100) / 100;
        if (senderTelegramId === recipientTelegramId) {
            return { success: false, errorCode: "SELF_TRANSFER" };
        }
        const sender = await prisma_1.default.user.findUnique({
            where: { telegramId: BigInt(senderTelegramId) },
            include: { wallet: true },
        });
        if (!sender?.wallet) {
            return { success: false, errorCode: "SENDER_WALLET_NOT_FOUND" };
        }
        const recipient = await prisma_1.default.user.findUnique({
            where: { telegramId: BigInt(recipientTelegramId) },
            include: { wallet: true },
        });
        if (!recipient?.wallet) {
            return { success: false, errorCode: "RECIPIENT_NOT_REGISTERED" };
        }
        if (!recipient.isActive) {
            return { success: false, errorCode: "RECIPIENT_INACTIVE" };
        }
        const senderMainBalance = Number(sender.wallet.mainBalance);
        if (senderMainBalance < amount) {
            return { success: false, errorCode: "INSUFFICIENT_BALANCE", currentBalance: senderMainBalance };
        }
        const referenceId = `TRANSFER_${Date.now()}_${sender.id.split("-")[0]}`;
        const [updatedSenderWallet, updatedRecipientWallet] = await prisma_1.default.$transaction(async (tx) => {
            const senderBalBefore = Number(sender.wallet.mainBalance);
            const senderBalAfter = senderBalBefore - amount;
            const recipientBalBefore = Number(recipient.wallet.mainBalance);
            const recipientBalAfter = recipientBalBefore + amount;
            const senderWallet = await tx.wallet.update({
                where: { id: sender.wallet.id },
                data: { mainBalance: { decrement: amount } },
            });
            const recipientWallet = await tx.wallet.update({
                where: { id: recipient.wallet.id },
                data: { mainBalance: { increment: amount } },
            });
            await tx.transaction.create({
                data: {
                    userId: sender.id,
                    walletId: sender.wallet.id,
                    amount,
                    type: client_1.TransactionType.WITHDRAW,
                    status: client_1.TransactionStatus.SUCCESS,
                    balanceBefore: senderBalBefore,
                    balanceAfter: senderBalAfter,
                    referenceId: `${referenceId}_OUT`,
                    description: `Transfer sent to ${recipient.firstName || String(recipient.telegramId)}`,
                },
            });
            await tx.transaction.create({
                data: {
                    userId: recipient.id,
                    walletId: recipient.wallet.id,
                    amount,
                    type: client_1.TransactionType.DEPOSIT,
                    status: client_1.TransactionStatus.SUCCESS,
                    balanceBefore: recipientBalBefore,
                    balanceAfter: recipientBalAfter,
                    referenceId: `${referenceId}_IN`,
                    description: `Transfer received from ${sender.firstName || String(sender.telegramId)}`,
                },
            });
            return [senderWallet, recipientWallet];
        });
        const newSenderBalance = Number(updatedSenderWallet.mainBalance);
        const newSenderPlayBalance = Number(updatedSenderWallet.playBalance);
        const newRecipientBalance = Number(updatedRecipientWallet.mainBalance);
        const newRecipientPlayBalance = Number(updatedRecipientWallet.playBalance);
        this.emitWalletUpdate(sender.id, newSenderBalance, newSenderPlayBalance);
        this.emitWalletUpdate(recipient.id, newRecipientBalance, newRecipientPlayBalance);
        return {
            success: true,
            amount,
            senderBalance: newSenderBalance,
            recipientTelegramId: String(recipient.telegramId),
            recipientName: recipient.firstName || recipient.username || "User",
        };
    }
    static async findRecipient(telegramId) {
        return prisma_1.default.user.findUnique({
            where: { telegramId: BigInt(telegramId) },
            include: { wallet: true },
        });
    }
    static async savePhoneNumber(telegramId, phoneNumber) {
        return prisma_1.default.user.update({
            where: { telegramId: BigInt(telegramId) },
            data: { phoneNumber },
        });
    }
    static async saveLanguage(telegramId, language) {
        return prisma_1.default.user.update({
            where: { telegramId: BigInt(telegramId) },
            data: { language },
        });
    }
    static async getLanguage(telegramId) {
        const user = await prisma_1.default.user.findUnique({
            where: { telegramId: BigInt(telegramId) },
            select: { language: true },
        });
        return user?.language || "am";
    }
}
exports.TransferService = TransferService;
