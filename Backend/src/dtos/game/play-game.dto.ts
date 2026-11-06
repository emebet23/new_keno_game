import { z } from "zod";
import { GameMode } from "@prisma/client";

export const SingleTicketSchema = z.object({
  bet: z.number().positive("Bet must be greater than 0"),
  selectedNumbers: z
    .array(z.number().int().min(1).max(80))
    .min(1, "Select at least 1 number")
    .max(10, "Select at most 10 numbers")
    .refine(
      (nums) => new Set(nums).size === nums.length,
      "Duplicate numbers are not allowed in ticket"
    ),
});

export const PlayGameSchema = z.object({
  mode: z.nativeEnum(GameMode).optional().default(GameMode.INSTANT),
  clientSeed: z.string().optional(),
  bet: z.number().positive("Bet must be greater than 0").optional(),
  selectedNumbers: z
    .array(z.number().int().min(1).max(80))
    .min(1, "Select at least 1 number")
    .max(10, "Select at most 10 numbers")
    .refine(
      (nums) => new Set(nums).size === nums.length,
      "Duplicate numbers are not allowed"
    )
    .optional(),
  tickets: z.array(SingleTicketSchema).optional(),
}).refine(
  (data) => (data.bet && data.selectedNumbers) || (data.tickets && data.tickets.length > 0),
  "Must provide either (bet and selectedNumbers) or a list of tickets"
);

export type SingleTicketDto = z.infer<typeof SingleTicketSchema>;
export type PlayGameDto = z.infer<typeof PlayGameSchema>;
