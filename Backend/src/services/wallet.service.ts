import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { WalletRepository } from "../repositories/wallet.repository";
import { TransactionService } from "./transaction.service";
import { WalletNotFoundError, InsufficientBalanceError } from "../utils/errors";
import { WalletOperationResult } from "../dtos/wallet/wallet.dto";

export class WalletService {
  private repository = new WalletRepository();
  private transactionService = new TransactionService();

  async getWallet(userId: string) {
    const wallet = await this.repository.findByUserId(userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const totalBalance = Number(wallet.playBalance) + Number(wallet.mainBalance);

    return {
      ...wallet,
      totalBalance,
    };
  }

  async hasEnoughBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number
  ) {
    const wallet = await this.repository.findByUserIdTx(tx, userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    return Number(wallet.playBalance) + Number(wallet.mainBalance) >= amount;
  }

  async deductBet(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number
  ): Promise<WalletOperationResult> {
    const wallet = await this.repository.findByUserIdTx(tx, userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const balanceBefore = Number(wallet.playBalance) + Number(wallet.mainBalance);

    let play = Number(wallet.playBalance);
    let main = Number(wallet.mainBalance);

    if (play >= amount) {
      play -= amount;
    } else {
      const remaining = amount - play;
      play = 0;

      if (main < remaining) {
        throw new InsufficientBalanceError();
      }

      main -= remaining;
    }

    const updated = await this.repository.update(tx, userId, play, main);

    return {
      wallet: updated,
      balanceBefore,
      balanceAfter: play + main,
    };
  }

  async creditWin(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number
  ): Promise<WalletOperationResult> {
    const wallet = await this.repository.findByUserIdTx(tx, userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const balanceBefore = Number(wallet.playBalance) + Number(wallet.mainBalance);
    const play = Number(wallet.playBalance);
    const main = Number(wallet.mainBalance) + amount;

    const updated = await this.repository.update(tx, userId, play, main);

    return {
      wallet: updated,
      balanceBefore,
      balanceAfter: play + main,
    };
  }

  async deposit(userId: string, amount: number, reference?: string) {
    if (amount <= 0) throw new Error("Deposit amount must be positive");

    return prisma.$transaction(async (tx) => {
      const wallet = await this.repository.findByUserIdTx(tx, userId);
      if (!wallet) throw new WalletNotFoundError();

      const before = Number(wallet.playBalance) + Number(wallet.mainBalance);
      const newPlay = Number(wallet.playBalance) + amount;
      const updated = await this.repository.update(tx, userId, newPlay, Number(wallet.mainBalance));
      const after = before + amount;

      await this.transactionService.deposit(tx, userId, amount, before, after, reference);

      return {
        wallet: updated,
        totalBalance: after,
      };
    });
  }

  async withdraw(userId: string, amount: number, reference?: string) {
    if (amount <= 0) throw new Error("Withdrawal amount must be positive");

    return prisma.$transaction(async (tx) => {
      const wallet = await this.repository.findByUserIdTx(tx, userId);
      if (!wallet) throw new WalletNotFoundError();

      const main = Number(wallet.mainBalance);
      if (main < amount) throw new InsufficientBalanceError();

      const before = Number(wallet.playBalance) + main;
      const newMain = main - amount;
      const updated = await this.repository.update(tx, userId, Number(wallet.playBalance), newMain);
      const after = before - amount;

      await this.transactionService.withdraw(tx, userId, amount, before, after, reference);

      return {
        wallet: updated,
        totalBalance: after,
      };
    });
  }
}
