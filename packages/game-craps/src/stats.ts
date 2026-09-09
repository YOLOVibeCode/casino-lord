import type { StatRow } from "@casino-lord/core";
import { theoreticalDistribution } from "./engine.js";
import type { CrapsRules } from "./rules.js";
import type { CrapsState } from "./types.js";

export function crapsStats(state: CrapsState, rules: CrapsRules): StatRow[] {
  const shooter = state.shooter;
  const table = state.table;
  const theoretical = theoreticalDistribution();
  const window =
    rules.distributionWindow === "shooter"
      ? shooter.rolls.reduce(
          (dist, roll) => {
            dist[roll.total] = (dist[roll.total] ?? 0) + 1;
            return dist;
          },
          Array.from({ length: 13 }, () => 0) as number[],
        )
      : table.distribution;

  const totalWindowRolls = window.reduce((a, b) => a + b, 0);
  const expectedSevens = totalWindowRolls > 0 ? (totalWindowRolls * 6) / 36 : 0;
  const actualSevens =
    rules.distributionWindow === "shooter"
      ? shooter.rolls.filter((r) => r.total === 7).length
      : table.sevensRolled;

  const avgRollsPerShooter = table.shooters > 0 ? table.rolls / table.shooters : 0;

  let distributionNote = "—";
  if (totalWindowRolls > 0) {
    let maxDelta = 0;
    for (let t = 2; t <= 12; t++) {
      const observed = (window[t] ?? 0) / totalWindowRolls;
      maxDelta = Math.max(maxDelta, Math.abs(observed - (theoretical[t] ?? 0)));
    }
    distributionNote = `max Δ ${(maxDelta * 100).toFixed(1)}%`;
  }

  return [
    { label: "Shooter rolls", value: String(shooter.rollCount) },
    { label: "Points made", value: String(shooter.pointsMade) },
    { label: "Distinct points", value: String(shooter.distinctPointsMade.length) },
    { label: "Rolls since point", value: String(shooter.rollsSincePoint) },
    {
      label: "Hard ways",
      value: `4:${shooter.hardWays["4"]} 6:${shooter.hardWays["6"]} 8:${shooter.hardWays["8"]} 10:${shooter.hardWays["10"]}`,
    },
    { label: "Small progress", value: shooter.ats.small.join(",") || "—" },
    { label: "Tall progress", value: shooter.ats.tall.join(",") || "—" },
    { label: "Table rolls", value: String(table.rolls) },
    { label: "Shooters", value: String(table.shooters) },
    { label: "Longest hand", value: String(table.longestHand) },
    { label: "Most points/hand", value: String(table.mostPointsMade) },
    { label: "Sevens", value: `${actualSevens} / ${expectedSevens.toFixed(1)} exp` },
    { label: "Distribution", value: distributionNote },
    { label: "Avg rolls/shooter", value: avgRollsPerShooter.toFixed(1) },
  ];
}
