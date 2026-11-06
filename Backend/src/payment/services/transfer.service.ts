import prisma from "../../config/prisma";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { getIO } from "../../socket/socket";
import { SOCKET_EVENTS } from "../../socket/events";
import { userRoom } from "../../socket/rooms";

export const MIN_TRANSFER_AMOUNT = 20;

export type TransferErrorCode =
  | "INVALID_AMOUNT"
  | "BELOW_MINIMUM"
  | "SELF_TRANSFER"
  | "SENDER_WALLET_NOT_FOUND"
  | "RECIPIENT_NOT_REGISTERED"
  | "RECIPIENT_INACTIVE"
  | "INSUFFICIENT_BALANCE";

type TransferResult = {
  success: boolean;
  errorCode?: TransferErrorCode;
  currentBalance?: number;
  amount?: number;
  senderBalance?: number;
  recipientTelegramId?: string;
  recipientName?: string;
};

export class TransferService {
  private static emitWalletUpdate(userId: string, balance: number, playBalance: number) {
    try {
      getIO().to(userRoom(userId)).emit(SOCKET_EVENTS.WALLET_UPDATED, { balance, playBalance });
    } catch {}
  }

  static async transfer(
    senderTelegramId: string,
    recipientTelegramId: string,
    amount: number,
  ): Promise<TransferResult> {
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return { success: false, errorCode: "INVALID_AMOUNT" };
    }
    if (amount < MIN_TRANSFER_AMOUNT) {
      return { success: false, errorCode: "BELOW_MINIMUM" };
    }
    amount = Math.round(amount * 100) / 100;
    if (senderTelegramId === recipientTelegramId) {
      return { success: false, errorCode: "SELF_TRANSFER" };
    }

    const sender = await prisma.user.findUnique({
      where: { telegramId: BigInt(senderTelegramId) },
      include: { wallet: true },
    });
    if (!sender?.wallet) {
      return { success: false, errorCode: "SENDER_WALLET_NOT_FOUND" };
    }

    const recipient = await prisma.user.findUnique({
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

    const [updatedSenderWallet, updatedRecipientWallet] =
      await prisma.$transaction(async (tx) => {
        const senderBalBefore = Number(sender.wallet!.mainBalance);
        const senderBalAfter = senderBalBefore - amount;
        const recipientBalBefore = Number(recipient.wallet!.mainBalance);
        const recipientBalAfter = recipientBalBefore + amount;

        const senderWallet = await tx.wallet.update({
          where: { id: sender.wallet!.id },
          data: { mainBalance: { decrement: amount } },
        });

        const recipientWallet = await tx.wallet.update({
          where: { id: recipient.wallet!.id },
          data: { mainBalance: { increment: amount } },
        });

        await tx.transaction.create({
          data: {
            userId: sender.id,
            walletId: sender.wallet!.id,
            amount,
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.SUCCESS,
            balanceBefore: senderBalBefore,
            balanceAfter: senderBalAfter,
            referenceId: `${referenceId}_OUT`,
            description: `Transfer sent to ${recipient.firstName || String(recipient.telegramId)}`,
          },
        });

        await tx.transaction.create({
          data: {
            userId: recipient.id,
            walletId: recipient.wallet!.id,
            amount,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.SUCCESS,
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

  static async findRecipient(telegramId: string) {
    return prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: { wallet: true },
    });
  }

  static async savePhoneNumber(telegramId: string, phoneNumber: string) {
    return prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: { phoneNumber },
    });
  }

  static async saveLanguage(telegramId: string, language: string) {
    return prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: { language },
    });
  }

  static async getLanguage(telegramId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { language: true },
    });
    return user?.language || "am";
  }
}
