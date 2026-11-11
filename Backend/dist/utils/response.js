"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.success = void 0;
const success = (res, data, message = "Success") => {
    return res.status(200).json({
        success: true,
        message,
        data,
    });
};
exports.success = success;
const error = (res, message = "Error", status = 400) => {
    return res.status(status).json({
        success: false,
        message,
    });
};
exports.error = error;
