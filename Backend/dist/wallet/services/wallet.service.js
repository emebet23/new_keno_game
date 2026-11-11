"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../config/prisma"));
const socket_1 = require("../../socket/socket");
const events_1 = require("../../socket/events");
const rooms_1 = require("../../socket/rooms");
class WalletService {
    emitWalletUpdate(userId, balance, playBalance) {
        try {
            (0, socket_1.getIO)().to((0, rooms_1.userRoom)(userId)).emit(events_1.SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
        }
        catch { }
    }
    async getBalance(userId) {
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        const mainBalance = Number(wallet?.mainBalance ?? 0);
        const playBalance = Number(wallet?.playBalance ?? 0);
        return { balance: mainBalance, playBalance, totalBalance: mainBalance + playBalance };
    }
    async debitForBet(userId, amount) {
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new Error("Wallet not found.");
        const currentPlayBalance = Number(wallet.playBalance);
        const currentMainBalance = Number(wallet.mainBalance);
        const totalAvailable = currentPlayBalance + currentMainBalance;
        if (totalAvailable < amount) {
            throw new Error(`Insufficient balance. Available: ${totalAvailable.toFixed(2)} ETB (Play: ${currentPlayBalance.toFixed(2)}, Main: ${currentMainBalance.toFixed(2)}).`);
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            let remaining = amount;
            let playDeducted = 0;
            let mainDeducted = 0;
            if (currentPlayBalance > 0 && remaining > 0) {
                playDeducted = Math.min(currentPlayBalance, remaining);
                remaining -= playDeducted;
            }
            if (remaining > 0) {
                mainDeducted = remaining;
                remaining = 0;
            }
            if (playDeducted > 0) {
                await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { playBalance: { decrement: playDeducted } },
                });
                await tx.transaction.create({
                    data: {
                        userId,
                        walletId: wallet.id,
                        amount: playDeducted,
                        type: client_1.TransactionType.BET,
                        walletSource: client_1.WalletSource.PLAY,
                        status: client_1.TransactionStatus.SUCCESS,
                        balanceBefore: currentPlayBalance,
                        balanceAfter: currentPlayBalance - playDeducted,
                        description: "Game bet (Play Wallet)",
                    },
                });
            }
            if (mainDeducted > 0) {
                const mainBefore = currentMainBalance;
                await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { mainBalance: { decrement: mainDeducted } },
                });
                await tx.transaction.create({
                    data: {
                        userId,
                        walletId: wallet.id,
                        amount: mainDeducted,
                        type: client_1.TransactionType.BET,
                        walletSource: client_1.WalletSource.MAIN,
                        status: client_1.TransactionStatus.SUCCESS,
                        balanceBefore: mainBefore,
                        balanceAfter: mainBefore - mainDeducted,
                        description: "Game bet (Main Wallet)",
                    },
                });
            }
            const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
            return updatedWallet;
        });
        const mainBalance = Number(result.mainBalance);
        const playBalance = Number(result.playBalance);
        this.emitWalletUpdate(userId, mainBalance, playBalance);
        return { success: true, balance: mainBalance, playBalance };
    }
    async credit(userId, amount) {
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new Error("Wallet not found.");
        const balBefore = Number(wallet.mainBalance);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { mainBalance: { increment: amount } },
            });
            await tx.transaction.create({
                data: {
                    userId,
                    walletId: wallet.id,
                    amount,
                    type: client_1.TransactionType.WIN,
                    walletSource: client_1.WalletSource.MAIN,
                    status: client_1.TransactionStatus.SUCCESS,
                    balanceBefore: balBefore,
                    balanceAfter: balBefore + amount,
                    description: "Game win payout",
                },
            });
            return updated;
        });
        const mainBalance = Number(result.mainBalance);
        const playBalance = Number(result.playBalance);
        this.emitWalletUpdate(userId, mainBalance, playBalance);
        return { success: true, balance: mainBalance, playBalance };
    }
    async referralCredit(userId, amount, description) {
        const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new Error("Wallet not found.");
        const playBefore = Number(wallet.playBalance);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { playBalance: { increment: amount } },
            });
            await tx.transaction.create({
                data: {
                    userId,
                    walletId: wallet.id,
                    amount,
                    type: client_1.TransactionType.REFERRAL,
                    walletSource: client_1.WalletSource.PLAY,
                    status: client_1.TransactionStatus.SUCCESS,
                    balanceBefore: playBefore,
                    balanceAfter: playBefore + amount,
                    description,
                },
            });
            return updated;
        });
        const mainBalance = Number(result.mainBalance);
        const playBalance = Number(result.playBalance);
        this.emitWalletUpdate(userId, mainBalance, playBalance);
        return { success: true, balance: mainBalance, playBalance };
    }
    async transfer(senderUserId, recipientUserId, amount) {
        if (senderUserId === recipientUserId) {
            throw new Error("Cannot transfer to yourself.");
        }
        const senderWallet = await prisma_1.default.wallet.findUnique({ where: { userId: senderUserId } });
        if (!senderWallet)
            throw new Error("Sender wallet not found.");
        const recipientWallet = await prisma_1.default.wallet.findUnique({ where: { userId: recipientUserId } });
        if (!recipientWallet)
            throw new Error("Recipient wallet not found.");
        if (Number(senderWallet.mainBalance) < amount) {
            throw new Error("Insufficient Main Wallet balance.");
        }
        const senderBalBefore = Number(senderWallet.mainBalance);
        const recipientBalBefore = Number(recipientWallet.mainBalance);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const updatedSender = await tx.wallet.update({
                where: { id: senderWallet.id },
                data: { mainBalance: { decrement: amount } },
            });
            const updatedRecipient = await tx.wallet.update({
                where: { id: recipientWallet.id },
                data: { mainBalance: { increment: amount } },
            });
            await tx.transaction.create({
                data: {
                    userId: senderUserId,
                    walletId: senderWallet.id,
                    amount,
                    type: client_1.TransactionType.TRANSFER,
                    walletSource: client_1.WalletSource.MAIN,
                    status: client_1.TransactionStatus.SUCCESS,
                    balanceBefore: senderBalBefore,
                    balanceAfter: senderBalBefore - amount,
                    description: "Transfer sent",
                },
            });
            await tx.transaction.create({
                data: {
                    userId: recipientUserId,
                    walletId: recipientWallet.id,
                    amount,
                    type: client_1.TransactionType.TRANSFER,
                    walletSource: client_1.WalletSource.MAIN,
                    status: client_1.TransactionStatus.SUCCESS,
                    balanceBefore: recipientBalBefore,
                    balanceAfter: recipientBalBefore + amount,
                    description: "Transfer received",
                },
            });
            return {
                senderBalance: Number(updatedSender.mainBalance),
                senderPlayBalance: Number(updatedSender.playBalance),
                recipientBalance: Number(updatedRecipient.mainBalance),
                recipientPlayBalance: Number(updatedRecipient.playBalance),
            };
        });
        this.emitWalletUpdate(senderUserId, result.senderBalance, result.senderPlayBalance);
        this.emitWalletUpdate(recipientUserId, result.recipientBalance, result.recipientPlayBalance);
        return {
            success: true,
            senderBalance: result.senderBalance,
            recipientBalance: result.recipientBalance,
        };
    }
}
exports.WalletService = WalletService;
