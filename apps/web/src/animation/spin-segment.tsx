import { createElement } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { ActiveSegment } from "./AnimationLayer.js";

function displayShellFrom(node: HTMLElement | null): HTMLElement | null {
  return node?.closest(".display-shell") ?? null;
}

function pocketAngleDeg(pocketEl: Element, wheelEl: Element): number {
  const wheelRect = wheelEl.getBoundingClientRect();
  const pocketRect = pocketEl.getBoundingClientRect();
  const cx = wheelRect.left + wheelRect.width / 2;
  const cy = wheelRect.top + wheelRect.height / 2;
  const px = pocketRect.left + pocketRect.width / 2;
  const py = pocketRect.top + pocketRect.height / 2;
  const rad = Math.atan2(py - cy, px - cx);
  return (rad * 180) / Math.PI + 90;
}

function applyWheelSpin(
  wheel: SVGSVGElement,
  pocket: string,
  durationMs: number,
  intensity: 1 | 2 | 3,
): () => void {
  const pockets = wheel.querySelectorAll("[data-pocket]");
  const target = wheel.querySelector(`[data-pocket="${pocket}"]`);
  if (!target || pockets.length === 0) return () => {};

  const currentAngle = pocketAngleDeg(target, wheel);
  const extraTurns = 2 + intensity;
  const finalDeg = extraTurns * 360 + (360 - currentAngle);

  const prevTransform = wheel.style.transform;
  const prevTransition = wheel.style.transition;
  const prevOrigin = wheel.style.transformOrigin;

  wheel.style.transformOrigin = "center center";
  wheel.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  wheel.style.transform = `rotate(${finalDeg}deg)`;

  return () => {
    wheel.style.transform = prevTransform;
    wheel.style.transition = prevTransition;
    wheel.style.transformOrigin = prevOrigin;
  };
}

function applyDiceTumble(dice: HTMLElement, durationMs: number, intensity: 1 | 2 | 3): () => void {
  const prevTransform = dice.style.transform;
  const prevTransition = dice.style.transition;
  const turns = 1 + intensity;

  dice.style.transformOrigin = "center center";
  dice.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  dice.style.transform = `rotate(${turns * 360}deg) scale(1.05)`;

  return () => {
    dice.style.transform = prevTransform;
    dice.style.transition = prevTransition;
    dice.style.transformOrigin = "";
  };
}

export function SpinSegment({ segment }: { segment: ActiveSegment }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = displayShellFrom(ref.current);
    if (!shell) return;

    const wheel = shell.querySelector('[data-testid="roulette-wheel"]') as SVGSVGElement | null;
    const pocket = segment.vars?.pocket !== undefined ? String(segment.vars.pocket) : null;

    let cleanup = (): void => {};

    if (wheel && pocket) {
      cleanup = applyWheelSpin(wheel, pocket, segment.durationMs, segment.intensity);
    } else {
      const dice = shell.querySelector('[data-testid="last-roll-dice"]') as HTMLElement | null;
      if (dice) {
        cleanup = applyDiceTumble(dice, segment.durationMs, segment.intensity);
      }
    }

    return cleanup;
  }, [segment.durationMs, segment.intensity, segment.vars?.pocket]);

  return (
    <div
      ref={ref}
      class="animation-layer__spin"
      data-style="spin"
      data-phase={segment.phase}
      aria-hidden="true"
    />
  );
}
