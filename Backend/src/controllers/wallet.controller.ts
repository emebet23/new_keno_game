import { Request, Response, NextFunction } from "express";
import { WalletService } from "../services/wallet.service";
import { TransactionService } from "../services/transaction.service";
import { success } from "../utils/response";
import { z } from "zod";

const AmountSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  reference: z.string().optional(),
});

export class WalletController {
  private walletService = new WalletService();
  private transactionService = new TransactionService();

  getWallet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = await this.walletService.getWallet(req.user!.userId);
      return success(res, wallet);
    } catch (err) {
      next(err);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const transactions = await this.transactionService.getUserTransactions(req.user!.userId, page, limit);
      return success(res, transactions);
    } catch (err) {
      next(err);
    }
  };

  deposit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AmountSchema.parse(req.body);
      const result = await this.walletService.deposit(req.user!.userId, body.amount, body.reference);
      return success(res, result, "Deposit successful");
    } catch (err) {
      next(err);
    }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AmountSchema.parse(req.body);
      const result = await this.walletService.withdraw(req.user!.userId, body.amount, body.reference);
      return success(res, result, "Withdrawal successful");
    } catch (err) {
      next(err);
    }
  };
}
