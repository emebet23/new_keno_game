"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const client_1 = require("@prisma/client");
class JwtService {
    static sign(payload) {
        return jsonwebtoken_1.default.sign({
            userId: payload.userId,
            telegramId: payload.telegramId.toString(),
            role: payload.role ?? client_1.Role.USER,
        }, env_1.env.JWT_SECRET, {
            expiresIn: "7d",
        });
    }
    static verify(token) {
        return jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
}
exports.JwtService = JwtService;
