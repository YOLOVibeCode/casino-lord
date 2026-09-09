import type { StatRow } from "@casino-lord/core";
import type { RouletteRules } from "./rules.js";
import type { RouletteState } from "./state.js";
export function rouletteStats(state: RouletteState, rules: RouletteRules): StatRow[] {
  const counted = state.history.filter((r) => r.pocket !== null);
  const rows: StatRow[] = [
    { label: "Spins this session", value: counted.length },
    {
      label: "Last number",
      value:
        state.lastSpin?.pocket !== null && state.lastSpin?.pocket !== undefined
          ? String(state.lastSpin.pocket)
          : "—",
    },
    { label: "Red %", value: `${state.percentages.red}%` },
    { label: "Black %", value: `${state.percentages.black}%` },
    { label: "Green %", value: `${state.percentages.green}%` },
    { label: "Odd %", value: `${state.percentages.odd}%` },
    { label: "Even %", value: `${state.percentages.even}%` },
    { label: "Low %", value: `${state.percentages.low}%` },
    { label: "High %", value: `${state.percentages.high}%` },
    {
      label: "Dozens %",
      value: state.percentages.dozen.map((p) => `${p}%`).join(" / "),
    },
    {
      label: "Columns %",
      value: state.percentages.column.map((p) => `${p}%`).join(" / "),
    },
    { label: "Hot 5", value: state.hot.map(String).join(" ") || "—" },
    { label: "Cold 5", value: state.cold.map(String).join(" ") || "—" },
  ];

  if (state.streaks.color) {
    rows.push({
      label: "Current colour streak",
      value: `${state.streaks.color.value.toUpperCase()} × ${state.streaks.color.length}`,
    });
  }
  if (state.longestColorStreak) {
    rows.push({
      label: "Longest colour streak",
      value: `${state.longestColorStreak.value.toUpperCase()} × ${state.longestColorStreak.length}`,
    });
  }
  rows.push({ label: "Spins since zero", value: state.zeroDrought });
  rows.push({ label: "Repeats this session", value: state.repeats });

  if (rules.showSectors && Object.keys(state.sectorCounts).length > 0) {
    rows.push({
      label: "Sector hits",
      value: Object.entries(state.sectorCounts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · "),
    });
  }

  return rows;
}
