import crypto from "crypto";
import { UserRepository } from "../repositories/user.repository";
import { JwtService } from "../utils/jwt";
import { TelegramLoginDto } from "../dtos/auth/telegram-login.dto";
import { DevLoginDto } from "../dtos/auth/dev-login.dto";
import { Role } from "@prisma/client";

export class AuthService {
  private userRepository = new UserRepository();

  async devLogin(data: DevLoginDto) {
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

    const token = JwtService.sign({
      userId: user.id,
      telegramId: user.telegramId,
      role: user.role,
    });

    return { user, token };
  }

  async telegramLogin(data: TelegramLoginDto) {
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
        role: Role.USER,
      });
    } else {
      user = await this.userRepository.updateProfile(user.id, {
        username: data.username ?? undefined,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
      });
    }

    const token = JwtService.sign({
      userId: user.id,
      telegramId: user.telegramId,
      role: user.role,
    });

    return {
      user,
      token,
    };
  }

  private verifyTelegramInitData(initData: string, botToken: string): boolean {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get("hash");
      if (!hash) return false;

      urlParams.delete("hash");

      const params: string[] = [];
      urlParams.forEach((val, key) => params.push(`${key}=${val}`));
      params.sort();

      const dataCheckString = params.join("\n");
      const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
      const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

      return calculatedHash === hash;
    } catch {
      return false;
    }
  }
}
