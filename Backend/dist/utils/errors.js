"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsufficientBalanceError = exports.WalletNotFoundError = void 0;
class WalletNotFoundError extends Error {
    constructor() {
        super("Wallet not found");
    }
}
exports.WalletNotFoundError = WalletNotFoundError;
class InsufficientBalanceError extends Error {
    constructor() {
        super("Insufficient balance");
    }
}
exports.InsufficientBalanceError = InsufficientBalanceError;
