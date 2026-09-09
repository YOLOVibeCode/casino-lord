import type { ConfirmState } from "@casino-lord/core";
import { classifyRoll, normalizeResult } from "./engine.js";
import type { CrapsRules } from "./rules.js";
import type { CrapsResult, CrapsState } from "./types.js";

export function crapsConfirm(
  state: CrapsState,
  rules: CrapsRules,
): ConfirmState<CrapsResult> | null {
  void rules;
  const { a, b } = state.liveInput;
  if (a === null && b === null) return null;

  let result: CrapsResult;
  try {
    result = normalizeResult({ a, b });
  } catch {
    return null;
  }

  const info = classifyRoll(result, state.phase, state.point);
  let label: string;
  let color: string | undefined;
  const badges: string[] = [];

  switch (info.decision) {
    case "natural":
      label = `✓ CONFIRM ${info.total} — NATURAL`;
      color = "#D4AF37";
      break;
    case "craps":
      label = `✓ CONFIRM ${info.total} — CRAPS`;
      color = "#E08A1E";
      break;
    case "point_established":
      label = `✓ CONFIRM ${info.total} — POINT ESTABLISHED`;
      color = "#EDE6D6";
      break;
    case "point_made":
      label = `✓ CONFIRM ${info.total} — POINT MADE`;
      color = "#D4AF37";
      break;
    case "seven_out":
      label = `✓ CONFIRM ${info.total} — SEVEN OUT`;
      color = "#D7263D";
      break;
    default:
      if (info.hard === true) {
        label = `✓ CONFIRM HARD ${info.total}`;
        badges.push("HARD");
        color = "#8E5BD9";
      } else {
        label = `✓ CONFIRM ${info.total}`;
        color = "#EDE6D6";
      }
  }

  const confirm: ConfirmState<CrapsResult> = {
    label,
    enabled: true,
    result,
  };
  if (color) confirm.color = color;
  if (badges.length > 0) confirm.badges = badges;
  if (info.decision === "seven_out" && rules.autoNewShooterOnSevenOut) {
    confirm.autoSeries = true;
  }
  return confirm;
}
