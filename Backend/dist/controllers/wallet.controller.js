"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const wallet_service_1 = require("../services/wallet.service");
const transaction_service_1 = require("../services/transaction.service");
const response_1 = require("../utils/response");
const zod_1 = require("zod");
const AmountSchema = zod_1.z.object({
    amount: zod_1.z.number().positive("Amount must be greater than 0"),
    reference: zod_1.z.string().optional(),
});
class WalletController {
    walletService = new wallet_service_1.WalletService();
    transactionService = new transaction_service_1.TransactionService();
    getWallet = async (req, res, next) => {
        try {
            const wallet = await this.walletService.getWallet(req.user.userId);
            return (0, response_1.success)(res, wallet);
        }
        catch (err) {
            next(err);
        }
    };
    getTransactions = async (req, res, next) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const transactions = await this.transactionService.getUserTransactions(req.user.userId, page, limit);
            return (0, response_1.success)(res, transactions);
        }
        catch (err) {
            next(err);
        }
    };
    deposit = async (req, res, next) => {
        try {
            const body = AmountSchema.parse(req.body);
            const result = await this.walletService.deposit(req.user.userId, body.amount, body.reference);
            return (0, response_1.success)(res, result, "Deposit successful");
        }
        catch (err) {
            next(err);
        }
    };
    withdraw = async (req, res, next) => {
        try {
            const body = AmountSchema.parse(req.body);
            const result = await this.walletService.withdraw(req.user.userId, body.amount, body.reference);
            return (0, response_1.success)(res, result, "Withdrawal successful");
        }
        catch (err) {
            next(err);
        }
    };
}
exports.WalletController = WalletController;
