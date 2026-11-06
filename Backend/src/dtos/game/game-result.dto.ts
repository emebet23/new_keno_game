import { z } from "zod";

export const GameResultSchema = z.object({
  draw: z.array(z.number().int().min(1).max(80)).length(20),
  matches: z.number().int().min(0),
  multiplier: z.number().positive(),
  prize: z.number().min(0),
});

export type GameResultDto = z.infer<typeof GameResultSchema>;
