import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { TransactionRepository } from "../repositories/transaction.repository";
import { CreateTransactionDto } from "../dtos/transaction/create-transaction.dto";

export class TransactionService {
  private repository = new TransactionRepository();

  async record(tx: Prisma.TransactionClient, dto: CreateTransactionDto) {
    return this.repository.create(tx, {
      ...dto,
      status: dto.status ?? TransactionStatus.SUCCESS,
    });
  }

  async bet(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    before: number,
    after: number,
    reference?: string,
  ) {
    return this.record(tx, {
      userId,
      type: TransactionType.BET,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      reference,
    });
  }

  async win(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    before: number,
    after: number,
    reference?: string,
  ) {
    return this.record(tx, {
      userId,
      type: TransactionType.WIN,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      reference,
    });
  }

  async deposit(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    before: number,
    after: number,
    reference?: string,
  ) {
    return this.record(tx, {
      userId,
      type: TransactionType.DEPOSIT,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      reference,
    });
  }

  async withdraw(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    before: number,
    after: number,
    reference?: string,
  ) {
    return this.record(tx, {
      userId,
      type: TransactionType.WITHDRAW,
      amount,
      balanceBefore: before,
      balanceAfter: after,
      reference,
    });
  }

  async getUserTransactions(userId: string, page = 1, limit = 20) {
    return this.repository.history(userId, page, limit);
  }
}
