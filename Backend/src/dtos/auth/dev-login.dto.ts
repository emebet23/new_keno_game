import { z } from "zod";
import { Role } from "@prisma/client";

export const DevLoginSchema = z.object({
  telegramId: z.coerce.bigint().optional(),
  username: z.string().optional(),
  firstName: z.string().default("Dev User"),
  role: z.nativeEnum(Role).default(Role.USER),
});

export type DevLoginDto = z.infer<typeof DevLoginSchema>;
