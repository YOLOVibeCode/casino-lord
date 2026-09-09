import { z } from "zod";

export const joinMessageSchema = z.object({
  op: z.literal("join"),
  code: z.string().min(1),
  role: z.enum(["dealer", "display", "player"]),
  token: z.string().optional(),
  sinceSeq: z.number().int().nonnegative().optional(),
  takeover: z.boolean().optional(),
});

export const eventMessageSchema = z.object({
  op: z.literal("event"),
  clientId: z.string().min(1),
  event: z.record(z.unknown()).and(z.object({ type: z.string() })),
});

export const resyncMessageSchema = z.object({
  op: z.literal("resync"),
  sinceSeq: z.number().int().nonnegative(),
});

export const pingMessageSchema = z.object({
  op: z.literal("ping"),
});

export type JoinMessage = z.infer<typeof joinMessageSchema>;
export type EventMessage = z.infer<typeof eventMessageSchema>;
