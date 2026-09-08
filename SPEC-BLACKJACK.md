# Casino Lord — Blackjack Module Specification

**Version:** 3.0 · **Module id:** `blackjack` · **Series label:** Shoe · **Result label:** Round
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
14. [Appendix A — Dealer Play Rules](#appendix-a--dealer-play-rules)
15. [Appendix B — Default Animation Presets](#appendix-b--default-animation-presets)

---

## 1. Overview

The blackjack module records rounds at a live blackjack table and displays the dealer's hand, each seat's result, and table statistics (dealer bust rate, blackjacks, pushes, shoe penetration). Because a full seven-seat round involves many cards, the dealer chooses an **entry depth** per table: *Dealer hand + seat outcomes* (fast) or *Full cards* (every card, every seat). The engine validates the dealer's play against the house rule (S17/H17) and resolves seats automatically when their cards are entered.

Semantic colours: Player win green `#2BB673`, Blackjack gold `#D4AF37`, Dealer win / bust-loss red `#D7263D`, Push grey `#9AA0A6`, Dealer bust amber `#E08A1E`.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Round** | One deal to all active seats and the dealer, resolved per seat. |
| **Shoe** | Cards from one shuffle to the cut card. Board resets per shoe. |
| **Seat** | One of up to 7 betting positions (configurable). |
| **Hand** | A seat's cards; a split produces multiple hands on one seat. |
| **Soft / Hard** | A hand with an ace counted as 11 / without one. |
| **Blackjack (natural)** | Two-card 21 on the initial deal (not after a split unless rules say otherwise). |
| **Bust** | Total over 21. |
| **Push** | Tie between seat and dealer. |
| **S17 / H17** | Dealer stands / hits on soft 17. |
| **Penetration** | Fraction of the shoe dealt before the cut card. |

---

## 3. Dealer View

### 3.1 Layout (Full cards depth)

```
│  DEALER   ┌───┐┌───┐┌───┐      = 17     │
│           │ 7♠││ K♦││   │  ● stands    │  ← dealer hand slots (grow as cards are added)
│           └───┘└───┘└───┘               │
├─────────────────────────────────────────┤
│  SEATS  [1] [2] [3] [4] [5] [6] [7]     │  ← seat tabs; active seats lit; tap to focus
│  Seat 3  ┌───┐┌───┐┌───┐  = 20  WIN     │
│          │ 9♥││ A♣││   │  [Split][Dbl] │  ← focused seat: hand(s), total, action chips
│          └───┘└───┘└───┘  [Surr][Sit out]│
├─────────────────────────────────────────┤
│  Round 42 · 3 of 5 seats resolved       │  ← hint line
```

### 3.2 Entry Depths (rule `entryDepth`)

| Depth | Dealer enters | Engine resolves |
|---|---|---|
| `outcomes` (default) | Dealer hand cards (always) + per seat: **Win / Lose / Push / BJ / Bust / Surrender** chip | Dealer total, dealer bust, dealer BJ; seat outcomes as entered |
| `full` | Dealer hand cards + every card for every active seat (splits, doubles) | Everything, including seat outcomes vs. dealer |

The dealer hand is always entered card-by-card so the display can show it and the engine can validate dealer play and count dealer busts. Seats not in play are marked **Sit out** and skipped.

### 3.3 Flow (`outcomes` depth)

1. Round opens with the previous round's active seats pre-selected.
2. Tap dealer slot 1 → Card Picker (platform §10.1) → up card. Auto-advance to dealer slot 2 (hole card, may be entered later).
3. Tap each seat's outcome chip: `WIN` `LOSE` `PUSH` `BJ` `BUST` `SURR`. Long-press for `WIN ×2` (doubled) / `LOSE ×2` / split results (`W/L`, `W/W`, `L/L`, `W/P`…).
4. Enter dealer's remaining cards as drawn. Hint shows "Dealer 16 — must draw" / "Dealer soft 17 — stands (S17)" / "Dealer BUST 23".
5. Confirm: `✓ CONFIRM ROUND — DEALER 20 · 2W 2L 1P`.

### 3.4 Flow (`full` depth)

1. Deal order follows the table: seat 1..n card 1, dealer up card, seat 1..n card 2, (dealer hole card). Auto-advance follows this order; the dealer can tap any slot to jump.
2. Per seat: tapping an empty slot adds a card (hit). **Split** duplicates the hand into two tabs on that seat (up to `maxSplits`); **Double** flags the hand and allows exactly one more card; **Surrender** resolves the hand immediately. Aces split follow `splitAcesOneCard`.
3. The engine auto-marks Bust and Blackjack; stands are implicit when the dealer moves on. **Stand** chip available to make it explicit.
4. Dealer hand: hole card, then draws per Appendix A. The engine flags an illegal dealer action (hit on hard 17+, stand on 16, wrong soft-17 handling) in red and blocks confirmation until fixed or overridden with **Dealer error — record anyway** (flagged on the round).
5. Outcomes computed per hand; confirm label as above.

### 3.5 Quick Entry

**Round chips**: `DEALER BUST`, `DEALER BJ`, `DEALER {total}` (17–21 sub-chips) with no seat detail — records a round with dealer total only. Seat statistics are not updated; dealer stats are.

### 3.6 Live Input

`LIVE_INPUT { dealer: Card[], seats: Partial<Record<Seat, HandInput[]>> }` on every change so the display shows cards as they're dealt.

### 3.7 Keyboard

Platform card bindings; `Tab`/`Shift+Tab` cycle seats; `D` dealer; `W L P J B R` seat outcome chips (Win, Lose, Push, blackJack, Bust, suRrender); `Space` next slot; `/` split; `X` double.

---

## 4. Display View

### 4.1 Layout "Classic"

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    DEALER   7♠  K♦  4♥   = 21                            │
│                              ● DEALER STANDS                             │
├──────────────────────────────────────────────────────────────────────────┤
│  SEAT 1     SEAT 2     SEAT 3     SEAT 4     SEAT 5     SEAT 6   SEAT 7  │
│  9♥ A♣      K♠ 8♦      6♣ 5♥ 9♠   —         A♦ K♥      10♣ 7♠   —       │
│  = 20       = 18       = 20       sit out   BLACKJACK  = 17     sit out  │
│  LOSE       LOSE       LOSE                 WIN 3:2    LOSE              │
├─────────────────────────────────┬────────────────────────────────────────┤
│  SHOE  ████████████░░░░░  62%   │  ROUNDS 42  DEALER BUST 27%            │
│  Cards seen 258 / 416           │  PLAYER BJ 9   DEALER BJ 3   PUSH 14   │
│  Rounds this shoe 42            │  STREAK: DEALER × 3                    │
└─────────────────────────────────┴────────────────────────────────────────┘
```

Header stats: `Rounds 42 · Dealer bust 27% · Shoe 62%`.

Layouts: **Classic** · **Dealer Focus** (large dealer hand, seats as a compact strip) · **Stats Focus** (large stats, small round summary) · **Portrait**.

### 4.2 Behaviour

- Dealer hand cards flip in as entered (hole card renders face-down until entered/revealed). Total and rule state under the hand.
- Seats show cards (full depth) or just the outcome badge (outcomes depth). Split hands stack vertically within the seat. Doubled hands show a `×2` tag.
- On `RESULT_RECORDED`: outcome animations play (dealer bust, blackjacks), badges settle, stats count up; after `roundHoldMs` (default 6 s) the round area fades to a "waiting for next round" state showing the last round's summary line.
- **Shoe meter**: cards seen / total cards (`decks × 52`), with the cut-card position marked at `penetration`. Only meaningful in `full` depth or when `cardsPerRoundEstimate` is used (outcomes depth estimates 2.7 cards per active hand + dealer cards actually entered; labelled "est.").
- Tap a round in history (Solo/Dealer) → Result Detail: dealer hand, every seat's hands and outcomes, flags (dealer error), timestamp.

### 4.3 Training Overlay (Solo only)

Off by default; **never rendered in Display Mode** when connected to a table. In Solo mode a toggle shows Hi-Lo running count, true count, and decks remaining computed from entered cards. Provided as a practice aid; labelled as such.

---

## 5. Engine

### 5.1 Card Values

2–10 face; J/Q/K = 10; A = 11 unless that busts, then 1.

### 5.2 Hand Evaluation

```
total = Σ values with aces as 11 ; soft = false
while total > 21 and any ace still counted as 11: total -= 10
soft = any ace still counted as 11
blackjack = cards.length == 2 and total == 21 and not fromSplit (or rules.blackjackAfterSplit)
bust = total > 21
```

### 5.3 Dealer Play Validation (Appendix A)

Given dealer cards in order, the engine emits `dealerStatus`: `"must_draw" | "stands" | "bust" | "blackjack"` and `illegalActions: string[]` (e.g., "Drew on hard 17"). `peek` rule controls whether a dealer blackjack is checked before seat play (affects payout of doubled/split hands: lose original bet only under `peek: true` for US rules; ENHC loses all).

### 5.4 Seat Resolution (`full` depth)

For each hand:

```
if hand.surrendered → LOSE_HALF
if hand.blackjack and not dealer.blackjack → BLACKJACK (pays rules.blackjackPayout)
if hand.blackjack and dealer.blackjack → PUSH
if hand.bust → LOSE
if dealer.blackjack → LOSE (ENHC: including doubles/splits; peek: original only)
if dealer.bust → WIN
compare totals → WIN / LOSE / PUSH
doubled hands win/lose 2 units
```

### 5.5 Derived State

```ts
interface BlackjackState {
  currentRound: RoundInput;                        // live
  rounds: RoundRecord[];                           // this shoe
  cardsSeen: number; cardsTotal: number; penetrationPct: number;
  dealer: { rounds: number; busts: number; blackjacks: number; totalsHistogram: number[]; };
  seats: Record<Seat, { hands: number; wins: number; losses: number; pushes: number; blackjacks: number; busts: number; }>;
  streak: { side: "dealer" | "players"; length: number };   // majority-of-seats streak
  fiveCardTwentyOnes: number;
}
```

---

## 6. Statistics

Rounds this shoe · Dealer bust % · Dealer blackjack count · Player blackjack count · Pushes · Dealer final total histogram (17/18/19/20/21/bust) · Seats: win/loss/push per seat (full or outcomes depth) · Current table streak (dealer or players took the majority) · Shoe penetration · 5+ card 21s.

---

## 7. Animations

| Event id | Trigger | Layered |
|---|---|---|
| `dealer_bust` | Dealer total > 21 | |
| `dealer_blackjack` | Dealer natural | |
| `dealer_stand` | Dealer stands 17–21 (main event when no bust/BJ) | |
| `player_blackjack` | Any seat natural (`{seat}`) | ✓ |
| `table_sweep` | Every active seat lost | ✓ |
| `table_win` | Every active seat won (≥ 2 seats) | ✓ |
| `five_card_21` | A hand reaches 21 with ≥ 5 cards | ✓ |
| `dealer_streak` | Dealer majority streak reaches `streakThreshold` (default 5) | ✓ |
| `shoe_start` | New shoe | |
| `round_undone` | Undo | |

Defaults in Appendix B.

---

## 8. Payout Calculator

| Group | Bet | Pays | Note |
|---|---|---|---|
| Main | Win | 1:1 | |
| Main | Blackjack | `blackjackPayout` (3:2 default; 6:5 option) | |
| Main | Doubled win | 2:1 on original bet | |
| Main | Push | returns stake | |
| Main | Surrender | returns ½ stake | |
| Side | Insurance | 2:1 | on the insurance amount (½ bet) |
| Side | Even money | 1:1 | player BJ vs dealer ace |
| Side (optional) | Perfect Pairs · 21+3 | table-configurable | disabled unless `sideBets` enabled |

---

## 9. Rules (Variants)

| Key | Default | Options |
|---|---|---|
| `decks` | 6 | 1, 2, 4, 6, 8 |
| `seats` | 7 | 5–7 |
| `entryDepth` | `outcomes` | `outcomes`, `full` |
| `dealerSoft17` | `stand` | `stand` (S17), `hit` (H17) |
| `blackjackPayout` | `3:2` | `3:2`, `6:5`, `2:1` |
| `peek` | true | bool (false = ENHC) |
| `doubleAfterSplit` | true | bool |
| `maxSplits` | 3 | 1–3 |
| `splitAcesOneCard` | true | bool |
| `resplitAces` | false | bool |
| `blackjackAfterSplit` | false | bool |
| `surrender` | `late` | `none`, `late`, `early` |
| `penetration` | 0.75 | 0.5–0.9 |
| `roundHoldMs` | 6000 | 2000–15000 |
| `streakThreshold` | 5 | 3–10 |
| `sideBets` | false | bool |
| `trainingOverlay` | false | bool (Solo only) |

---

## 10. Data Types

```ts
type Seat = 1|2|3|4|5|6|7;
type SeatOutcome = "win"|"lose"|"push"|"blackjack"|"bust"|"surrender";

interface HandInput {
  cards: Card[];                 // empty in outcomes depth
  doubled: boolean;
  fromSplit: boolean;
  surrendered: boolean;
  outcome: SeatOutcome | null;   // entered (outcomes) or computed (full)
}

interface BlackjackResult {                       // module Result
  dealer: { cards: Card[]; total: number | null; bust: boolean; blackjack: boolean; };
  seats: Partial<Record<Seat, HandInput[]>>;     // absent seat = sit out; empty in quick entry
  depth: "outcomes" | "full" | "quick";
  dealerError: boolean;                          // recorded despite illegal dealer action
}

interface BlackjackLiveInput {
  dealer: Card[];
  seats: Partial<Record<Seat, HandInput[]>>;
}
```

`Card` is the platform card type (`rank`, `suit | null`).

---

## 11. Export Body Format

One line per round. Dealer cards first, then seats separated by `|`; seat hands separated by `;`. Outcomes depth writes outcome letters; full depth writes cards with optional flags (`d` doubled, `s` surrendered).

```
D:7S,KD,4H | 1:L | 2:L | 3:L | 5:BJ | 6:L
D:6C,9H,7D | 1:9H,AC | 2:KS,8D | 3:6C,5H,9S d | 5:AD,KH | 6:TC,7S ; 8S,3D,9C
D:BUST
```

Import recomputes outcomes for full-depth lines and reports mismatches; outcome-depth and quick lines are trusted.

---

## 12. Test Fixtures

- Hand evaluation: multi-ace hands (A,A,9 = 21 soft→hard transitions), soft 17 cases, 5+ card 21.
- Dealer play validation under S17 and H17 for every soft/hard total 12–21.
- Seat resolution matrix vs. dealer totals 17–21, bust, blackjack; peek vs. ENHC with doubles/splits.
- Split handling: aces one-card, resplit limits, blackjack-after-split flag.
- Penetration meter with `full` depth exact counts and `outcomes` depth estimates.
- Export → import round-trip for all three depths in one file.
- Settlement: main bet × every outcome × doubled/split combinations; insurance with and without dealer BJ; even money; surrender; 6:5 vs 3:2 rounding to whole chips.
- Virtual play: fixed seed → identical deal; action timer auto-stand; split hands each get a turn; dealer auto-play per S17/H17; peek vs ENHC ordering of the hole card.
- Intents on physical tables never change state.

---

## 13. Player Mode

Blackjack players **take a seat**, bet, and — on virtual tables — play their own hand from the phone. On physical tables their decisions are relayed to the dealer as intents.

### 13.1 Seats

- `module.seats = { max: rules.seats, assign: "player" }`: a joining player picks an open seat (or the dealer assigns). Players without a seat may watch and see the leaderboard but cannot bet.
- One player per seat; a player may hold up to `handsPerPlayer` seats (default 1, max 2).
- Sitting out: a seated player who places no bet before bets close is skipped for that round (`sit out`), keeps the seat.

### 13.2 Bet Catalogue

| Group | Bet id | Label | Lifecycle | Pays | Allowed when | Notes |
|---|---|---|---|---|---|---|
| main | `main` | Bet | round | 1:1; BJ `blackjackPayout` | bets open, seated | one per seat |
| main | `double` | Double Down | round (adds to `main`) | 1:1 on the added stake | on player's turn, 2 cards (or after split if `doubleAfterSplit`) | stake = `main` (or less if `doubleForLess`) |
| main | `split` | Split | round (creates a second `main`) | as `main` | on turn, pair, splits < `maxSplits` | stake = `main` |
| side | `insurance` | Insurance | round | 2:1 | dealer shows Ace, before any action | ≤ ½ `main` |
| side | `even_money` | Even Money | round | 1:1 | player BJ vs dealer Ace | resolves immediately |
| side (opt) | `perfect_pairs` | Perfect Pairs | round | 25:1 / 12:1 / 6:1 | bets open, `sideBets` on | perfect / coloured / mixed |
| side (opt) | `twenty_one_plus_three` | 21+3 | round | 100 / 40 / 30 / 10 / 5 :1 | bets open, `sideBets` on | suited trips / straight flush / trips / straight / flush |

`summary()`: `MAIN {total} ({seats})`, `SIDE {total}`.

### 13.3 Player View

```
┌─────────────────────────────────────┐
│  DEALER  7♠  ▮▮       = 7           │  ← dealer up card, hole card face-down until reveal
├─────────────────────────────────────┤
│  SEAT 3 — Ana                       │
│  ┌───┐┌───┐          = 16  hard     │
│  │ 9♥││ 7♣│                          │
│  └───┘└───┘                          │
│  ⛀100 main                          │
├─────────────────────────────────────┤
│  YOUR MOVE · 0:14                   │
│  [ HIT ]  [ STAND ]  [ DOUBLE ]     │  ← enabled per engine; SPLIT / SURRENDER when legal
│  [ SPLIT ]  [ SURRENDER ]           │
├─────────────────────────────────────┤
│  Other seats ▸ 1: 20 · 2: BJ · 5: 12│  ← compact strip; tap to expand
└─────────────────────────────────────┘
```

Between rounds the action area is the betting zone (`main` circle plus side-bet circles). After the deal the same area shows the hand. Split hands stack with the active one highlighted.

### 13.4 Virtual Flow

`virtual.kind = "shoe"`; penetration from `rules.penetration`.

1. Bets close → dealer taps **DEAL** (or `autoTrigger`). `step` deals in table order (seat 1..n card 1, dealer up card, seat 1..n card 2, dealer hole card face-down) as paced `LIVE_INPUT` reveals.
2. **Peek** (`peek: true`): dealer showing Ace → insurance window (`insuranceTimerSec`, default 10) → hole card checked; dealer BJ ends the round immediately (players with BJ push). Dealer showing ten-value → silent check.
3. Turns proceed seat by seat; `module.turn()` names the seat; the player's phone shows legal actions. Timer `actionTimerSec` → default action **Stand** (or **Hit** on ≤ 11 if `autoHitLow`, default off). Blackjack hands are skipped.
4. Split: `step` deals one card to each new hand; aces receive one card each when `splitAcesOneCard`. Double: one card, turn ends.
5. Dealer plays automatically per Appendix A with reveals paced; ENHC draws the hole card here.
6. `RESULT_RECORDED` with `depth: "full"`, all hands, dealer hand, `source: "virtual"`; settlement pays each seat's bets.

### 13.5 Physical Flow with Players

- `entryDepth` may be `outcomes` or `full`; settlement uses outcomes (entered or computed) plus `doubled` / split structure. In `outcomes` depth the dealer's seat chips gain `WIN ×2` / split variants so doubled/split stakes settle correctly; the platform bet `double`/`split` records the extra stake when the player taps it on their phone (an intent the dealer confirms by choosing the matching outcome chip).
- Player decisions are `PLAYER_ACTION { intent: true }` and appear on the dealer's seat tab as a badge ("HIT", "STAND") that clears when the dealer adds a card or moves on. They never change state.
- Insurance on physical tables: the player places the `insurance` bet on their phone during the dealer's insurance call; the dealer's round confirm asks "Dealer blackjack?" if any insurance is open.

### 13.6 Settlement

Per hand (platform `settle()`):

- `even_money` taken → `main` pays 1:1 immediately; hand excluded from the later comparison.
- Insurance: wins 2:1 on dealer BJ, else loses; independent of `main`.
- Surrender → `main` returns ½ (`partial`).
- Player BJ vs no dealer BJ → `blackjackPayout`; both BJ → push; dealer BJ → all `main` lose (ENHC: including double/split stakes; peek: original only — doubles/splits cannot exist yet).
- Bust → lose. Dealer bust → all standing hands win. Otherwise compare totals; `double` stake resolves with its hand.
- Side bets resolve on the initial two cards (+ dealer up card for 21+3) before any action.

### 13.7 Display Additions

Seats show the seated player's name and colour ring; the active seat pulses during virtual turns with the countdown. Betting strip: `MAIN 1,150 (5 seats) · SIDE 75`. Insurance window shows "INSURANCE?" over the dealer hand.

### 13.8 Rules Additions

| Key | Default | Options |
|---|---|---|
| `handsPerPlayer` | 1 | 1, 2 |
| `doubleForLess` | true | bool |
| `insuranceTimerSec` | 10 | 5–30 |
| `autoHitLow` | false | auto-hit ≤ 11 on timeout |
| `perfectPairsPayout` | [25, 12, 6] | |
| `twentyOnePlusThreePayout` | [100, 40, 30, 10, 5] | |

---

## Appendix A — Dealer Play Rules

| Dealer total | S17 | H17 |
|---|---|---|
| ≤ 16 (hard or soft) | Draw | Draw |
| Soft 17 | Stand | Draw |
| Hard 17–21 | Stand | Stand |
| Soft 18–21 | Stand | Stand |
| > 21 | Bust | Bust |

Dealer never doubles, splits, or surrenders. With `peek: true`, dealer checks for blackjack when showing an ace (after insurance) or a ten-value; with ENHC, the hole card is drawn after all seats have acted.

---

## Appendix B — Default Animation Presets

```json
{
  "dealer_bust":      { "enabled": true,  "style": "shake",    "durationMs": 1400, "intensity": 3, "text": "DEALER BUSTS {total}",  "color": "#E08A1E", "sound": null, "soundVolume": 0.8, "blockBoardUpdate": true },
  "dealer_blackjack": { "enabled": true,  "style": "banner",   "durationMs": 1400, "intensity": 2, "text": "DEALER BLACKJACK",      "color": "#D7263D", "sound": null, "soundVolume": 0.7, "blockBoardUpdate": true },
  "dealer_stand":     { "enabled": true,  "style": "flash",    "durationMs": 700,  "intensity": 1, "text": "DEALER {total}",        "color": "#EDE6D6", "sound": null, "soundVolume": 0.4, "blockBoardUpdate": false },
  "player_blackjack": { "enabled": true,  "style": "burst",    "durationMs": 1200, "intensity": 3, "text": "BLACKJACK · SEAT {seat}","color": "#D4AF37", "sound": null, "soundVolume": 0.7, "blockBoardUpdate": false },
  "table_sweep":      { "enabled": true,  "style": "sweep",    "durationMs": 1200, "intensity": 2, "text": "HOUSE SWEEPS",          "color": "#D7263D", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "table_win":        { "enabled": true,  "style": "particles","durationMs": 1600, "intensity": 3, "text": "TABLE WINS",            "color": "#2BB673", "sound": null, "soundVolume": 0.7, "blockBoardUpdate": false },
  "five_card_21":     { "enabled": true,  "style": "burst",    "durationMs": 900,  "intensity": 2, "text": "{cards}-CARD 21",       "color": "#D4AF37", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": false },
  "dealer_streak":    { "enabled": false, "style": "flash",    "durationMs": 800,  "intensity": 2, "text": "DEALER × {streak}",     "color": "#D7263D", "sound": null, "soundVolume": 0.5, "blockBoardUpdate": false },
  "shoe_start":       { "enabled": true,  "style": "sweep",    "durationMs": 1500, "intensity": 2, "text": "NEW SHOE {series}",     "color": "#D4AF37", "sound": null, "soundVolume": 0.6, "blockBoardUpdate": true },
  "round_undone":     { "enabled": true,  "style": "flash",    "durationMs": 400,  "intensity": 1, "text": "",                      "color": "#D4AF37", "sound": null, "soundVolume": 0.4, "blockBoardUpdate": false }
}
```

---

*End of blackjack module specification.*
