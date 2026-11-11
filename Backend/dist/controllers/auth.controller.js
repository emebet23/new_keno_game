"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const response_1 = require("../utils/response");
const telegram_login_dto_1 = require("../dtos/auth/telegram-login.dto");
const dev_login_dto_1 = require("../dtos/auth/dev-login.dto");
class AuthController {
    authService = new auth_service_1.AuthService();
    telegramLogin = async (req, res, next) => {
        try {
            const data = telegram_login_dto_1.TelegramLoginSchema.parse(req.body);
            const result = await this.authService.telegramLogin(data);
            return (0, response_1.success)(res, result, "Login successful");
        }
        catch (err) {
            next(err);
        }
    };
    devLogin = async (req, res, next) => {
        try {
            if (process.env.NODE_ENV !== "development") {
                return res.status(403).json({ success: false, error: "Not available" });
            }
            const data = dev_login_dto_1.DevLoginSchema.parse(req.body);
            const result = await this.authService.devLogin(data);
            return (0, response_1.success)(res, result, "Dev login successful");
        }
        catch (err) {
            next(err);
        }
    };
}
exports.AuthController = AuthController;
