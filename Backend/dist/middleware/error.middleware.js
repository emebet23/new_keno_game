"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
function errorHandler(err, req, res, _next) {
    console.error("[ErrorHandler]", err);
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            message: "Validation Error",
            errors: err.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }
    if (err instanceof errors_1.WalletNotFoundError) {
        return res.status(404).json({
            success: false,
            message: err.message,
        });
    }
    if (err instanceof errors_1.InsufficientBalanceError) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    if (err instanceof Error) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
}
