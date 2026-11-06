import { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service";
import { success } from "../utils/response";
import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";

const UpdateSettingsSchema = z.object({
  numberPoolSize: z.number().int().min(20).max(100).optional(),
  drawCount: z.number().int().min(1).max(50).optional(),
  minPick: z.number().int().min(1).optional(),
  maxPick: z.number().int().max(20).optional(),
  minBet: z.number().positive().optional(),
  maxBet: z.number().positive().optional(),
  payoutTable: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  rtpPercentage: z.number().min(0).max(100).optional(),
  houseEdge: z.number().min(0).max(100).optional(),
  drawIntervalSec: z.number().int().positive().optional(),
});

const UpdateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

const UpdateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export class AdminController {
  private adminService = new AdminService();

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await this.adminService.getSettings();
      return success(res, settings);
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateSettingsSchema.parse(req.body);
      const settings = await this.adminService.updateSettings(body);
      return success(res, settings, "Settings updated successfully");
    } catch (err) {
      next(err);
    }
  };

  getFinancialAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await this.adminService.getFinancialAnalytics();
      return success(res, analytics);
    } catch (err) {
      next(err);
    }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search ? String(req.query.search) : undefined;
      const users = await this.adminService.getUsers(page, limit, search);
      return success(res, users);
    } catch (err) {
      next(err);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { status } = UpdateUserStatusSchema.parse(req.body);
      const updated = await this.adminService.setUserStatus(id, status);
      return success(res, updated, `User status updated to ${status}`);
    } catch (err) {
      next(err);
    }
  };

  updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { role } = UpdateUserRoleSchema.parse(req.body);
      const updated = await this.adminService.setUserRole(id, role);
      return success(res, updated, `User role updated to ${role}`);
    } catch (err) {
      next(err);
    }
  };

  getReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await this.adminService.getReports();
      return success(res, reports);
    } catch (err) {
      next(err);
    }
  };
}
