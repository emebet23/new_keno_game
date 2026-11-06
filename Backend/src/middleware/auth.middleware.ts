import { Request, Response, NextFunction } from "express";
import { JwtService } from "../utils/jwt";
import { error } from "../utils/response";
import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        telegramId: string;
        role: Role;
      };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;

  if (!auth) {
    return error(res, "Unauthorized - Missing token", 401);
  }

  const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : auth;

  if (!token) {
    return error(res, "Unauthorized - Invalid token format", 401);
  }

  try {
    const payload = JwtService.verify(token);
    req.user = payload;
    next();
  } catch {
    return error(res, "Invalid or expired token", 401);
  }
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, () => {
    if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
      return error(res, "Forbidden - Admin access required", 403);
    }
    next();
  });
}

export function authenticateSuperAdmin(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, () => {
    if (req.user?.role !== Role.SUPERADMIN) {
      return error(res, "Forbidden - SuperAdmin access required", 403);
    }
    next();
  });
}
