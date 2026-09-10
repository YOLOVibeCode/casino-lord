import { z } from "zod";
import type { ActionDef } from "@casino-lord/core";

export type CrapsAction =
  | { kind: "toggle_working"; betId: string }
  | { kind: "press"; betId: string }
  | { kind: "take_down"; betId: string }
  | { kind: "pass_dice" }
  | { kind: "roll" };

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("toggle_working"), betId: z.string() }),
  z.object({ kind: z.literal("press"), betId: z.string() }),
  z.object({ kind: z.literal("take_down"), betId: z.string() }),
  z.object({ kind: z.literal("pass_dice") }),
  z.object({ kind: z.literal("roll") }),
]) satisfies z.ZodType<CrapsAction>;

export const crapsPlayerActions: ActionDef<CrapsAction>[] = [
  {
    id: "toggle_working",
    label: "Off/Working",
    action: { kind: "toggle_working", betId: "" },
    enabled: () => false,
  },
  {
    id: "press",
    label: "Press",
    action: { kind: "press", betId: "" },
    enabled: () => false,
  },
  {
    id: "take_down",
    label: "Take down",
    action: { kind: "take_down", betId: "" },
    enabled: () => false,
  },
  { id: "pass_dice", label: "Pass the dice", action: { kind: "pass_dice" } },
  { id: "roll", label: "ROLL", action: { kind: "roll" } },
];
