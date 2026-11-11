"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authenticateAdmin = authenticateAdmin;
exports.authenticateSuperAdmin = authenticateSuperAdmin;
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
const client_1 = require("@prisma/client");
function authenticate(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) {
        return (0, response_1.error)(res, "Unauthorized - Missing token", 401);
    }
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : auth;
    if (!token) {
        return (0, response_1.error)(res, "Unauthorized - Invalid token format", 401);
    }
    try {
        const payload = jwt_1.JwtService.verify(token);
        req.user = payload;
        next();
    }
    catch {
        return (0, response_1.error)(res, "Invalid or expired token", 401);
    }
}
function authenticateAdmin(req, res, next) {
    authenticate(req, res, () => {
        if (req.user?.role !== client_1.Role.ADMIN && req.user?.role !== client_1.Role.SUPERADMIN) {
            return (0, response_1.error)(res, "Forbidden - Admin access required", 403);
        }
        next();
    });
}
function authenticateSuperAdmin(req, res, next) {
    authenticate(req, res, () => {
        if (req.user?.role !== client_1.Role.SUPERADMIN) {
            return (0, response_1.error)(res, "Forbidden - SuperAdmin access required", 403);
        }
        next();
    });
}
