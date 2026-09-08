# Casino Lord — Craps Module Specification

**Version:** 3.0 · **Module id:** `craps` · **Series label:** Shooter · **Result label:** Roll
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
14. [Appendix A — Pass-Line State Machine](#appendix-a--pass-line-state-machine)
15. [Appendix B — Dice Combinations and Odds](#appendix-b--dice-combinations-and-odds)
16. [Appendix C — Default Animation Presets](#appendix-c--default-animation-presets)

---

## 1. Overview

The craps module replicates the electronic display above a live craps table: the ON/OFF puck over the point box, the current shooter's roll history, hot-shooter statistics, and a distribution of totals. The dealer enters the two dice after each roll; the engine tracks the pass-line state (come-out vs. point), detects naturals, craps, points made, seven-outs, hard ways, and Fire Bet progress, and automatically starts a new shooter series on seven-out.

Semantic colours: Point made / natural gold `#D4AF37`, Seven-out red `#D7263D`, Craps amber `#E08A1E`, Neutral roll ivory `#EDE6D6`, Hard way purple `#8E5BD9`.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Roll** | One throw of two dice; total 2–12. |
| **Come-out** | Roll(s) made while no point is established (puck OFF). |
| **Natural** | 7 or 11 on the come-out; pass line wins. |
| **Craps** | 2, 3, or 12 on the come-out; pass line loses. |
| **Point** | 4, 5, 6, 8, 9, or 10 rolled on the come-out; puck moves ON that number. |
| **Point made** | Rolling the point again before a 7; pass line wins; new come-out. |
| **Seven-out** | Rolling a 7 while a point is ON; pass line loses; dice pass to the next shooter. |
| **Shooter / Hand** | One shooter's turn: from their first come-out until seven-out. The board's series unit. |
| **Hard way** | 4, 6, 8, or 10 rolled as a pair (2-2, 3-3, 4-4, 5-5). |
| **Fire Bet** | Side bet paying on the number of *distinct* points made by one shooter (4/5/6). |
| **All / Tall / Small** | Side bets on rolling every number 2–12 (All), 8–12 (Tall), 2–6 (Small) before a 7. |

---

## 3. Dealer View

### 3.1 Layout

```
│  PUCK: ON 8         Shooter 4 · Roll 12   │
│  ┌──────────────┐   ┌──────────────┐      │
│  │  ●   ●   ●   │   │      ●       │      │  ← last roll dice faces (large)
│  │      ●       │   │              │      │
│  │  ●   ●   ●   │   │              │      │
│  └──────────────┘   └──────────────┘      │
│  Last: 6 (5-1) → point? no · hard? no     │  ← rule hint line
├───────────────────────────────────────────┤
│   DIE A                DIE B              │
│  [1][2][3]            [1][2][3]           │  ← dice picker (platform §10.3)
│  [4][5][6]            [4][5][6]           │
├───────────────────────────────────────────┤
│  History: 8 · 6 · 4H · 11 · 5 · 8 ✔ · 9   │  ← mini roll strip, this shooter
```

Quick-entry row: **Total** mode toggle (2–12 chips with Hard/Easy where ambiguous) and a **Seven Out** chip (records 7 with unknown faces).

### 3.2 Entry Flow

1. Tap Die A face, tap Die B face (order is irrelevant; the engine stores them as entered).
2. Confirm label reflects the engine's classification: `✓ CONFIRM 8 — POINT ESTABLISHED`, `✓ CONFIRM 8 — POINT MADE`, `✓ CONFIRM 7 — SEVEN OUT`, `✓ CONFIRM 11 — NATURAL`, `✓ CONFIRM 3 — CRAPS`, `✓ CONFIRM HARD 6`, `✓ CONFIRM 5`.
3. **Express**: with *Auto-confirm on second die* enabled, tapping Die B confirms immediately (respecting confirm delay).
4. On seven-out the confirm button is red and, on tap, the module emits `RESULT_RECORDED` followed by an automatic `SERIES_STARTED { auto: true }` for the next shooter.

Live input: dice selections emit `LIVE_INPUT { a, b }` so displays can show the dice being set (optional layout element).

### 3.3 Rule Hint Line

- "Come-out roll — enter dice"
- "Point is 8 — enter dice"
- "6 (4-2) — no decision"
- "8 (4-4) HARD — POINT MADE · new come-out"
- "7 (6-1) — SEVEN OUT · next shooter"
- "12 (6-6) — CRAPS on come-out"

### 3.4 Shooter Label

New shooter prompts an optional label (seat number or name) stored on `Series.label`. Skippable; defaults to "Shooter {n}".

### 3.5 Keyboard

Two digits `1–6` set Die A and Die B; `Enter` confirm; `Backspace` clear; `S` seven-out quick entry; `T` toggle total mode.

---

## 4. Display View

### 4.1 Layout "Classic"

```
┌──────────────────────────────────────────────────────────────────────────┐
│   4      5      6      8      9      10                                  │
│ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐      SHOOTER 4      ROLLS 12        │
│ │    ││    ││    ││ ON ││    ││    │      POINTS MADE 2  FIRE ●●○○○○     │
│ └────┘└────┘└────┘└────┘└────┘└────┘                                     │
├──────────────────────────────────────────────┬───────────────────────────┤
│  ROLL HISTORY (this shooter)                 │  DISTRIBUTION             │
│  ⚄⚀ 6   ⚁⚂ 5   ⚃⚃ 8H ✔  ⚅⚄ 11  ⚂⚁ 5   …     │  2 ▏ 3 ▎ 4 ▍ 5 ▌ 6 ▋ 7 █  │
│                                              │  8 ▋ 9 ▌ 10 ▍ 11 ▎ 12 ▏   │
├──────────────────────────────────────────────┼───────────────────────────┤
│  LAST ROLL                                   │  HARD WAYS  4:1 6:2 8:0 10:1│
│  ⚃⚃  HARD 8 — POINT MADE                     │  TABLE: 61 rolls · 3 shooters│
└──────────────────────────────────────────────┴───────────────────────────┘
```

Header stats: `Shooter 4 · Roll 12 · Point ON 8`.

Layouts: **Classic** · **Puck Focus** (large point boxes and last roll; minimal history) · **History Focus** (long roll history strip, small puck row) · **Portrait**.

### 4.2 Behaviour

- **Point boxes** for 4 5 6 8 9 10. The **puck** sits OFF (to the side, black "OFF") during come-out and ON (white "ON") over the point. Points made this shooter show a gold check under the box; distinct points made drive the **Fire Bet** dots (6 dots, filled per distinct point).
- **Roll history** shows dice faces, total, and badges: `H` hard way, `✔` point made, `⊘` seven-out (red), `N` natural, `C` craps. Scrolls horizontally; newest at right.
- **Distribution**: bar histogram of totals 2–12 for the configured window (this shooter / session); a faint reference outline shows the theoretical distribution (1-2-3-4-5-6-5-4-3-2-1 / 36).
- On seven-out the board plays the animation, then the shooter panel resets (history clears, puck OFF); the table-level counters (bottom right) persist across shooters.
- Tap a history roll (Solo/Dealer) → Result Detail: dice, total, classification, puck state before/after, timestamp.

---

## 5. Engine

Pure state machine (Appendix A) driven by rolls.

### 5.1 Roll Classification

```ts
interface RollInfo {
  a: 1|2|3|4|5|6 | null; b: 1|2|3|4|5|6 | null;   // null when quick-entry total-only
  total: number;                                    // 2–12
  hard: boolean | null;                             // null when faces unknown and total ambiguous
  phase: "come_out" | "point";                      // phase BEFORE this roll
  pointBefore: Point | null;
  decision: "natural" | "craps" | "point_established" | "point_made" | "seven_out" | "none";
  pointAfter: Point | null;
}
type Point = 4|5|6|8|9|10;
```

### 5.2 Derived State

```ts
interface CrapsState {
  phase: "come_out" | "point";
  point: Point | null;
  shooter: {
    rolls: RollRecord[];
    rollCount: number;
    pointsMade: number;
    distinctPointsMade: Set<Point>;          // Fire Bet progress
    allTallSmall: { small: Set<2..6>; tall: Set<8..12>; };
    hardWays: Record<4|6|8|10, number>;
  };
  table: {                                   // across shooters this table
    rolls: number; shooters: number;
    longestHand: number;                     // rolls
    mostPointsMade: number;
    distribution: number[13];                // index by total
  };
  lastRoll: RollRecord | null;
}
```

### 5.3 Validation

- Faces 1–6; total 2–12; total-only entries with ambiguous hardness store `hard: null` (excluded from hard-way counts, flagged in detail).
- Seven-out auto-emits `SERIES_STARTED { auto: true }` (the reducer treats a `RESULT_RECORDED` seven-out followed by `SERIES_STARTED` as one logical action for undo: undoing the roll also removes the auto series start).
- Edits/deletes recompute the state machine from the edit point; downstream decisions may change and the UI shows a "history re-evaluated" toast.

---

## 6. Statistics

Shooter: roll count · points made · distinct points (Fire) · rolls since point established · hard ways hit · All/Tall/Small progress.
Table: total rolls · shooters · longest hand (rolls) · most points made in a hand · sevens rolled / expected · distribution vs. theoretical · average rolls per shooter.

---

## 7. Animations

| Event id | Trigger | Layered |
|---|---|---|
| `point_established` | Come-out rolls 4/5/6/8/9/10; puck slides ON | |
| `point_made` | Point repeated | |
| `natural` | 7 or 11 on come-out | |
| `craps` | 2/3/12 on come-out | |
| `seven_out` | 7 with point ON | |
| `hard_way` | Pair for 4/6/8/10 | ✓ |
| `neutral` | Any other point-phase roll | |
| `hot_shooter` | Shooter roll count reaches `hotShooterThreshold` (default 20); re-fires every +10 | ✓ |
| `fire_progress` | Distinct points made reaches 4, 5, 6 | ✓ |
| `shooter_start` | New shooter (manual or auto) | |
| `roll_undone` | Undo | |

Default styles: `spin` (dice tumble on the board) for every roll, layered with `burst` for point made, `shake` + red `flash` for seven-out, `trail` along the roll history for hot shooter. Presets in Appendix C.

---

## 8. Payout Calculator

Contexts: **Point** (4/5/6/8/9/10) for odds and place bets; **Field 12 payout** from rules.

| Group | Bet | Pays (to 1) | Note |
|---|---|---|---|
| Line | Pass / Come | 1 | |
| Line | Don't Pass / Don't Come | 1 | |
| Odds | Pass odds on 4/10 · 5/9 · 6/8 | 2 · 3:2 · 6:5 | true odds; max per `maxOdds` |
| Odds | Don't Pass lay odds on 4/10 · 5/9 · 6/8 | 1:2 · 2:3 · 5:6 | |
| Place | Place 4/10 · 5/9 · 6/8 | 9:5 · 7:5 · 7:6 | |
| Place | Buy 4/10 · 5/9 · 6/8 | 2 · 3:2 · 6:5 | 5% vig on bet (or on win, per `buyVigOnWin`) |
| Place | Lay 4/10 · 5/9 · 6/8 | 1:2 · 2:3 · 5:6 | 5% vig on win amount |
| Field | Field 3/4/9/10/11 · 2 · 12 | 1 · 2 · `field12` (2 or 3) | |
| Hard | Hard 4 / Hard 10 · Hard 6 / Hard 8 | 7 · 9 | |
| Props | Any Seven · Any Craps · 2 or 12 · 3 or 11 (Yo) | 4 · 7 · 30 · 15 | |
| Props | Horn (4 ways) · Horn High · C&E | itemised per unit | |
| Side | Fire Bet 4 / 5 / 6 points | `fire4` / `fire5` / `fire6` (default 24 / 249 / 999) | |
| Side | Small · Tall · All | 34 · 34 · 175 | |

---

## 9. Rules (Variants)

| Key | Default | Options |
|---|---|---|
| `maxOdds` | `3-4-5x` | `1x` `2x` `3x` `3-4-5x` `5x` `10x` `20x` `100x` |
| `field12` | 3 | 2, 3 |
| `field2` | 2 | 2, 3 |
| `buyVigOnWin` | false | bool |
| `fire4` / `fire5` / `fire6` | 24 / 249 / 999 | numeric |
| `trackFire` | true | bool |
| `trackAllTallSmall` | false | bool |
| `hotShooterThreshold` | 20 | 10–50 |
| `distributionWindow` | `shooter` | `shooter`, `table` |
| `autoNewShooterOnSevenOut` | true | bool |
| `showLiveDice` | true | bool |

---

## 10. Data Types

```ts
type Face = 1|2|3|4|5|6;

interface CrapsResult {                    // module Result
  a: Face | null;
  b: Face | null;
  total: number;                           // required; derived when faces present
  hard: boolean | null;                    // stored to survive face-less quick entry
}

interface CrapsLiveInput { a: Face | null; b: Face | null; }

interface RollRecord extends CrapsResult { info: RollInfo; }
```

---

## 11. Export Body Format

One token per roll; `a-b` faces, or `t` total only, `tH` hard total; `|` marks a shooter boundary (series start).

```
4-4 6-2 5-3 3-4 | 6-5 2-2 5-5 1-6 | 8 9 7
```

Import validates totals, applies the state machine, and flags rolls that contradict a `|` (e.g. a seven-out not followed by a boundary when `autoNewShooterOnSevenOut` is set).

---

## 12. Test Fixtures

- Full state machine table (Appendix A) across all totals in both phases.
- Hard-way detection for all 36 face combinations.
- Fire Bet progression including repeated points (no double count) and reset on seven-out.
- All/Tall/Small completion and reset.
- Seven-out auto-series: undo removes both events; edit of a mid-hand roll to a 7 splits the shooter.
- Theoretical distribution overlay values (Appendix B).
- Export → import round-trip with mixed face/total tokens.
- Settlement: every catalogue bet × every total in both phases, including come/don't-come point travel, odds working/off on come-out, place bets off on come-out, buy/lay vig, field 2/12 variants, Fire and ATS resolution and reset on seven-out.
- Shooter rotation: join order, pass-the-dice, dealer assign, absent shooter force; single shared phone when `playerMode` is off.
- Virtual dice: fixed seed → identical face sequence; two draws per roll.

---

## 13. Player Mode

Craps has the richest player layer: most bets are **working** across rolls, and when the table is virtual the **shooter rolls from their phone**.

### 13.1 Bet Catalogue

| Group | Bet id | Label | Lifecycle | Target | Pays | Allowed when | Resolution |
|---|---|---|---|---|---|---|---|
| line | `pass` | Pass Line | working | none | 1:1 | come-out only (or `putBets` on) | natural win / craps lose on come-out; point made win / seven-out lose |
| line | `dont_pass` | Don't Pass | working | none | 1:1 | come-out only | inverse; 12 on come-out = push (`barNumber`) |
| line | `come` | Come | working | none | 1:1 | point phase | acts as its own come-out; travels to the rolled number |
| line | `dont_come` | Don't Come | working | none | 1:1 | point phase | inverse of come |
| odds | `pass_odds` | Odds | working | attaches to `pass`/`come` | true odds by point | after point set; ≤ `maxOdds` × line bet | pays on point made; loses on seven-out; **off on come-out** for come odds by default |
| odds | `dont_odds` | Lay Odds | working | attaches to `dont_pass`/`dont_come` | inverse true odds | after point set | |
| place | `place` | Place | working | 4/5/6/8/9/10 | 9:5 · 7:5 · 7:6 | any time | wins when number rolls, loses on 7; **off on come-out** by default (`placeWorkingOnComeOut`) |
| place | `buy` | Buy | working | 4/5/6/8/9/10 | true odds, 5% vig | any time | |
| place | `lay` | Lay | working | 4/5/6/8/9/10 | inverse true odds, 5% vig on win | any time | wins on 7, loses when number rolls |
| one-roll | `field` | Field | round | none | 1:1; 2 → `field2`; 12 → `field12` | any time | |
| multi-roll | `hard` | Hard Way | working | 4/6/8/10 | 7:1 (4/10) · 9:1 (6/8) | any time | wins on the pair, loses on 7 or the easy way; off on come-out by default |
| one-roll | `any_seven` | Any Seven | round | none | 4:1 | | |
| one-roll | `any_craps` | Any Craps | round | none | 7:1 | | |
| one-roll | `two` / `twelve` | Aces / Midnight | round | none | 30:1 | | |
| one-roll | `three` / `eleven` | Ace-Deuce / Yo | round | none | 15:1 | | |
| one-roll | `horn` | Horn | round | none | itemised (4 units) | | `horn_high_X` variants weight one number |
| one-roll | `ce` | C & E | round | none | itemised (2 units) | | |
| side | `fire` | Fire Bet | working | none | `fire4` / `fire5` / `fire6` | **before the shooter's first come-out roll** | resolves on seven-out or 6 points |
| side | `ats_small` / `ats_tall` / `ats_all` | Small / Tall / All | working | none | 34:1 · 34:1 · 175:1 | before the shooter's first roll | wins when the set completes before a 7 (7 loses unless already won) |

`summary()` for the betting strip: `PASS {n} · DON'T {n} · PLACE {n} · FIELD {n} · PROPS {n} · FIRE {n}`.

Working-bet controls (module actions → `BET_UPDATED`): **Off / Working** toggle for place, buy, lay, hard, and come-odds during come-out; **Press** (add winnings to the place bet after a win, one tap); **Take down** (remove a working place/buy/lay/hard bet — not allowed for pass/come once a point is set, allowed for don't bets).

### 13.2 Player View

```
┌─────────────────────────────────────┐
│  PUCK ON 8 · Shooter: Ben           │
│  ┌────┬────┬────┬────┬────┬────┐    │
│  │ 4  │ 5  │ 6  │ 8  │ 9  │ 10 │    │  ← place / buy / lay zones (tap = place; long-press menu: buy, lay, hard)
│  │⛀25 │    │⛀30 │ ●  │    │    │    │
│  └────┴────┴────┴────┴────┴────┘    │
│  ┌──────────── COME ──────────────┐ │
│  │  DON'T COME    │   FIELD 2·12  │ │
│  ├─────────── PASS LINE ──────────┤ │
│  │  ⛀100   [ODDS ⛀200]  DON'T PASS│ │  ← odds zone appears behind an active line bet
│  └────────────────────────────────┘ │
│  Props ▸  Hard 4/6/8/10 · Any 7 · Any Craps · Yo · Horn · C&E │
│  Side ▸   FIRE ○○○○○○ · SMALL TALL ALL                        │
├─────────────────────────────────────┤
│  Off/Working ● · Press · Take down  │  ← working-bet controls for the selected bet
└─────────────────────────────────────┘
```

Zones are greyed with the reason when disallowed ("Pass line: only on come-out"). Travelled come bets render as the player's chip inside the number box with a small "C". The roll strip and last roll dice mirror the display.

### 13.3 Shooter Phone (virtual tables)

When `module.turn()` names this player, the status bar becomes:

```
│  🎲 YOU HAVE THE DICE — SHAKE or tap ROLL │
│            [    ROLL    ]                 │
│  Pass the dice ▸                          │
```

- **Shake**: DeviceMotion peak acceleration above `shakeThreshold` (device setting, default 18 m/s²) sends `virtual.trigger`. iOS motion permission is requested on first use; the ROLL button always works.
- The dice tumble on the shooter's phone, every player's phone, and the display for `diceTumbleMs`, then land on the faces from `RESULT_RECORDED`.
- **Pass the dice** hands the trigger to the next player (`TURN_ASSIGNED`); allowed only during a come-out with no line bet from the shooter (`shooterMustBetLine`, default true — a shooter needs a pass or don't-pass bet to roll, mirroring casino practice; dealer can waive).
- Rotation on seven-out: next active player in join order (`shooterRotation = join_order`), skipping *away* players; or `dealer_assigns`.
- If the shooter is *away* or idle > `shooterIdleSec` (default 45), the dealer's view shows **Force roll** / **Skip shooter**.

Physical tables: the shooter indicator is shown but the dealer enters the dice; the shooter's phone shows "You have the dice" without a roll control.

### 13.4 Single Shared Phone

With `playerMode = off` and `outcomeSource = virtual`, the dealer's own DealerView shows the same ROLL / shake control in place of the dice picker. The phone can be passed around the table as electronic dice; the display does the rest.

### 13.5 Settlement Notes

- Come bets: a come bet placed this roll is settled by the next roll as a come-out (7/11 win, 2/3/12 lose, else `stay` with `target` set to the number). Once travelled, it wins when its number repeats and loses on 7 regardless of the table's point.
- Odds on come bets are off on come-out by default; toggled per bet.
- Pass/come odds pay true odds capped by `maxOdds` (3-4-5× default: 3× on 4/10, 4× on 5/9, 5× on 6/8) — the felt enforces the cap at placement.
- Buy vig: 5% of the bet, rounded down to whole chips (min 1), charged at placement unless `buyVigOnWin`.
- Fire / ATS are only placeable before the shooter's first roll and are locked afterward; they resolve `stay` until seven-out (lose, or pay the reached tier for Fire) or completion.
- Seven-out settles every working bet in one pass; the display ticker runs through players in join order.

### 13.6 Display Additions

Players panel shows the shooter with a dice icon. Betting strip shows line/place/field/props/fire totals. The point boxes show stacked table chips (`showOthersBets`) and each player's colour ring on their place bets.

### 13.7 Rules Additions

| Key | Default | Options |
|---|---|---|
| `barNumber` | 12 | 12, 2 (don't-pass push on come-out) |
| `putBets` | false | allow pass/come bets after a point is set |
| `placeWorkingOnComeOut` | false | default working state for place/buy/lay/hard on come-out |
| `shooterMustBetLine` | true | virtual tables |
| `shooterIdleSec` | 45 | |
| `hornHigh` | true | allow horn-high variants |

---

## Appendix A — Pass-Line State Machine

| Phase | Total | Decision | Next phase | Point |
|---|---|---|---|---|
| come_out | 7, 11 | natural | come_out | — |
| come_out | 2, 3, 12 | craps | come_out | — |
| come_out | 4 5 6 8 9 10 | point_established | point | total |
| point | = point | point_made | come_out | — |
| point | 7 | seven_out → new shooter | come_out | — |
| point | other | none | point | unchanged |

---

## Appendix B — Dice Combinations and Odds

| Total | Ways | Probability | True odds vs 7 |
|---|---|---|---|
| 2 | 1 | 1/36 | — |
| 3 | 2 | 2/36 | — |
| 4 | 3 | 3/36 | 2:1 |
| 5 | 4 | 4/36 | 3:2 |
| 6 | 5 | 5/36 | 6:5 |
| 7 | 6 | 6/36 | — |
| 8 | 5 | 5/36 | 6:5 |
| 9 | 4 | 4/36 | 3:2 |
| 10 | 3 | 3/36 | 2:1 |
| 11 | 2 | 2/36 | — |
| 12 | 1 | 1/36 | — |

Hard ways: exactly one of the ways for 4, 6, 8, 10 is hard (2-2, 3-3, 4-4, 5-5).

---

## Appendix C — Default Animation Presets

```json
{
  "point_established": { "enabled": true,  "style": "spin",   "durationMs": 1200, "intensity": 1, "text": "POINT {point}",        "color": "#EDE6D6", "sound": null, "soundVolume": 0.5, "blockBoardUpdate": true },
  "point_made":        { "enabled": true,  "style": "burst",  "durationMs": 1800, "intensity": 3, "text": "{point} — POINT MADE", "color": "#D4AF37", "sound": null, "soundVolume": 0.8, "blockBoardUpdate": true },
  "natural":           { "enabled": true,  "style": "banner", "durationMs": 1200, "intensity": 2, "text": "{total} — WINNER",     "color": "#D4AF37", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "craps":             { "enabled": true,  "style": "flash",  "durationMs": 900,  "intensity": 2, "text": "{total} — CRAPS",      "color": "#E08A1E", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "seven_out":         { "enabled": true,  "style": "shake",  "durationMs": 2000, "intensity": 3, "text": "SEVEN OUT",            "color": "#D7263D", "sound": null, "soundVolume": 0.8, "blockBoardUpdate": true },
  "hard_way":          { "enabled": true,  "style": "burst",  "durationMs": 800,  "intensity": 2, "text": "HARD {total}",         "color": "#8E5BD9", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "neutral":           { "enabled": true,  "style": "spin",   "durationMs": 800,  "intensity": 1, "text": "",                     "color": "#EDE6D6", "sound": null, "soundVolume": 0.3, "blockBoardUpdate": false },
  "hot_shooter":       { "enabled": true,  "style": "trail",  "durationMs": 2000, "intensity": 3, "text": "HOT SHOOTER · {rolls} ROLLS", "color": "#D4AF37", "sound": null, "soundVolume": 0.7, "blockBoardUpdate": false },
  "fire_progress":     { "enabled": true,  "style": "particles","durationMs": 1500,"intensity": 2, "text": "FIRE × {points}",     "color": "#FF6A00", "sound": null, "soundVolume": 0.7, "blockBoardUpdate": false },
  "shooter_start":     { "enabled": true,  "style": "sweep",  "durationMs": 1200, "intensity": 1, "text": "NEW SHOOTER",          "color": "#D4AF37", "sound": null, "soundVolume": 0.5, "blockBoardUpdate": true },
  "roll_undone":       { "enabled": true,  "style": "flash",  "durationMs": 400,  "intensity": 1, "text": "",                     "color": "#D4AF37", "sound": null, "soundVolume": 0.4, "blockBoardUpdate": false }
}
```

---

*End of craps module specification.*
