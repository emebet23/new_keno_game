"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const admin_service_1 = require("../services/admin.service");
const response_1 = require("../utils/response");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const UpdateSettingsSchema = zod_1.z.object({
    numberPoolSize: zod_1.z.number().int().min(20).max(100).optional(),
    drawCount: zod_1.z.number().int().min(1).max(50).optional(),
    minPick: zod_1.z.number().int().min(1).optional(),
    maxPick: zod_1.z.number().int().max(20).optional(),
    minBet: zod_1.z.number().positive().optional(),
    maxBet: zod_1.z.number().positive().optional(),
    payoutTable: zod_1.z.record(zod_1.z.string(), zod_1.z.record(zod_1.z.string(), zod_1.z.number())).optional(),
    rtpPercentage: zod_1.z.number().min(0).max(100).optional(),
    houseEdge: zod_1.z.number().min(0).max(100).optional(),
    drawIntervalSec: zod_1.z.number().int().positive().optional(),
});
const UpdateUserStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.UserStatus),
});
const UpdateUserRoleSchema = zod_1.z.object({
    role: zod_1.z.nativeEnum(client_1.Role),
});
class AdminController {
    adminService = new admin_service_1.AdminService();
    getSettings = async (req, res, next) => {
        try {
            const settings = await this.adminService.getSettings();
            return (0, response_1.success)(res, settings);
        }
        catch (err) {
            next(err);
        }
    };
    updateSettings = async (req, res, next) => {
        try {
            const body = UpdateSettingsSchema.parse(req.body);
            const settings = await this.adminService.updateSettings(body);
            return (0, response_1.success)(res, settings, "Settings updated successfully");
        }
        catch (err) {
            next(err);
        }
    };
    getFinancialAnalytics = async (req, res, next) => {
        try {
            const analytics = await this.adminService.getFinancialAnalytics();
            return (0, response_1.success)(res, analytics);
        }
        catch (err) {
            next(err);
        }
    };
    getUsers = async (req, res, next) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const search = req.query.search ? String(req.query.search) : undefined;
            const users = await this.adminService.getUsers(page, limit, search);
            return (0, response_1.success)(res, users);
        }
        catch (err) {
            next(err);
        }
    };
    updateUserStatus = async (req, res, next) => {
        try {
            const id = String(req.params.id);
            const { status } = UpdateUserStatusSchema.parse(req.body);
            const updated = await this.adminService.setUserStatus(id, status);
            return (0, response_1.success)(res, updated, `User status updated to ${status}`);
        }
        catch (err) {
            next(err);
        }
    };
    updateUserRole = async (req, res, next) => {
        try {
            const id = String(req.params.id);
            const { role } = UpdateUserRoleSchema.parse(req.body);
            const updated = await this.adminService.setUserRole(id, role);
            return (0, response_1.success)(res, updated, `User role updated to ${role}`);
        }
        catch (err) {
            next(err);
        }
    };
    getReports = async (req, res, next) => {
        try {
            const reports = await this.adminService.getReports();
            return (0, response_1.success)(res, reports);
        }
        catch (err) {
            next(err);
        }
    };
}
exports.AdminController = AdminController;
