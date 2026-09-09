import type { Face } from "../types.js";
import { pipLayout } from "./dice-display.js";

export function DiceFace({
  face,
  size = "md",
  testId,
}: {
  face: Face;
  size?: "sm" | "md" | "lg";
  testId?: string;
}) {
  const layout = pipLayout(face);
  return (
    <span
      class={`craps-dice craps-dice--${size}`}
      {...(testId ? { "data-testid": testId } : {})}
      aria-label={`Die showing ${face}`}
    >
      <span class="craps-dice__grid" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            class={`craps-dice__pip${layout.includes(i) ? " craps-dice__pip--on" : ""}`}
          />
        ))}
      </span>
    </span>
  );
}

export function DicePair({ a, b, testId }: { a: Face | null; b: Face | null; testId?: string }) {
  if (a === null || b === null) {
    return (
      <span class="craps-dice-pair" {...(testId ? { "data-testid": testId } : {})}>
        —
      </span>
    );
  }
  return (
    <span class="craps-dice-pair" {...(testId ? { "data-testid": testId } : {})}>
      <DiceFace face={a} size="sm" />
      <DiceFace face={b} size="sm" />
    </span>
  );
}
