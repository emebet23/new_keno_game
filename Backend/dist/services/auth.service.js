"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const user_repository_1 = require("../repositories/user.repository");
const jwt_1 = require("../utils/jwt");
const client_1 = require("@prisma/client");
class AuthService {
    userRepository = new user_repository_1.UserRepository();
    async devLogin(data) {
        if (process.env.NODE_ENV !== "development") {
            throw new Error("Dev login is only available in development");
        }
        const telegramId = data.telegramId ?? BigInt(Date.now());
        let user = await this.userRepository.findByTelegramId(telegramId);
        if (!user) {
            user = await this.userRepository.create({
                telegramId,
                username: data.username ?? `dev_${telegramId}`,
                firstName: data.firstName,
                role: data.role,
            });
        }
        const token = jwt_1.JwtService.sign({
            userId: user.id,
            telegramId: user.telegramId,
            role: user.role,
        });
        return { user, token };
    }
    async telegramLogin(data) {
        if (data.initData && process.env.TELEGRAM_BOT_TOKEN) {
            this.verifyTelegramInitData(data.initData, process.env.TELEGRAM_BOT_TOKEN);
        }
        let user = await this.userRepository.findByTelegramId(data.telegramId);
        if (!user) {
            user = await this.userRepository.create({
                telegramId: data.telegramId,
                username: data.username,
                firstName: data.firstName,
                lastName: data.lastName,
                role: client_1.Role.USER,
            });
        }
        else {
            user = await this.userRepository.updateProfile(user.id, {
                username: data.username ?? undefined,
                firstName: data.firstName ?? undefined,
                lastName: data.lastName ?? undefined,
            });
        }
        const token = jwt_1.JwtService.sign({
            userId: user.id,
            telegramId: user.telegramId,
            role: user.role,
        });
        return {
            user,
            token,
        };
    }
    verifyTelegramInitData(initData, botToken) {
        try {
            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get("hash");
            if (!hash)
                return false;
            urlParams.delete("hash");
            const params = [];
            urlParams.forEach((val, key) => params.push(`${key}=${val}`));
            params.sort();
            const dataCheckString = params.join("\n");
            const secretKey = crypto_1.default.createHmac("sha256", "WebAppData").update(botToken).digest();
            const calculatedHash = crypto_1.default.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
            return calculatedHash === hash;
        }
        catch {
            return false;
        }
    }
}
exports.AuthService = AuthService;
