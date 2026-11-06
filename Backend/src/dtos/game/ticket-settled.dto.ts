import { z } from "zod";

export const TicketSettledSchema = z.object({
  ticketId: z.string().uuid(),
  selectedNumbers: z.array(z.number().int().min(1).max(80)),
  drawNumbers: z.array(z.number().int().min(1).max(80)).length(20),
  matches: z.number().int().min(0),
  multiplier: z.number().min(0),
  betAmount: z.number().positive(),
  payout: z.number().min(0),
  won: z.boolean(),
});

export type TicketSettledDto = z.infer<typeof TicketSettledSchema>;
