import { TransactionStatus, TransactionType } from "@prisma/client";

export interface CreateTransactionDto {
  userId: string;

  type: TransactionType;

  amount: number;

  balanceBefore: number;

  balanceAfter: number;

  status?: TransactionStatus;

  reference?: string;
}
