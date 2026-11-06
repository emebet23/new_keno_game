import { z } from "zod";

export const TicketAcceptedSchema = z.object({
  ticketId: z.string().uuid(),
  gameId: z.string().uuid(),
  roundNumber: z.number().int(),
  selectedNumbers: z.array(z.number().int().min(1).max(80)),
  betAmount: z.number().positive(),
  status: z.literal("accepted"),
});

export type TicketAcceptedDto = z.infer<typeof TicketAcceptedSchema>;
