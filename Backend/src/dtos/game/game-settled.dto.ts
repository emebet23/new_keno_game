import { z } from "zod";
import { TicketSettledSchema } from "./ticket-settled.dto";

export const GameSettledSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.number().int(),
  drawNumbers: z.array(z.number().int().min(1).max(80)).length(20),
  totalTickets: z.number().int().min(0),
  settledTickets: z.array(TicketSettledSchema),
  totalPayout: z.number().min(0),
  serverSeed: z.string().optional(),
  serverSeedHash: z.string().optional(),
});

export type GameSettledDto = z.infer<typeof GameSettledSchema>;
