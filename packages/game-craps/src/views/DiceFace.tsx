import { Die, type DieFace } from "@casino-lord/ui";
import type { Face } from "../types.js";

export function DiceFace({
  face,
  size = "md",
  testId,
}: {
  face: Face;
  size?: "sm" | "md" | "lg";
  testId?: string;
}) {
  return <Die face={face as DieFace} size={size} {...(testId ? { testId } : {})} />;
}

export function DicePair({
  a,
  b,
  testId,
  size = "sm",
}: {
  a: Face | null;
  b: Face | null;
  testId?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (a === null || b === null) {
    return (
      <span class="craps-dice-pair" {...(testId ? { "data-testid": testId } : {})}>
        —
      </span>
    );
  }
  return (
    <span class="craps-dice-pair" {...(testId ? { "data-testid": testId } : {})}>
      <DiceFace face={a} size={size} />
      <DiceFace face={b} size={size} />
    </span>
  );
}
