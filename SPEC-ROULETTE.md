# Casino Lord — Roulette Module Specification

**Version:** 3.0 · **Module id:** `roulette` · **Series label:** Session · **Result label:** Spin
**Depends on:** `SPEC.md` (platform) v3.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Glossary](#2-glossary)
3. [Dealer View](#3-dealer-view)
4. [Display View](#4-display-view)
5. [Engine](#5-engine)
6. [Statistics](#6-statistics)
7. [Animations](#7-animations)
8. [Payout Calculator](#8-payout-calculator)
9. [Rules (Variants)](#9-rules-variants)
10. [Data Types](#10-data-types)
11. [Export Body Format](#11-export-body-format)
12. [Test Fixtures](#12-test-fixtures)
13. [Player Mode](#13-player-mode)
14. [Appendix A — Wheel Layouts and Number Properties](#appendix-a--wheel-layouts-and-number-properties)
15. [Appendix B — Default Animation Presets](#appendix-b--default-animation-presets)

---

## 1. Overview

The roulette module replicates the electronic results board mounted beside a live roulette wheel: a column of recent winning numbers, a wheel graphic highlighting the last result, hot and cold numbers, and running percentages for red/black, odd/even, low/high, dozens, and columns. The dealer enters the winning number after each spin.

Semantic colours: Red `#D7263D`, Black `#111318` (rendered on a `#2A2D34` chip so it reads against dark themes), Green `#1E8F4E`.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Spin** | One result: a pocket number (0–36, or 00 on American wheels). |
| **Session** | The board's reset unit; typically a dealer shift or a stretch of play. |
| **Inside bets** | Straight, split, street, corner, six line, basket/top line. |
| **Outside bets** | Red/black, odd/even, low/high, dozens, columns. |
| **Neighbours** | Numbers physically adjacent on the wheel (not the felt). |
| **Sectors** | Wheel regions used in French-style call bets: Voisins du Zéro, Tiers du Cylindre, Orphelins, Jeu Zéro. |
| **Hot / Cold** | Numbers with the most / fewest hits in the current window. |

---

## 3. Dealer View

### 3.1 Layout

```
│        ┌────────┐   ┌────────┐      │
│        │   0    │   │   00   │      │  ← zero row (00 hidden on European/French)
│        └────────┘   └────────┘      │
│   ┌────┐ ┌────┐ ┌────┐              │
│   │ 3  │ │ 6  │ │ 9  │ … │ 36 │    │  ← felt layout: 3 columns × 12 rows, laid out as
│   │ 2  │ │ 5  │ │ 8  │ … │ 35 │    │    on the table (1 bottom-left, 36 top-right)
│   │ 1  │ │ 4  │ │ 7  │ … │ 34 │    │
│   └────┘ └────┘ └────┘              │
│  Last: 17 ● 32 ● 0 ● 5 ● 22 ● 14   │  ← mini history strip
```

Uses the platform Number Grid (platform §10.2). Cells are coloured red/black/green and sized ≥ 56 px; the grid is rotated to match the phone's orientation (portrait shows the 12 rows vertically).

### 3.2 Entry Flow

1. Tap a number → cell highlights, the confirm label updates: `✓ CONFIRM 17 BLACK`.
2. Tap **Confirm** (or enable **Auto-confirm** for one-tap entry; recommended only with confirm delay ≥ 1 s).
3. The history strip prepends the result.

Live input: on selection (pre-confirm) emit `LIVE_INPUT { pending: number }` so displays can show "Ball landing…" with the number dimmed, if the layout enables it.

### 3.3 Quick Entry

Roulette entry is already minimal; quick entry is a **No Spin** chip (records a void spin — shown as a grey dash in history, excluded from statistics) used when the ball is called off.

### 3.4 Rule Hint Line

- "Enter winning number"
- "17 BLACK · Odd · Low · 2nd dozen · 2nd column"
- "0 GREEN · La partage applies" (French)
- "No spin recorded"

### 3.5 Keyboard

Digits build the number (two-digit entry auto-selects at a valid value), `00` key on American, `Enter` confirm, `Backspace` clear, `V` no spin.

---

## 4. Display View

### 4.1 Layout "Classic"

```
┌────────┬─────────────────────────────────────┬──────────────────────────┐
│ LAST   │                                     │  HOT            COLD     │
│ ┌────┐ │            WHEEL                    │  17 ×6         3  ×0     │
│ │ 17 │ │        (canvas, pocket 17 lit)      │  32 ×5         11 ×0     │
│ ├────┤ │                                     │  0  ×4         26 ×1     │
│ │ 32 │ │                                     │  5  ×4         29 ×1     │
│ ├────┤ │                                     │  22 ×4         34 ×1     │
│ │ 0  │ ├─────────────────────────────────────┼──────────────────────────┤
│ ├────┤ │  RED 48%  BLACK 49%  GREEN 3%       │  1st 12  31%             │
│ │ 5  │ │  ODD 51%  EVEN 46%                  │  2nd 12  36%             │
│ ├────┤ │  LOW 47%  HIGH 50%                  │  3rd 12  30%             │
│ │ 22 │ │  COL 1 34%  COL 2 33%  COL 3 30%    │  Spins 120 · Session 2   │
│ …      │                                     │                          │
└────────┴─────────────────────────────────────┴──────────────────────────┘
```

Header stats: `Spins 120 · Last 17 BLACK`.

Layouts: **Classic** · **Results Focus** (large last-N grid, small wheel) · **Wheel Focus** (large wheel with sector heat, small results column) · **Portrait** (results column top, stats below).

### 4.2 Behaviour

- **Last results column** shows the most recent `historyLength` spins (default 20), newest at top, each as a coloured chip with the number. Zero(s) are green. No-spins are grey dashes.
- **Wheel**: canvas rendering of the correct pocket order (Appendix A) for the configured wheel. On a result, the `spin` animation style rotates the wheel so the winning pocket lands at the 12 o'clock indicator; the pocket then glows. Optional **sector heat**: pockets tinted by hit frequency in the window.
- **Hot/Cold**: top 5 and bottom 5 numbers by hit count in the statistics window (`statsWindow`, default whole session; configurable 50/100/200 spins).
- **Percentages** are of counted spins (zeros count toward Green only and are excluded from odd/even, low/high, dozen, and column denominators, matching standard board practice; a setting switches to "include zero in denominator").
- Tap a history chip (Solo/Dealer) → Result Detail: number, properties, neighbours, sector, timestamp.

---

## 5. Engine

Pure. A spin has no intermediate state; the engine classifies the number and updates aggregates.

### 5.1 Classification

```ts
interface NumberInfo {
  pocket: "0" | "00" | number;    // 1–36
  color: "red" | "black" | "green";
  parity: "odd" | "even" | null;  // null for zeros
  range: "low" | "high" | null;   // 1–18 / 19–36
  dozen: 1 | 2 | 3 | null;
  column: 1 | 2 | 3 | null;       // felt column: (n-1) % 3 + 1
  sector: "voisins" | "tiers" | "orphelins" | "zero" | null;   // European/French only
  wheelIndex: number;             // position in wheel order (Appendix A)
}
```

### 5.2 Derived State

```ts
interface RouletteState {
  history: SpinRecord[];                 // this session, oldest → newest
  counts: Record<string, number>;        // hits per pocket in window
  streaks: { color: { value: Color; length: number }; parity: …; range: …; };
  repeats: number;                       // consecutive identical numbers (≥2 fires `repeat`)
  zeroDrought: number;                   // spins since last zero
  hot: Pocket[]; cold: Pocket[];
  percentages: { red, black, green, odd, even, low, high, dozen: [n,n,n], column: [n,n,n] };
  lastSpin: SpinRecord | null;
}
```

### 5.3 Validation

- Pocket must exist on the configured wheel (`00` rejected on European/French).
- `RESULT_EDITED` may change the pocket; all aggregates recompute from the edit point.

---

## 6. Statistics

Header/side panel rows (module `stats()`):

Spins this session · Last number · Red / Black / Green % · Odd / Even % · Low / High % · Dozens % · Columns % · Hot 5 · Cold 5 · Current colour streak ("BLACK × 6") · Longest colour streak · Spins since zero · Repeats this session · Sector hit counts (European/French, optional).

---

## 7. Animations

| Event id | Trigger | Layered |
|---|---|---|
| `red_win` | Red number | |
| `black_win` | Black number | |
| `zero_hit` | 0 or 00 | |
| `repeat` | Same number as previous spin (`{count}` consecutive) | ✓ |
| `color_streak` | Colour streak reaches `streakThreshold` (default 6); re-fires every +2 | ✓ |
| `hot_number` | Winning number is currently the #1 hot number | ✓ |
| `no_spin` | Void spin | |
| `session_start` | New session | |
| `spin_undone` | Undo | |

Default style for the main colour events is `spin` (wheel rotates to the result) followed by a `flash` in the colour. Default presets in Appendix B. The `trail` style, when chosen, traces the wheel arc from the previous pocket to the winner.

---

## 8. Payout Calculator

Contexts: wheel type is taken from rules; French rules add a **"Zero hit — even-money bets"** context.

| Group | Bet | Pays (to 1) | Note |
|---|---|---|---|
| Inside | Straight | 35 | |
| Inside | Split | 17 | |
| Inside | Street | 11 | |
| Inside | Corner | 8 | |
| Inside | Six line | 5 | |
| Inside | Basket / First four (0,1,2,3) | 8 | European/French only |
| Inside | Top line (0,00,1,2,3) | 6 | American only |
| Outside | Dozen / Column | 2 | |
| Outside | Red/Black · Odd/Even · Low/High | 1 | French: la partage returns ½ on zero; en prison holds the bet |
| Call (EU/FR) | Voisins du Zéro (9 chips) · Tiers (6) · Orphelins (5) · Jeu Zéro (4) · Neighbours (5) | itemised | calculator lists chip placement and per-outcome return for the entered unit |

---

## 9. Rules (Variants)

| Key | Default | Options |
|---|---|---|
| `wheel` | `european` | `european` (0), `american` (0, 00), `french` (0 + la partage/en prison) |
| `zeroRule` | `none` | `none`, `la_partage`, `en_prison` (French default `la_partage`) |
| `historyLength` | 20 | 10–40 |
| `statsWindow` | `session` | `session`, 50, 100, 200 |
| `streakThreshold` | 6 | 4–12 |
| `zeroInDenominator` | false | bool |
| `showSectors` | true (EU/FR) | bool |
| `sectorHeat` | false | bool |
| `autoConfirm` | false | bool (device setting; listed here for the dealer settings screen) |

---

## 10. Data Types

```ts
type Pocket = "0" | "00" | number;         // number 1–36

interface RouletteResult {                 // module Result
  pocket: Pocket | null;                   // null = no spin (void)
}

interface RouletteLiveInput { pending: Pocket | null; }

interface SpinRecord extends RouletteResult {
  info: NumberInfo | null;                 // derived; null for void
}
```

---

## 11. Export Body Format

Whitespace-separated pockets; `00` literal; `-` for no spin.

```
17 32 0 5 22 14 - 00 36 1 1 1
```

Import rejects pockets invalid for the header's wheel type.

---

## 12. Test Fixtures

- Classification of all 38 pockets on both wheel types (colour, parity, range, dozen, column, sector, wheel index).
- Percentage denominators with and without zeros.
- Streak detection across zeros (a zero breaks colour/parity streaks).
- Repeat detection `1 1 1` → `repeat` fires with `{count}` 2 then 3.
- Hot/cold ordering with ties (stable by wheel index).
- Export → import round-trip for European and American sessions; American body imported under a European header fails on `00`.
- Settlement: every inside-bet target shape (all 37/38 straights, all valid splits/streets/corners/six-lines, basket, top line) against every pocket; la partage and en prison on even-money bets when zero hits; call bets itemised.
- Virtual spin: fixed seed → identical pocket sequence on both wheel types.

---

## 13. Player Mode

Roulette players bet only. The felt is the classic betting layout with precise inside-bet placement.

### 13.1 Bet Catalogue

| Group | Bet id | Label | Target | Pays | Notes |
|---|---|---|---|---|---|
| inside | `straight` | Straight | pocket | 35:1 | |
| inside | `split` | Split | 2 adjacent pockets | 17:1 | adjacency on the felt; `0-1`, `0-2`, `0-3` (EU) and `0-00`, `00-2`, `00-3`, `0-1`, `0-2` (US) allowed |
| inside | `street` | Street | row of 3 | 11:1 | also `0-1-2`, `0-2-3` (EU); `0-00-2`, `0-1-2`, `00-2-3` (US) |
| inside | `corner` | Corner | 4 pockets | 8:1 | |
| inside | `six_line` | Six Line | 2 rows | 5:1 | |
| inside | `basket` | Basket (0-1-2-3) | fixed | 8:1 | EU/FR only |
| inside | `top_line` | Top Line (0-00-1-2-3) | fixed | 6:1 | US only |
| outside | `dozen` | 1st / 2nd / 3rd 12 | 1–3 | 2:1 | |
| outside | `column` | 2 to 1 | 1–3 | 2:1 | |
| outside | `red` / `black` | Red / Black | none | 1:1 | zero rule applies (FR) |
| outside | `odd` / `even` | Odd / Even | none | 1:1 | zero rule applies |
| outside | `low` / `high` | 1–18 / 19–36 | none | 1:1 | zero rule applies |
| call (EU/FR) | `voisins` | Voisins du Zéro | none | itemised | 9 units placed as 2×(0-2-3), 1×splits 4/7 12/15 18/21 19/22 32/35, 2×corner 25-26-28-29 |
| call (EU/FR) | `tiers` | Tiers du Cylindre | none | itemised | 6 splits |
| call (EU/FR) | `orphelins` | Orphelins | none | itemised | 1 straight (1) + 4 splits |
| call (EU/FR) | `jeu_zero` | Jeu Zéro | none | itemised | 3 splits + straight 26 |
| call (EU/FR) | `neighbours` | Neighbours | pocket | itemised | 5 straights: pocket ±2 on the wheel |

Call bets place a fixed number of units; the stake entered is the **unit**, and the bet slip shows the total. All inside bets share the table limits; `insideMax` may cap total inside exposure per pocket.

### 13.2 Player View

```
┌─────────────────────────────────────┐
│ ┌─┐                                 │
│ │0│  3  6  9 12 15 18 21 24 27 30 33 36  [2:1] │
│ │ │  2  5  8 11 14 17 20 23 26 29 32 35  [2:1] │  ← felt rotated landscape on wide phones;
│ └─┘  1  4  7 10 13 16 19 22 25 28 31 34  [2:1] │    portrait shows the 12 rows vertically
│      1st 12       2nd 12       3rd 12         │
│   1–18   EVEN   RED   BLACK   ODD   19–36     │
│                                                │
│  ● Racetrack (EU/FR)  · Voisins Tiers Orph Zéro│  ← toggle to call-bet racetrack
└─────────────────────────────────────┘
```

- Placement uses the standard online-roulette hit zones: number centre → straight; shared edge → split; row end → street; shared corner → corner; two-row end → six line; zero corners → basket / top line. A magnifier appears on touch-hold to show exactly which zone is targeted before release.
- Racetrack view shows the wheel order with sector buttons; tapping a number on the racetrack places `neighbours`.
- Rebet: **Repeat last** re-places the previous round's bets if the bankroll allows.
- The last-results column (10 chips) and hot/cold mirror the display.

### 13.3 Settlement

- Inside bets win when the pocket is in the target set.
- Outside bets lose on zero except under `zeroRule`: `la_partage` returns half the stake (`partial`, profit −½); `en_prison` marks the bet `stay` with `working: true, imprisoned: true` — on the next spin it wins back the stake only (`push`) or loses; a second zero keeps it imprisoned (configurable `doublePrison`).
- Call bets settle each component bet; the settlement `note` itemises hits.

### 13.4 Virtual Wheel

`virtual.kind = "wheel"`. Trigger: dealer taps **SPIN** (or `autoTrigger`). One draw in `[0, 37)` or `[0, 38)` mapped to wheel order (Appendix A). `step` emits `LIVE_INPUT { spinning: true }` immediately, then `RESULT_RECORDED` after `wheelSpinMs`; displays run the `spin` style to land on the pocket in time with the event.

### 13.5 Display Additions

Betting strip shows outside totals (`RED 600 · BLACK 450 · …`) and the count of inside bets; the felt heat-map layout (optional) tints numbers by total stake when `showOthersBets` is on.

### 13.6 Rules Additions

| Key | Default | Options |
|---|---|---|
| `insideMax` | 0 (off) | cap on total inside stake per pocket |
| `doublePrison` | false | second zero keeps imprisoned bet |
| `allowCallBets` | true (EU/FR) | bool |

---

## Appendix A — Wheel Layouts and Number Properties

**Red numbers:** 1 3 5 7 9 12 14 16 18 19 21 23 25 27 30 32 34 36. All other 1–36 are black. 0 and 00 are green.

**European / French wheel order (clockwise from 0):**

```
0 32 15 19 4 21 2 25 17 34 6 27 13 36 11 30 8 23 10 5 24 16 33 1 20 14 31 9 22 18 29 7 28 12 35 3 26
```

**American wheel order (clockwise from 0):**

```
0 28 9 26 30 11 7 20 32 17 5 22 34 15 3 24 36 13 1 00 27 10 25 29 12 8 19 31 18 6 21 33 16 4 23 35 14 2
```

**Sectors (European/French):**

| Sector | Pockets |
|---|---|
| Voisins du Zéro | 22 18 29 7 28 12 35 3 26 0 32 15 19 4 21 2 25 |
| Jeu Zéro (subset) | 12 35 3 26 0 32 15 |
| Tiers du Cylindre | 27 13 36 11 30 8 23 10 5 24 16 33 |
| Orphelins | 17 34 6 · 1 20 14 31 9 |

---

## Appendix B — Default Animation Presets

```json
{
  "red_win":       { "enabled": true,  "style": "spin",   "durationMs": 1800, "intensity": 2, "text": "{pocket} RED",   "sound": null, "soundVolume": 0.6, "blockBoardUpdate": true },
  "black_win":     { "enabled": true,  "style": "spin",   "durationMs": 1800, "intensity": 2, "text": "{pocket} BLACK", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": true },
  "zero_hit":      { "enabled": true,  "style": "burst",  "durationMs": 1600, "intensity": 3, "text": "{pocket} GREEN", "sound": null, "soundVolume": 0.7, "blockBoardUpdate": true },
  "repeat":        { "enabled": true,  "style": "banner", "durationMs": 1000, "intensity": 2, "text": "{pocket} AGAIN × {count}", "color": "#D4AF37", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "color_streak":  { "enabled": true,  "style": "sweep",  "durationMs": 1200, "intensity": 2, "text": "{color} × {streak}", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "hot_number":    { "enabled": false, "style": "flash",  "durationMs": 600,  "intensity": 1, "text": "HOT {pocket}",   "color": "#D4AF37", "sound": null, "soundVolume": 0.5, "blockBoardUpdate": false },
  "no_spin":       { "enabled": true,  "style": "flash",  "durationMs": 500,  "intensity": 1, "text": "NO SPIN",        "color": "#888888", "sound": null, "soundVolume": 0.4, "blockBoardUpdate": false },
  "session_start": { "enabled": true,  "style": "sweep",  "durationMs": 1500, "intensity": 2, "text": "NEW SESSION",    "color": "#D4AF37", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": true },
  "spin_undone":   { "enabled": true,  "style": "flash",  "durationMs": 400,  "intensity": 1, "text": "",               "color": "#D4AF37", "sound": null, "soundVolume": 0.4, "blockBoardUpdate": false }
}
```

---

*End of roulette module specification.*
