import { z } from "zod";
import { Wallet } from "@prisma/client";

export const WalletSchema = z.object({
  userId: z.string().uuid(),
  playBalance: z.number().min(0),
  mainBalance: z.number().min(0),
  currency: z.string().default("ETB"),
});

export type WalletDto = z.infer<typeof WalletSchema>;

export interface WalletOperationResult {
  wallet: Wallet;
  balanceBefore: number;
  balanceAfter: number;
}
