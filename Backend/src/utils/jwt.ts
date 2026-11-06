import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  telegramId: bigint | string;
  role?: Role;
}

export class JwtService {
  static sign(payload: JwtPayload) {
    return jwt.sign(
      {
        userId: payload.userId,
        telegramId: payload.telegramId.toString(),
        role: payload.role ?? Role.USER,
      },
      env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
  }

  static verify(token: string): any {
    return jwt.verify(token, env.JWT_SECRET);
  }
}
