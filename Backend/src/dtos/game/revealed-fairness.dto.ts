import { z } from "zod";

export const RevealedFairnessSchema = z.object({
  gameId: z.string().uuid(),
  serverSeed: z.string(),
  serverSeedHash: z.string(),
  clientSeed: z.string(),
  nonce: z.number().int(),
});

export type RevealedFairnessDto = z.infer<typeof RevealedFairnessSchema>;
