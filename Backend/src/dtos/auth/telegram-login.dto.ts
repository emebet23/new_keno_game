import { z } from "zod";

export const TelegramLoginSchema = z.object({
  telegramId: z.coerce.bigint(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  initData: z.string().optional(),
});

export type TelegramLoginDto = z.infer<typeof TelegramLoginSchema>;
