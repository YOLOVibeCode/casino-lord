# Casino Lord — Baccarat Module Specification

**Version:** 3.0 · **Module id:** `baccarat` · **Series label:** Shoe · **Result label:** Hand
**Depends on:** `SPEC.md` (platform) v3.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Glossary](#2-glossary)
3. [Dealer View](#3-dealer-view)
4. [Display View](#4-display-view)
5. [Engine](#5-engine)
6. [Roads](#6-roads)
7. [Animations](#7-animations)
8. [Payout Calculator](#8-payout-calculator)
9. [Rules (Variants)](#9-rules-variants)
10. [Data Types](#10-data-types)
11. [Export Body Format](#11-export-body-format)
12. [Test Fixtures](#12-test-fixtures)
13. [Player Mode](#13-player-mode)
14. [Appendix A — Third-Card Rule Tables](#appendix-a--third-card-rule-tables)
15. [Appendix B — Road Derivation Algorithms](#appendix-b--road-derivation-algorithms)
16. [Appendix C — Default Animation Presets](#appendix-c--default-animation-presets)

---

## 1. Overview

The baccarat module replicates the electronic roadmap board at a live Punto Banco table. The dealer enters up to six cards into fixed slots; the engine applies the drawing rules, determines Player / Banker / Tie, pairs, and naturals; the display renders the bead plate, big road, big eye boy, small road, and cockroach pig, and plays outcome animations including a dragon effect on long streaks.

Semantic colours: Banker `#E5322D`, Player `#2F6FE4`, Tie `#2BB673`.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Hand / Coup** | One round resolved to P, B, or T. |
| **Shoe** | Hands from one shuffle to the cut card. The board resets per shoe. |
| **Natural** | Initial two-card total of 8 or 9. No third card. |
| **Bead Plate (珠盤路)** | Every hand in order; 6 rows, columns fill top-to-bottom. |
| **Big Road (大路)** | Streak grid; same outcome continues down a column, a change starts a new column. Ties marked on the previous result. |
| **Dragon Tail** | A streak beyond 6 turns right along the bottom row. |
| **Big Eye Boy (大眼仔)** | Derived road, Big Road column offset 1. |
| **Small Road (小路)** | Derived road, offset 2. |
| **Cockroach Pig (曱甴路)** | Derived road, offset 3. |
| **Pair** | First two cards of a side share a rank. |
| **Dragon** | A Big Road streak ≥ `dragonThreshold` (default 6). *Not* the Dragon Bonus side bet. |

---

## 3. Dealer View

### 3.1 Layout (inside the platform Dealer Shell)

```
│   PLAYER            BANKER          │
│  ┌───┐┌───┐┌───┐   ┌───┐┌───┐┌───┐  │  ← six card slots
│  │ 7♥││ K♠││   │   │ 4♦││ 5♣││   │  │
│  └───┘└───┘└───┘   └───┘└───┘└───┘  │
│  Total 7            Total 9         │
│  ● Player stands · Banker NATURAL 9 │  ← rule hint line
├─────────────────────────────────────┤
│  ┌─── mini big road (last 12 cols) ─┐
│  └──────────────────────────────────┘
```

Quick-entry row: **P / B / T** chips. Long-press a chip → pair flags (P pair / B pair / both).

### 3.2 Slot Model

| Slot | Side | Deal order |
|---|---|---|
| P1 | Player | 1 |
| B1 | Banker | 2 |
| P2 | Player | 3 |
| B2 | Banker | 4 |
| P3 | Player | 5 (conditional) |
| B3 | Banker | 6 (conditional) |

- The next expected slot pulses. Tapping any empty **enabled** slot opens the platform Card Picker (platform §10.1) for that slot; the deal order is a suggestion.
- P3/B3 are disabled until the engine requires a third card for that side; when required they glow with a **DRAW** badge.
- Tapping a filled slot opens the picker in replace mode with **Remove**.
- Every change re-runs the engine. Downstream slots invalidated by an upstream change (e.g. a third card present after a natural is created) are flagged red — "Not allowed by rules — remove?" — and block confirmation.
- Card value subscript: 10/J/Q/K → 0.

### 3.3 Rule Hint Line

Plain-language engine instruction, e.g.:

- "Deal Player card 1"
- "Player 5 · Banker 6 — Player draws"
- "Player drew 8 (total 3) · Banker 3 — Banker draws"
- "Banker NATURAL 9 — no more cards"
- "Hand complete — BANKER wins 9 to 7"

### 3.4 Confirm Label

`✓ CONFIRM PLAYER 8` (blue) · `✓ CONFIRM BANKER 9` (red) · `✓ CONFIRM TIE 6` (green), with `· P PAIR` / `· B PAIR` / `· NATURAL` badges appended. On confirm the slots clear with a slide, the mini road updates, and (with Auto-advance) the picker opens for P1.

### 3.5 Live Input

Each slot change emits `LIVE_INPUT { slots }` so the display's Current Hand panel mirrors cards as they are entered.

### 3.6 Keyboard

Platform card bindings plus `P` / `B` / `T` quick entry when the picker is closed.

---

## 4. Display View

### 4.1 Layout "Classic" (1920×1080 reference)

```
┌──────────────────────────┬─────────────────────────────────────────────┐
│   BEAD PLATE             │   BIG ROAD                                  │
│   (6 rows × N cols)      │   (6 rows × N cols, dragon tails)           │
├──────────────────────────┼──────────────────┬──────────────────────────┤
│   CURRENT HAND           │  BIG EYE BOY     │  SMALL ROAD              │
│   P: 7♥ K♠      = 7      ├──────────────────┼──────────────────────────┤
│   B: 4♦ 5♣      = 9      │  COCKROACH PIG   │  P PAIR 4 · B PAIR 5     │
│   ▶ BANKER WINS          │                  │  NATURALS 11             │
└──────────────────────────┴──────────────────┴──────────────────────────┘
```

Header stats (platform header slot): `P 18  B 21  T 3  ·  Hands 42`.

Layouts: **Classic** · **Roads Only** (no current-hand panel) · **Big Road Focus** (big road at 60% width) · **Portrait**.

### 4.2 Behaviour

- Roads scroll horizontally as they fill; the newest column stays visible with a two-column right margin. **Fit** setting shrinks cells instead (min 22 px).
- **Current Hand** mirrors live input; cards flip in (200 ms); totals and hint update.
- On `RESULT_RECORDED`: outcome animation, then new cells scale in (180 ms) on each road; stats count up.
- Prediction cells ("Ask the Road", §6.4) appear when enabled.

### 4.3 Statistics

Player / Banker / Tie counts and P/B percentages of non-tie hands · Player pairs · Banker pairs · Naturals · Current streak ("BANKER × 5") · Longest streak this shoe · Hands this shoe · Estimated hands remaining (from deck count and cards consumed, when card data exists).

---

## 5. Engine

Pure, deterministic. Inputs: slot cards + rules. Output: `HandState`.

### 5.1 Card Values

A = 1 · 2–9 face · 10/J/Q/K = 0 · total = sum mod 10.

### 5.2 Resolution

```
given P1,B1,P2,B2:
  pTotal = (P1+P2) mod 10 ; bTotal = (B1+B2) mod 10
  if pTotal ≥ 8 or bTotal ≥ 8 → NATURAL, complete, no third cards
  playerDraws = pTotal ≤ 5
  if playerDraws:
      require P3 ; pTotal = (pTotal + P3) mod 10
      bankerDraws = bankerRule(bTotal, value(P3))     // Appendix A
  else:
      bankerDraws = bTotal ≤ 5
  if bankerDraws: require B3 ; bTotal = (bTotal + B3) mod 10
  outcome = P > B ? "P" : B > P ? "B" : "T"
  playerPair = rank(P1) == rank(P2) ; bankerPair = rank(B1) == rank(B2)
```

### 5.3 HandState

```ts
type Status = "awaiting_cards" | "needs_player_third" | "needs_banker_third" | "complete" | "invalid";

interface HandState {
  status: Status;
  nextSlot: SlotId | null;
  enabledSlots: SlotId[];
  playerTotal: number | null;
  bankerTotal: number | null;
  outcome: "P" | "B" | "T" | null;
  playerPair: boolean;
  bankerPair: boolean;
  playerNatural: boolean;
  bankerNatural: boolean;
  hint: string;
  errors: { slot: SlotId; message: string }[];
}
```

Third-card rules are fixed standard Punto Banco; no variants in v1.

---

## 6. Roads

All roads derive from the outcome sequence plus pair flags (Appendix B).

### 6.1 Bead Plate

6 rows × N columns, top→bottom then next column. Solid disc in outcome colour with letter (B/P/T or 庄/闲/和 per language setting). Pair dots: top-left red (Banker pair), bottom-right blue (Player pair). Tap (Dealer/Solo) → Result Detail.

### 6.2 Big Road

- Same outcome stacks down a column; a change starts a new column at row 0.
- Beyond row 5 → **dragon tail** continues rightward along row 5; following columns start further right to avoid collision.
- **Ties** never occupy a cell: a green diagonal slash on the last non-tie cell, with a count numeral for multiple consecutive ties. Ties before any B/P are drawn in a provisional hollow cell with slash, replaced by the first real result.
- Cell: hollow ring (3 px stroke at 1080p) in outcome colour; pair dots as above.

### 6.3 Big Eye Boy / Small Road / Cockroach Pig

Derived from Big Road column structure with offsets 1, 2, 3. Glyphs: BEB hollow ring · Small solid disc · Cockroach diagonal slash. Colours red `#E5322D` / blue `#2F6FE4`. Same stacking and dragon-tail rules; no ties.

### 6.4 Prediction Cells ("Ask the Road")

Off by default. When enabled, two small columns to the right of each derived road labelled **B?** / **P?** show what the road would render if the next hand were B or P. Labelled as a display convention only.

---

## 7. Animations

| Event id | Trigger | Layered |
|---|---|---|
| `player_win` | Outcome P | |
| `banker_win` | Outcome B | |
| `tie` | Outcome T | |
| `player_pair` / `banker_pair` | Pair flag | ✓ |
| `natural` | Winner had a natural | ✓ |
| `dragon` | Big Road streak reaches `dragonThreshold`; re-fires every +2 at higher intensity. `path` = streak cell centres incl. tail. | |
| `dragon_broken` | A streak ≥ threshold ends | |
| `shoe_start` | New shoe | |
| `hand_undone` | Undo | |

Default presets: Appendix C. The `dragon` style follows the Big Road streak path; colour follows the streak side.

---

## 8. Payout Calculator

| Group | Bet | Pays | Note |
|---|---|---|---|
| Main | Player | 1:1 | |
| Main | Banker | 1:1 less `bankerCommission` | "5% commission" |
| Main | Banker wins with 6 (no-commission tables) | 1:2 | only when `bankerCommission = 0` |
| Main | Tie | `tiePayout`:1 | 8:1 or 9:1 |
| Side | Player Pair / Banker Pair | 11:1 | |

Optional **commission owed** running tally per shoe (dealer marks Banker bet amount per hand). Default off.

---

## 9. Rules (Variants)

| Key | Default | Options |
|---|---|---|
| `decks` | 8 | 6, 8 |
| `bankerCommission` | 0.05 | 0, 0.05 |
| `noCommissionBanker6Payout` | 0.5 | applies only when commission is 0 |
| `tiePayout` | 8 | 8, 9 |
| `pairPayout` | 11 | 11 |
| `suitRequired` | false | bool |
| `dragonThreshold` | 6 | 4–12 |
| `predictionCells` | false | bool |

---

## 10. Data Types

```ts
type Rank = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
type Suit = "S"|"H"|"D"|"C";
type SlotId = "P1"|"P2"|"P3"|"B1"|"B2"|"B3";
interface Card { rank: Rank; suit: Suit | null; }

interface BaccaratResult {                       // module Result
  cards: Partial<Record<SlotId, Card>> | null;   // null = quick entry
  outcome: "P" | "B" | "T";
  playerTotal: number | null;
  bankerTotal: number | null;
  playerPair: boolean;
  bankerPair: boolean;
  natural: boolean;
}

interface BaccaratLiveInput { slots: Partial<Record<SlotId, Card>>; }
```

---

## 11. Export Body Format

Whitespace-separated tokens; two forms may be mixed.

Outcome-only: `B`, `P`, `T` with optional pair suffixes `b` (banker pair) / `p` (player pair).

```
B P P T Bb P Pp B B B
```

With cards: `outcome[pairs]:player_cards/banker_cards`, cards as rank+suit (suit optional), `10` written `T`.

```
B:7H,KS/4D,5C  P:2,3,9/6,7,K  Tp:8,8/9,7  Bb:2H,3S,3C/KD,KH,9S
```

Import recomputes every carded hand through the engine; mismatches block unless forced.

---

## 12. Test Fixtures

- Exhaustive third-card matrix (all P3 values × banker totals), naturals, ties, pairs, invalid sequences.
- Golden road grids for: `BBBBBBBBB` (dragon tail, derived roads all red) · `BPBPBPBP` (ping-pong) · `TTBPP` (leading ties, provisional cell) · `BBTBP` (tie slash with count) · a 60-hand real-shoe sample.
- Settlement matrix: every catalogue bet × P/B/T × pair flags × commission variants, including Banker-6 at no-commission and tie pushes on P/B bets.
- Virtual shoe: fixed seed → identical deal sequence; third-card rules honoured; shoe exhausts at penetration → forced new shoe.

---

## 13. Player Mode

Applies when the platform's `playerMode` is on (platform §5). Baccarat players bet only; they never act as input.

### 13.1 Bet Catalogue

| Group | Bet id | Label | Lifecycle | Pays | Allowed when | Notes |
|---|---|---|---|---|---|---|
| main | `player` | PLAYER | round | 1:1 | bets open | push on Tie |
| main | `banker` | BANKER | round | 1:1 less commission | bets open | `bankerCommission`; 1:2 on Banker 6 at no-commission; push on Tie |
| main | `tie` | TIE | round | `tiePayout`:1 | bets open | limit default `tableMax / 4` |
| side | `player_pair` | P PAIR | round | 11:1 | bets open | |
| side | `banker_pair` | B PAIR | round | 11:1 | bets open | |

`summary()` returns `PLAYER {amount} ({count})`, `BANKER …`, `TIE …` for the betting strip; pairs are folded into a `SIDE` total.

### 13.2 Player View

```
┌─────────────────────────────────────┐
│  ┌───────────┐     ┌───────────┐    │
│  │  P PAIR   │     │  B PAIR   │    │  ← small side zones
│  │   11:1    │     │   11:1    │    │
│  └───────────┘     └───────────┘    │
│  ┌───────────┐ ┌─────┐ ┌───────────┐│
│  │  PLAYER   │ │ TIE │ │  BANKER   ││  ← main zones (blue / green / red)
│  │   1:1     │ │ 8:1 │ │ 1:1 −5%   ││
│  │  ⛀ 200    │ │     │ │           ││  ← own stake; table total beneath if showOthersBets
│  └───────────┘ └─────┘ └───────────┘│
│  Mini big road (last 8 columns)     │
│  Last hand: P 7♥K♠ =7 · B 4♦5♣ =9   │
└─────────────────────────────────────┘
```

Zones display the live payout string derived from rules. The mini road and last-hand line mirror the display. During a virtual deal, cards flip in on the phone in sync with the display.

### 13.3 Settlement

Implemented in `settle()`:

- `player`: win on P, lose on B, push on T.
- `banker`: win on B (profit = stake × (1 − commission); at `bankerCommission = 0` and Banker total 6, profit = stake × `noCommissionBanker6Payout`), lose on P, push on T.
- `tie`: win on T at `tiePayout`, lose otherwise.
- Pairs: win at 11:1 on the matching pair flag regardless of outcome, else lose.
- Quick-entry hands (no cards) settle pairs from the pair flags the dealer long-pressed; Banker-6 no-commission adjustment requires `bankerTotal`, so quick entry on a no-commission table prompts the dealer for the Banker total when the result is B.

### 13.4 Virtual Shoe

`virtual.kind = "shoe"`, `decks = rules.decks`, penetration fixed at 14 cards from the end (standard cut) — `virtual.shoe.penetration` returns `1 − 14 / (decks × 52)`.

- Trigger: dealer taps **DEAL** (or `virtual.autoTrigger` deals when bets close).
- `step` deals P1, B1, P2, B2 as four `LIVE_INPUT` reveals paced by `revealDelayMs`, then evaluates third-card rules and reveals P3/B3 as needed, then emits `RESULT_RECORDED` with `source: "virtual"`, full cards, totals, pairs, natural.
- A **Burn** of `burnCards` (default 0; casinos burn based on the first card's value — setting `burnRule: "none" | "first_card_value"`) at shoe start is applied before the first deal and never logged as cards.
- When fewer than the cards needed for a full hand remain past the cut, `step` emits `SERIES_ENDED` + `SERIES_STARTED { auto: true }` with a new commitment.

### 13.5 Display Additions

Betting strip: `PLAYER 1,250 (3)  ·  TIE 75 (1)  ·  BANKER 2,100 (4)`; during settlement the ticker lists player net changes. Players panel per platform.

### 13.6 Rules Additions

| Key | Default | Options |
|---|---|---|
| `tieMaxDivisor` | 4 | tie max = tableMax / divisor |
| `burnRule` | `none` | `none`, `first_card_value` (virtual only) |

---

## Appendix A — Third-Card Rule Tables

**Player** (no natural on either side):

| Player total | Action |
|---|---|
| 0–5 | Draw |
| 6–7 | Stand |

**Banker when Player stood** (Player 6–7): Banker 0–5 draws, 6–7 stands.

**Banker when Player drew** (by Player third-card *value*):

| Banker total | Draws if Player's 3rd card value is… |
|---|---|
| 0–2 | Always |
| 3 | 0,1,2,3,4,5,6,7,9 (stands on 8) |
| 4 | 2,3,4,5,6,7 |
| 5 | 4,5,6,7 |
| 6 | 6,7 |
| 7 | Never |

---

## Appendix B — Road Derivation Algorithms

### B.1 Big Road Columns

```
columns = []                         // each: { side, cells: [{ ties, pairs }] }
leadingTies = 0
for each hand h:
  if h.outcome == "T":
      if columns empty → leadingTies++ ; else last cell of last column .ties++
      continue
  if columns empty or last column side != h.outcome:
      columns.push({ side: h.outcome, cells: [] })
  last column .cells.push({ ties: 0, pairs })
```

Layout: cell `i` of column `c` renders at row `min(i,5)`, col `c + max(0, i-5)`; subsequent columns start at `max(startCol, previousColumnMaxColUsed + 1)`.

### B.2 Derived Roads (offset k = 1 BEB, 2 Small, 3 Cockroach)

For each Big Road cell at column `c`, row `r` (ties excluded), starting once the Big Road has ≥ `k+1` columns and either column `k+1` has ≥ 2 cells or column `k+2` exists:

```
if r == 0:                                   // new column
    red  if len(col[c-1]) == len(col[c-1-k]) else blue
else:                                        // continuing a column
    if   len(col[c-k]) >= r+1 : red          // reference column reaches this depth
    elif len(col[c-k]) == r   : blue         // reference column ended one short
    else                      : red          // both "missing"
```

Marks stack into their own columns with Big Road stacking rules and dragon tails.

---

## Appendix C — Default Animation Presets

```json
{
  "player_win":    { "enabled": true,  "style": "sweep",  "durationMs": 1200, "intensity": 2, "text": "PLAYER {total}", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "banker_win":    { "enabled": true,  "style": "sweep",  "durationMs": 1200, "intensity": 2, "text": "BANKER {total}", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "tie":           { "enabled": true,  "style": "flash",  "durationMs": 1000, "intensity": 2, "text": "TIE {total}",    "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "player_pair":   { "enabled": true,  "style": "burst",  "durationMs": 700,  "intensity": 1, "text": "PLAYER PAIR",    "sound": null, "soundVolume": 0.5, "blockBoardUpdate": false },
  "banker_pair":   { "enabled": true,  "style": "burst",  "durationMs": 700,  "intensity": 1, "text": "BANKER PAIR",    "sound": null, "soundVolume": 0.5, "blockBoardUpdate": false },
  "natural":       { "enabled": true,  "style": "banner", "durationMs": 900,  "intensity": 1, "text": "NATURAL {total}","sound": null, "soundVolume": 0.5, "blockBoardUpdate": false },
  "dragon":        { "enabled": true,  "style": "dragon", "durationMs": 2500, "intensity": 3, "text": "{outcome} DRAGON × {streak}", "sound": null, "soundVolume": 0.8, "blockBoardUpdate": true },
  "dragon_broken": { "enabled": false, "style": "flash",  "durationMs": 600,  "intensity": 1, "text": "",               "sound": null, "soundVolume": 0.5, "blockBoardUpdate": false },
  "shoe_start":    { "enabled": true,  "style": "sweep",  "durationMs": 1500, "intensity": 2, "text": "NEW SHOE {series}", "color": "#D4AF37", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": true },
  "hand_undone":   { "enabled": true,  "style": "flash",  "durationMs": 400,  "intensity": 1, "text": "",               "color": "#D4AF37", "sound": null, "soundVolume": 0.4, "blockBoardUpdate": false }
}
```

---

*End of baccarat module specification.*
