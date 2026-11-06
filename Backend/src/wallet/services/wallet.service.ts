import { TransactionType, TransactionStatus, WalletSource } from "@prisma/client";
import prisma from "../../config/prisma";
import { getIO } from "../../socket/socket";
import { SOCKET_EVENTS } from "../../socket/events";
import { userRoom } from "../../socket/rooms";

export interface DualBalance {
  balance: number;
  playBalance: number;
  totalBalance: number;
}

export class WalletService {
  private emitWalletUpdate(userId: string, balance: number, playBalance: number) {
    try {
      getIO().to(userRoom(userId)).emit(SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
    } catch {}
  }

  async getBalance(userId: string): Promise<DualBalance> {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const mainBalance = Number(wallet?.mainBalance ?? 0);
    const playBalance = Number(wallet?.playBalance ?? 0);
    return { balance: mainBalance, playBalance, totalBalance: mainBalance + playBalance };
  }

  async debitForBet(userId: string, amount: number) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found.");

    const currentPlayBalance = Number(wallet.playBalance);
    const currentMainBalance = Number(wallet.mainBalance);
    const totalAvailable = currentPlayBalance + currentMainBalance;

    if (totalAvailable < amount) {
      throw new Error(
        `Insufficient balance. Available: ${totalAvailable.toFixed(2)} ETB (Play: ${currentPlayBalance.toFixed(2)}, Main: ${currentMainBalance.toFixed(2)}).`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
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
            type: TransactionType.BET,
            walletSource: WalletSource.PLAY,
            status: TransactionStatus.SUCCESS,
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
            type: TransactionType.BET,
            walletSource: WalletSource.MAIN,
            status: TransactionStatus.SUCCESS,
            balanceBefore: mainBefore,
            balanceAfter: mainBefore - mainDeducted,
            description: "Game bet (Main Wallet)",
          },
        });
      }

      const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
      return updatedWallet!;
    });

    const mainBalance = Number(result.mainBalance);
    const playBalance = Number(result.playBalance);
    this.emitWalletUpdate(userId, mainBalance, playBalance);

    return { success: true, balance: mainBalance, playBalance };
  }

  async credit(userId: string, amount: number) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found.");

    const balBefore = Number(wallet.mainBalance);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { mainBalance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          amount,
          type: TransactionType.WIN,
          walletSource: WalletSource.MAIN,
          status: TransactionStatus.SUCCESS,
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

  async referralCredit(userId: string, amount: number, description: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found.");

    const playBefore = Number(wallet.playBalance);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { playBalance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          amount,
          type: TransactionType.REFERRAL,
          walletSource: WalletSource.PLAY,
          status: TransactionStatus.SUCCESS,
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

  async transfer(senderUserId: string, recipientUserId: string, amount: number) {
    if (senderUserId === recipientUserId) {
      throw new Error("Cannot transfer to yourself.");
    }

    const senderWallet = await prisma.wallet.findUnique({ where: { userId: senderUserId } });
    if (!senderWallet) throw new Error("Sender wallet not found.");

    const recipientWallet = await prisma.wallet.findUnique({ where: { userId: recipientUserId } });
    if (!recipientWallet) throw new Error("Recipient wallet not found.");

    if (Number(senderWallet.mainBalance) < amount) {
      throw new Error("Insufficient Main Wallet balance.");
    }

    const senderBalBefore = Number(senderWallet.mainBalance);
    const recipientBalBefore = Number(recipientWallet.mainBalance);

    const result = await prisma.$transaction(async (tx) => {
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
          type: TransactionType.TRANSFER,
          walletSource: WalletSource.MAIN,
          status: TransactionStatus.SUCCESS,
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
          type: TransactionType.TRANSFER,
          walletSource: WalletSource.MAIN,
          status: TransactionStatus.SUCCESS,
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
