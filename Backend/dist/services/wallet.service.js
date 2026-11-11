"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const wallet_repository_1 = require("../repositories/wallet.repository");
const transaction_service_1 = require("./transaction.service");
const errors_1 = require("../utils/errors");
class WalletService {
    repository = new wallet_repository_1.WalletRepository();
    transactionService = new transaction_service_1.TransactionService();
    async getWallet(userId) {
        const wallet = await this.repository.findByUserId(userId);
        if (!wallet) {
            throw new errors_1.WalletNotFoundError();
        }
        const totalBalance = Number(wallet.playBalance) + Number(wallet.mainBalance);
        return {
            ...wallet,
            totalBalance,
        };
    }
    async hasEnoughBalance(tx, userId, amount) {
        const wallet = await this.repository.findByUserIdTx(tx, userId);
        if (!wallet) {
            throw new errors_1.WalletNotFoundError();
        }
        return Number(wallet.playBalance) + Number(wallet.mainBalance) >= amount;
    }
    async deductBet(tx, userId, amount) {
        const wallet = await this.repository.findByUserIdTx(tx, userId);
        if (!wallet) {
            throw new errors_1.WalletNotFoundError();
        }
        const balanceBefore = Number(wallet.playBalance) + Number(wallet.mainBalance);
        let play = Number(wallet.playBalance);
        let main = Number(wallet.mainBalance);
        if (play >= amount) {
            play -= amount;
        }
        else {
            const remaining = amount - play;
            play = 0;
            if (main < remaining) {
                throw new errors_1.InsufficientBalanceError();
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
    async creditWin(tx, userId, amount) {
        const wallet = await this.repository.findByUserIdTx(tx, userId);
        if (!wallet) {
            throw new errors_1.WalletNotFoundError();
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
    async deposit(userId, amount, reference) {
        if (amount <= 0)
            throw new Error("Deposit amount must be positive");
        return prisma_1.default.$transaction(async (tx) => {
            const wallet = await this.repository.findByUserIdTx(tx, userId);
            if (!wallet)
                throw new errors_1.WalletNotFoundError();
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
    async withdraw(userId, amount, reference) {
        if (amount <= 0)
            throw new Error("Withdrawal amount must be positive");
        return prisma_1.default.$transaction(async (tx) => {
            const wallet = await this.repository.findByUserIdTx(tx, userId);
            if (!wallet)
                throw new errors_1.WalletNotFoundError();
            const main = Number(wallet.mainBalance);
            if (main < amount)
                throw new errors_1.InsufficientBalanceError();
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
exports.WalletService = WalletService;
