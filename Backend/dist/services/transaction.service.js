"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionService = void 0;
const client_1 = require("@prisma/client");
const transaction_repository_1 = require("../repositories/transaction.repository");
class TransactionService {
    repository = new transaction_repository_1.TransactionRepository();
    async record(tx, dto) {
        return this.repository.create(tx, {
            ...dto,
            status: dto.status ?? client_1.TransactionStatus.SUCCESS,
        });
    }
    async bet(tx, userId, amount, before, after, reference) {
        return this.record(tx, {
            userId,
            type: client_1.TransactionType.BET,
            amount,
            balanceBefore: before,
            balanceAfter: after,
            reference,
        });
    }
    async win(tx, userId, amount, before, after, reference) {
        return this.record(tx, {
            userId,
            type: client_1.TransactionType.WIN,
            amount,
            balanceBefore: before,
            balanceAfter: after,
            reference,
        });
    }
    async deposit(tx, userId, amount, before, after, reference) {
        return this.record(tx, {
            userId,
            type: client_1.TransactionType.DEPOSIT,
            amount,
            balanceBefore: before,
            balanceAfter: after,
            reference,
        });
    }
    async withdraw(tx, userId, amount, before, after, reference) {
        return this.record(tx, {
            userId,
            type: client_1.TransactionType.WITHDRAW,
            amount,
            balanceBefore: before,
            balanceAfter: after,
            reference,
        });
    }
    async getUserTransactions(userId, page = 1, limit = 20) {
        return this.repository.history(userId, page, limit);
    }
}
exports.TransactionService = TransactionService;
