"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
class WalletRepository {
    async findByUserId(userId) {
        return prisma_1.default.wallet.findUnique({
            where: { userId },
        });
    }
    async findByUserIdTx(tx, userId) {
        return tx.wallet.findUnique({
            where: { userId },
        });
    }
    async update(tx, userId, playBalance, mainBalance) {
        return tx.wallet.update({
            where: { userId },
            data: {
                playBalance: new client_1.Prisma.Decimal(playBalance),
                mainBalance: new client_1.Prisma.Decimal(mainBalance),
            },
        });
    }
}
exports.WalletRepository = WalletRepository;
