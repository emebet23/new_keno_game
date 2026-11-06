import { z } from "zod";

export const CreateTicketSchema = z.object({
  userId: z.string().uuid(),
  gameId: z.string().uuid(),
  selectedNumbers: z
    .array(z.number().int().min(1).max(80))
    .min(1)
    .max(10),
  betAmount: z.number().positive(),
  matches: z.number().int().min(0).optional(),
  multiplier: z.number().positive().optional(),
  payout: z.number().min(0).optional(),
});

export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
