import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { success } from "../utils/response";
import { TelegramLoginSchema } from "../dtos/auth/telegram-login.dto";
import { DevLoginSchema } from "../dtos/auth/dev-login.dto";

export class AuthController {
  private authService = new AuthService();

  telegramLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = TelegramLoginSchema.parse(req.body);
      const result = await this.authService.telegramLogin(data);
      return success(res, result, "Login successful");
    } catch (err) {
      next(err);
    }
  };

  devLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({ success: false, error: "Not available" });
      }

      const data = DevLoginSchema.parse(req.body);
      const result = await this.authService.devLogin(data);
      return success(res, result, "Dev login successful");
    } catch (err) {
      next(err);
    }
  };
}
