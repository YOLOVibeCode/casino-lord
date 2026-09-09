# Casino Lord — Platform Specification

**Version:** 3.0
**Status:** Specification (development-ready)
**Owner:** Noctusoft
**Last updated:** 2026-09-08

**Document set**

| Document | Scope |
|---|---|
| `SPEC.md` (this file) | Platform: tables, roles (Dealer / Display / Player), participation modes, sync, banks and betting rounds, virtual outcomes, animation framework, game-module contract, stack, deployment. |
| `SPEC-BACCARAT.md` | Baccarat module: six-slot dealer entry, Punto Banco engine, roads, bet catalogue, player view, virtual shoe. |
| `SPEC-ROULETTE.md` | Roulette module: number entry, results board, wheel, statistics, bet catalogue, player felt, virtual spin. |
| `SPEC-CRAPS.md` | Craps module: dice entry, pass-line state machine, puck, shooter stats, working bets, shooter phone. |
| `SPEC-BLACKJACK.md` | Blackjack module: multi-seat card entry, hand engine, dealer play validation, player seats and actions, virtual shoe. |
| `SPEC-PLATFORM-v2.md` | Superseded 2.0 baseline. Wherever this document says "as v2.0", the referenced behaviour is specified there; this document wins on conflict. |

Game documents depend on this one and never redefine platform behaviour. Where a game document says "platform", it refers to a section here.

**Changes in 3.0:** adds the optional **Player Mode** layer — players join a table from their phones, receive play chips from the dealer's bank, place bets, and (when the table is configured for virtual play) act as shooter or receive hands. Every table still works exactly as in 2.0 with physical dice/cards and self-tracked chips; the player layer is opt-in per table.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Glossary](#3-glossary)
4. [System Architecture](#4-system-architecture)
5. [Participation Modes](#5-participation-modes)
6. [Game Module Contract](#6-game-module-contract)
7. [Roles and Routes](#7-roles-and-routes)
8. [Table Lifecycle](#8-table-lifecycle)
9. [Dealer Shell](#9-dealer-shell)
10. [Display Shell](#10-display-shell)
11. [Player Shell](#11-player-shell)
12. [Banks and Chips](#12-banks-and-chips)
13. [Betting Rounds and Settlement](#13-betting-rounds-and-settlement)
14. [Virtual Outcomes](#14-virtual-outcomes)
15. [Shared Input Components](#15-shared-input-components)
16. [Animation Framework](#16-animation-framework)
17. [Bet Catalogue and Payout Calculator](#17-bet-catalogue-and-payout-calculator)
18. [Settings and Configuration](#18-settings-and-configuration)
19. [Data Model](#19-data-model)
20. [Realtime Sync Protocol](#20-realtime-sync-protocol)
21. [Persistence](#21-persistence)
22. [Visual Design](#22-visual-design)
23. [Accessibility and Input](#23-accessibility-and-input)
24. [Technology Stack](#24-technology-stack)
25. [Deployment](#25-deployment)
26. [Security, Fairness, and Privacy](#26-security-fairness-and-privacy)
27. [Performance Targets](#27-performance-targets)
28. [Testing Strategy](#28-testing-strategy)
29. [Milestones](#29-milestones)
30. [Resolved Decisions](#30-resolved-decisions)
31. [Open Questions](#31-open-questions)
32. [Appendix A — Export Text Format (Envelope)](#appendix-a--export-text-format-envelope)
33. [Appendix B — Animation Style Catalogue](#appendix-b--animation-style-catalogue)
34. [Appendix C — Fairness Verification Procedure](#appendix-c--fairness-verification-procedure)

---

## 1. Overview

Casino Lord is a professional-grade **multi-game electronic table system** that replicates the scoreboards seen at live casino tables and, optionally, lets a room full of people play along from their phones. It runs entirely in the browser and is built from three coordinated experiences that share one **table**:

- **Dealer Mode** — a phone/tablet interface where the dealer runs the table: records what physically happened (cards dealt, number spun, dice rolled) or triggers virtual outcomes, opens and closes betting, and manages the bank.
- **Display Mode** — a large-screen (TV / monitor / projector) interface that shows the game's live scoreboard, statistics, the current round, players' bets and bankrolls, and configurable outcome animations.
- **Player Mode** *(optional)* — a phone interface where each participant joins with the table code, receives play chips from the dealer, places bets on a game-specific felt, and, when the table uses virtual outcomes, rolls the dice as shooter or plays their own blackjack hand.

The platform supports four games at launch, each as a self-contained module on a common core:

| Game | Dealer enters (physical) | Players can | Display shows |
|---|---|---|---|
| **Baccarat** | Up to six cards | Bet Player / Banker / Tie / pairs | Roads, hand cards, bets by side, stats |
| **Roulette** | Winning number | Place inside/outside/call bets on the felt | Results column, wheel, hot/cold, bet totals |
| **Craps** | Two dice | Bet line/odds/place/field/props; shooter rolls from phone | Puck + point, roll history, shooter stats |
| **Blackjack** | Dealer cards; per-seat cards or outcomes | Take a seat, bet, Hit/Stand/Double/Split/Surrender | Dealer hand, seat results, table stats |

Typical setups:

- **Casino board** — Dealer + Display, physical cards/dice, no players. Identical to a real table display.
- **Bar casino** — Dealer + Display + Players. The dealer issues everyone 500 play chips; players bet from their phones; results come from physical dice/cards entered by the dealer, or from the app's fair virtual dealer.
- **Living room** — one phone in Solo mode, or a phone as virtual dice passed around the table.

---

## 2. Goals and Non-Goals

### Goals

- Look and feel indistinguishable in quality from a real casino table display, for every supported game.
- Dealer records any single result in under 6 seconds with one thumb.
- Outcome resolution and bet settlement are 100% rule-accurate for each game, with common variants configurable.
- Display updates within 300 ms of a dealer confirm or player bet on the same network.
- All animations are configurable per outcome type, per game.
- Player Mode is entirely optional and layered: a table with it off behaves exactly like a pure scoreboard. Banks, betting, and virtual outcomes are each independently switchable.
- A player joins in under 15 seconds: scan QR, type a name, tap Join.
- Virtual outcomes are provably fair (commit–reveal; Appendix C) and never secretly influence a physical table.
- Adding a fifth game requires implementing the module contract (§6) and nothing else.
- Works offline on a single device; works across devices with a lightweight realtime backend.
- Zero-account, zero-install: open a URL, enter a table code.

### Non-Goals

- **Real money.** Chips are play tokens with no cash value. The app never processes payments, never converts chips to currency, and never integrates with wallets. The UI says so on every player screen.
- Prediction or betting advice. Boards are trackers, not predictors; the UI never suggests a bet.
- Casino-floor / pit management across many tables (one table per session; see Open Questions for a future pit view).
- Native mobile apps (PWA is sufficient).
- Generating outcomes for a table configured as **physical**. Virtual outcomes exist only when the dealer switches the table to virtual, and every virtual result is labelled as such.

---

## 3. Glossary

Platform-wide terms. Game-specific terms live in each game document.

| Term | Meaning |
|---|---|
| **Table** | A session bound to one game, one active dealer device, any number of displays, and (if enabled) a roster of players. Identified by a 6-character code. |
| **Game module** | A package implementing §6 for one game. |
| **Result** | One recorded unit of play: a baccarat hand, a roulette spin, a craps roll, a blackjack round. |
| **Series** | The natural reset unit for a game's board. Baccarat/Blackjack: *shoe*. Roulette: *session*. Craps: *shooter*. |
| **Player** | A participant who joined from a phone. Has a display name, colour, optional seat, and (with a bank) a bankroll. |
| **Bank** | The dealer-controlled pool of play chips. *House bank* means the app tracks each player's chips and settles bets automatically. |
| **Bankroll** | A player's current chip balance. |
| **Betting round** | The window during which players may place or change bets for the next result. Opened and closed by the dealer or a timer. |
| **Working bet** | A bet that survives across results until resolved (craps place bets, pass line with a point). |
| **Settlement** | Deterministic computation of each bet's outcome from the result and rules. Derived state, not an event. |
| **Outcome source** | `physical` (dealer enters what happened) or `virtual` (the Virtual Dealer generates it with a committed seed). |
| **Virtual Dealer** | The component of the sync service that shuffles, deals, rolls, and spins for virtual tables. |
| **Live input** | Ephemeral, pre-confirmation state mirrored from dealer to displays and players. |
| **Event log** | The ordered, append-only list of table events. Source of truth; state is derived by replay. |
| **Shell** | The game-agnostic frame of the Dealer, Display, or Player UI into which a module mounts its view. |

---

## 4. System Architecture

```
┌──────────────────┐                                     ┌──────────────────┐
│   Dealer Mode    │ ──── events / virtual requests ───▶ │   Sync Service   │
│  (phone/tablet)  │ ◀─── ack / state ─────────────────  │  (Node, Railway) │
└──────────────────┘                                     │  ┌────────────┐  │
┌──────────────────┐                                     │  │ Event Log  │  │
│   Player Mode    │ ──── bets / actions / roll ───────▶ │  ├────────────┤  │
│  (phones) × M    │ ◀─── ack / state ─────────────────  │  │ Virtual    │  │
└──────────────────┘                                     │  │ Dealer     │  │
                                                         │  └────────────┘  │
                                                         └────────┬─────────┘
                                                                  │ broadcast
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │   Display Mode   │  × N
                                                         └──────────────────┘
```

- **Client**: one static SPA. The route selects the shell (dealer / display / player); the table's `game` selects the module. All game logic — rules, boards, and settlement — lives in pure engine packages so every device computes identical state.
- **Sync Service**: owns table rooms, the authoritative event log, sequence numbers, permissions, and fan-out. It validates envelopes and module payload schemas. For **virtual** tables it additionally hosts the **Virtual Dealer** (§14), the only place game engines run server-side: it consumes a committed random seed and the module's `virtual.step` function to produce `RESULT_RECORDED` events. It never alters events from a physical table.
- **Source of truth**: the ordered event log. Any client rebuilds full state — board, bankrolls, settled bets — by replaying events through the module reducer and the platform's bank reducer.
- **Sync adapter**: `LocalAdapter` (same device), `BroadcastChannelAdapter` (tabs on one machine), `WebSocketAdapter` (cross-device). Solo mode runs the Virtual Dealer in-process via `LocalAdapter`.

### 4.1 Package Layout

```
casino-lord/
  apps/
    web/                    # SPA: shells (dealer/display/player), routing, sync adapters, settings UI
    sync/                   # Fastify + Socket.IO relay + Virtual Dealer host
  packages/
    core/                   # Table, events, GameModule contract, bank/betting reducers, settlement, RNG, animation & calculator frameworks
    ui/                     # Shared inputs (card picker, number grid, dice picker, chip tray, bet slip), theme tokens
    game-baccarat/
    game-roulette/
    game-craps/
    game-blackjack/
```

Each `game-*` package depends only on `core` (and `ui` for views). `apps/web` and `apps/sync` import a static module registry.

---

## 5. Participation Modes

Three independent switches define how a table is played. The dealer sets them at creation and may change them between series.

| Switch | Values | Meaning |
|---|---|---|
| `playerMode` | `off` · `on` | Whether phones may join as players. |
| `bank` | `none` · `house` | `none`: players (if any) track chips themselves; bets are *declared* for display and the app shows what each bet would pay. `house`: the dealer issues play chips, the app tracks bankrolls and settles automatically. |
| `outcomeSource` | `physical` · `virtual` | `physical`: the dealer enters real-world results. `virtual`: the Virtual Dealer generates results; players may be the shooter or play their own hands. |

### 5.1 Combinations

| playerMode | bank | outcomeSource | Experience |
|---|---|---|---|
| off | — | physical | **Casino board.** Pure scoreboard, exactly as v2.0. |
| off | — | virtual | **Shared dice / shoe.** The dealer's phone rolls or deals; useful as electronic dice passed around a table. |
| on | none | physical | **Declared bets.** Players tap what they're betting; the display shows bets by side and the payout each would receive. People handle real chips themselves. |
| on | house | physical | **Bar casino, physical.** Dealer issues chips; players bet from phones; dealer enters real dice/cards; app settles. |
| on | house | virtual | **Bar casino, virtual.** As above, but the app deals/rolls; craps shooter rolls from their phone; blackjack players act on their hands. |
| on | none | virtual | Allowed; declared bets plus virtual outcomes. |

`bank = house` requires `playerMode = on`. All other combinations are valid.

### 5.2 Per-Game Applicability

| Game | Physical entry | Virtual source | Player acts as input |
|---|---|---|---|
| Baccarat | ✓ | virtual shoe | no (dealer taps Deal, or auto-deal) |
| Roulette | ✓ | virtual wheel | no (dealer taps Spin, or auto-spin) |
| Craps | ✓ | virtual dice | **shooter rolls** from phone (shake or tap) |
| Blackjack | ✓ | virtual shoe | **seat actions** (Hit/Stand/Double/Split/Surrender) from phone |

With physical outcomes, blackjack players may still send decisions from their phones; they appear to the dealer as intents ("Seat 3: HIT") and are informational.

---

## 6. Game Module Contract

A game is a package exporting a single `GameModule`. Everything the platform needs to know about a game is expressed here.

```ts
export type GameId = "baccarat" | "roulette" | "craps" | "blackjack";

export interface GameModule<Rules, Result, LiveInput, State, BetTarget = unknown, Action = never> {
  id: GameId;
  name: string;
  seriesLabel: string;                           // "Shoe" | "Session" | "Shooter"
  resultLabel: string;                           // "Hand" | "Spin" | "Roll" | "Round"

  defaultRules: Rules;
  rulesSchema: ZodSchema<Rules>;
  resultSchema: ZodSchema<Result>;
  liveInputSchema: ZodSchema<LiveInput>;
  betTargetSchema: ZodSchema<BetTarget>;
  actionSchema?: ZodSchema<Action>;

  initialState(rules: Rules): State;
  reduce(state: State, event: TableEvent, rules: Rules): State;              // pure

  // ---- Views (Preact). Shells provide layout, header, menus, animation layer. ----
  DealerView: Component<{ state; rules; table: TableMeta; emit: Emit }>;
  DisplayView: Component<{ state; rules; table: TableMeta; bets: BetsView; layout: LayoutPreset }>;
  PlayerView: Component<{ state; rules; me: PlayerState; round: BettingRound; place; remove; act }>;
  ResultDetailView: Component<{ result: Result; rules: Rules }>;
  RulesSettingsView: Component<{ rules: Rules; onChange(patch: Partial<Rules>): void }>;

  // ---- Betting (§13, §17) ----
  bets: BetCatalogue<Rules, Result, State, BetTarget>;
  settle(input: {
    bets: PlacedBet<BetTarget>[]; result: Result;
    before: State; after: State; rules: Rules;
  }): Settlement<BetTarget>[];                                                   // pure

  // ---- Player participation ----
  playerActions?: ActionDef<Action>[];           // e.g. blackjack HIT/STAND; craps ROLL
  turn?(state: State): { playerId: string | null; prompt: string; deadlineMs?: number } | null;
  seats?: { max: number; assign: "dealer" | "player" | "auto" };

  // ---- Virtual outcomes (§14) ----
  virtual?: {
    kind: "dice" | "shoe" | "wheel";
    shoe?: { decks(rules: Rules): number; penetration(rules: Rules): number };
    step(input: {
      state: State; rules: Rules; rng: Rng; trigger: VirtualTrigger; action?: { playerId: string; action: Action };
    }): { events: Omit<TableEvent, "seq" | "at">[]; awaiting: "none" | "action" | "trigger" };
  };

  // ---- Presentation ----
  animationEvents: AnimationEventDef[];
  deriveAnimations(prev: State, next: State, event: TableEvent): AnimationTrigger[];
  stats(state: State, rules: Rules): StatRow[];
  layouts: LayoutPreset[];

  // ---- Import/export ----
  exportSeries(series: Series<Result>, rules: Rules): string;
  importSeries(text: string, rules: Rules): { results: Result[]; warnings: string[] } | { error: string };
}
```

### 6.1 Contract Rules

- `reduce`, `settle`, and `virtual.step` are pure and deterministic. Replaying the same log yields byte-identical state on every device; the same seed yields the same virtual results.
- Modules never touch the network, storage, or clock. Timestamps come from event envelopes; randomness comes only from the injected `Rng`.
- Modules must handle `RESULT_EDITED` / `RESULT_DELETED` for any result in the series (recompute from that point). Edits on tables with `bank = house` re-settle affected rounds and the bank reducer applies bankroll deltas.
- `DealerView` must provide **Quick Entry**. `DisplayView` and the read-only parts of `PlayerView` never mutate state.
- `bets` and `settle` are mandatory even when a game will "usually" run without players: the calculator (§17) is derived from the same catalogue.
- `virtual` is optional; a module without it cannot be used with `outcomeSource = virtual` and the setting is hidden.

---

## 7. Roles and Routes

| Role | Device | Route | Capabilities |
|---|---|---|---|
| **Host** | Any | `/` | Landing: pick a game → Create Table (choose participation modes); Join as Display / Dealer / Player; Solo. |
| **Dealer** | Phone / tablet | `/dealer/:code` | Record or trigger results, undo/edit, open/close betting, manage players and bank, new series, settings, export. |
| **Display** | TV / monitor | `/display/:code` | Read-only board, bets, bankrolls, animations. Full-screen. |
| **Player** | Phone | `/play/:code` | Join, bet, act on turn (virtual), view bankroll and history. |
| **Solo** | Any | `/solo/:game` | Dealer + display on one screen; optional local players via extra tabs (`BroadcastChannelAdapter`). |

The table's game and participation modes are inferred by joining clients. One dealer is active per table; displays unlimited; players up to `maxPlayers` (default 20).

---

## 8. Table Lifecycle

### 8.1 Create

1. Host picks a game, sets participation modes (§5) and, if `bank = house`, the default buy-in.
2. Client sends `POST /tables { game, participation, settings }`.
3. Service returns `{ code, dealerToken }` and appends `TABLE_CREATED`.
4. Host sees the code and QR codes for **Display** (`/display/<code>`), **Dealer** (`/dealer/<code>?t=<dealerToken>`), and — if players are enabled — **Join** (`/play/<code>`). The Join QR is also shown on the Display header while joining is open.

### 8.2 Join (Display / Dealer)

As v2.0: displays need only the code; dealers need the token.

### 8.3 Join (Player)

1. Player opens `/play/<code>`, enters a display name (2–16 chars) and picks a colour/avatar.
2. Client sends `POST /tables/:code/players { name, color }` → `{ playerId, playerToken }` (stored in `localStorage` for rejoin).
3. If `joinApproval` is on, the dealer sees a pending card and taps Approve / Decline. Otherwise the join completes immediately: `PLAYER_JOINED`.
4. With `bank = house`, the dealer is prompted to issue the default buy-in (one tap), or `autoBuyIn` does it automatically: `BANK_ISSUED`.
5. The dealer may close joining at any time (`joiningOpen = false`), rename, reseat, or remove players.

Rejoin: a stored token reconnects to the same player record with bankroll intact. Losing the phone: the dealer can **Reissue link** for a player (invalidates the old token).

### 8.4 Idle and Expiry

No connected clients for **6 hours** → purged from memory. Persisted tables reopen by code for 30 days.

### 8.5 Dealer Takeover

As v2.0: a second dealer may take over; the old socket loses write permission.

### 8.6 New Series

Dealer taps **New {Shoe|Session|Shooter}** → `SERIES_STARTED`. For virtual tables the event carries the fairness commitment (§14.3). Modules may raise `SERIES_STARTED { auto: true }` from a result (craps seven-out).

### 8.7 End of Session

Dealer taps **End Session** → confirmation → `SESSION_ENDED`. Displays show the final leaderboard; players see their summary; the dealer gets an export (chips issued, final bankrolls, results). For virtual tables the seed is revealed (§14.3). The table remains readable until expiry; no further events are accepted.

---

## 9. Dealer Shell

```
┌─────────────────────────────────────┐
│ ● K7X2PQ · Shoe 3 · Hand 42  👥 7   │  ← connection, code, series, result index, player count
├─────────────────────────────────────┤
│ BETS OPEN · 0:12 · P 1,250  B 2,100 │  ← betting bar (only when playerMode on)
├─────────────────────────────────────┤
│                                     │
│        [ module DealerView ]        │
│                                     │
├─────────────────────────────────────┤
│  [ UNDO ]   [ ✓ CONFIRM … ]         │  ← action bar; module supplies label/colour/enabled
├─────────────────────────────────────┤
│  [ quick-entry row ]      👥  🏦  ⚙  │  ← players, bank, menu
└─────────────────────────────────────┘
```

### 9.1 Shell Behaviours (all games)

- **Confirm / Undo / Result Detail / Live input / Connection / Haptics**: as v2.0 (§8 there). Undo on a `bank = house` table reverses the settlement and bankroll deltas of the undone result; if bets for the *next* round have already been placed, undo is blocked with an explanation until those bets are voided.
- **Betting bar** (playerMode on): shows round status, countdown, and totals by side (module-provided summary). Tap to **Open bets** / **Close bets**. Closing happens automatically when the dealer begins entering a result or requests a virtual deal/roll (`autoCloseOnEntry`, default on).
- **Virtual trigger** (outcomeSource virtual): the module's DealerView shows the trigger control — `DEAL`, `SPIN`, `ROLL` — or "Waiting for shooter" / "Seat 3 to act" when the trigger belongs to a player. The dealer can always **Force** the trigger (e.g., an absent shooter).
- **Players panel (👥)**: roster with status (active / away / pending), bankroll, current bets; Approve, Rename, Seat, Remove, Reissue link; Close joining; Assign shooter.
- **Bank panel (🏦)**: default buy-in, Issue chips (to one / all), Take back, Adjust with reason, table min/max, per-bet limits, chips-in-play summary.
- **Menu (⚙)**: New Series · End Session · Settings (participation, rules, animations, display) · Show QRs · Export · Import · History · Calculator · Disconnect.

---

## 10. Display Shell

```
┌────────────────────────────────────────────────────────────────────────┐
│ ♠ CASINO LORD · {Game}  Table 7 · {Series} 3   [module stats]  [JOIN ▦]│  ← header; Join QR when joining open
├──────────────────────────────────────────────────────┬─────────────────┤
│                                                      │  PLAYERS        │
│                 [ module DisplayView ]               │  Ana   1,250 ▲  │
│                                                      │  Ben     980    │
│                                                      │  Cy    2,300 ▲▲ │
├──────────────────────────────────────────────────────┴─────────────────┤
│ BETS OPEN ▓▓▓▓▓▓▓▓░░░░ 0:12     PLAYER 1,250 (3)   BANKER 2,100 (4)   │  ← betting strip
└────────────────────────────────────────────────────────────────────────┘
                     [ animation layer — full-screen overlay canvas ]
```

### 10.1 Shell Behaviours

- As v2.0: full-screen, scaling, idle attract, read-only, info gesture, late-join settings.
- **Players panel** (playerMode on): name, colour, bankroll (if `showBankrolls`), current bets as small chips, shooter/turn indicator, join order. Collapses when there are no players. Sorted by bankroll or seat (`playersSort`).
- **Betting strip**: round state, countdown bar, module bet summary (totals per side/target). During settlement it becomes a ticker: "Ana +300 · Ben −100 · Cy +1,125".
- **Leaderboard** interstitial between series and at session end: top players by bankroll and by net change, animated.
- **Virtual labelling**: when `outcomeSource = virtual`, a small "VIRTUAL · FAIR" badge with the series commitment prefix sits in the header (Appendix C).

---

## 11. Player Shell

```
┌─────────────────────────────────────┐
│ ● Ana  ·  ⛁ 1,250          K7X2PQ  │  ← name, bankroll, code
├─────────────────────────────────────┤
│ BETS OPEN · 0:12                    │  ← round status / turn prompt / result
├─────────────────────────────────────┤
│                                     │
│        [ module PlayerView ]        │  ← felt / seat / dice
│                                     │
├─────────────────────────────────────┤
│  ⛀5  ⛀25  ⛀100  ⛀500   [ CLEAR ]   │  ← chip tray (selected denomination)
├─────────────────────────────────────┤
│  Bet slip: Banker 200 · B Pair 25   │
│  [ ✓ PLACE 225 ]                    │
├─────────────────────────────────────┤
│  History · Leaderboard · Rules · ℹ  │
└─────────────────────────────────────┘
```

### 11.1 Behaviours

- **Chip tray**: denominations from `chipDenominations` (default 5/25/100/500, scaled to buy-in). Tap a denomination, then tap a zone on the module felt to add; long-press a zone to remove; **Clear** empties the slip.
- **Bet slip**: pending bets are local until **Place**; placing emits `BET_PLACED` per bet. While bets are open the player may add or remove (`BET_REMOVED`). After close, slip is locked and shows "Bets closed — good luck".
- **Validation** (client, mirrored by reducer): bets open; bankroll ≥ total; per-bet min/max; module `allowedWhen` (e.g., no Pass Line bet mid-point). Rejected bets show why.
- **Turn prompt** (virtual tables): when `module.turn()` names this player, the status bar becomes the prompt — "YOU HAVE THE DICE — shake or tap ROLL", "Your move: HIT · STAND · DOUBLE" — with the countdown and large action buttons supplied by `playerActions`.
- **Result**: on settlement the player's zones flash win/lose, the bankroll counts to its new value, and a one-line summary appears ("Banker 9 — you won +190 (5% commission)").
- **History**: this session's bets and net; **Leaderboard**: all players (if `showBankrolls`); **Rules**: read-only view of table rules and payouts; **ℹ**: "Play chips only — no cash value" plus the fairness commitment for virtual tables.
- **Away**: backgrounding the phone > 60 s marks the player *away* on the display; they rejoin silently. Working bets remain.
- Bankroll reaches 0: player sees "Ask the dealer for chips"; the dealer's roster shows a rebuy hint.

---

## 12. Banks and Chips

Applies when `bank = house`. All values are integers in play-chip units. Chips have no cash value and are never labelled with a currency symbol on player or display surfaces (the calculator's currency setting applies only to the dealer's payout calculator).

- **Issue**: `BANK_ISSUED { playerId, amount, reason: "buyin" | "rebuy" | "bonus" | "correction" }`. Dealer action only.
- **Take back**: `BANK_ADJUSTED { playerId, delta: -n, reason }` (cannot take more than the bankroll).
- **Bankroll** = Σ issued + Σ adjustments − Σ placed bets (open or working) + Σ settlements. Derived by the platform bank reducer; never stored as a field.
- **Limits**: `tableMin`, `tableMax` per bet; module catalogue may override per bet type (e.g. tie max lower). `maxExposure` optionally caps a player's total open bets.
- **Chips in play**: dealer bank panel shows total issued, total in bankrolls, total on the felt; these always reconcile.
- **End of session**: export lists each player's issued, net, and final bankroll.

With `bank = none` and players on, bets are still recorded (`BET_PLACED` with `declared: true`) and settled for display ("would pay 190"), but no bankroll exists and no limits apply beyond `tableMax`.

---

## 13. Betting Rounds and Settlement

### 13.1 Round State Machine

```
   idle ──BETS_OPENED──▶ open ──BETS_CLOSED──▶ closed ──RESULT_RECORDED──▶ settled ──▶ idle
                          ▲                                                  │
                          └──────────── autoOpen (after settlement) ─────────┘
```

- **Open**: by dealer tap, or automatically `autoOpenDelayMs` after settlement (default 3000). Optional timer `betTimerSec` (0 = none) closes the round when it expires.
- **Closed**: by dealer tap, timer, or `autoCloseOnEntry` (dealer starts entering / triggers virtual). Displays show "NO MORE BETS".
- **Settled**: when a result is recorded for the round, every client computes `module.settle(...)` deterministically; the bank reducer applies deltas; working bets that `stay` carry into the next round.
- A result recorded while a round is `idle` (no bets) settles nothing and simply updates the board.
- Bets are bound to the round (`roundId`). Late `BET_PLACED` (after close, by `seq`) is a reducer no-op and the client shows "Bets were closed".

### 13.2 Settlement Semantics

```ts
interface Settlement<T> {
  betId: string;
  outcome: "win" | "lose" | "push" | "stay" | "partial";
  returned: number;          // stake returned (0 on lose; stake on push; stake+profit on win)
  profit: number;            // net change to bankroll from this bet (negative on lose)
  note?: string;             // "5% commission", "la partage: half returned"
  carry?: PlacedBet<T>;      // for "stay": the bet as it continues (may be modified, e.g., odds now working)
}
```

- Rounding: profit rounded per `roundingMode` to whole chips (default: round down to nearest 1; casino-style 0.25/0.50 modes unavailable for chips).
- Settlement is **derived** and never an event. Editing a past result re-derives all later settlements; bankrolls update accordingly, and the display shows a "history re-evaluated" toast listing net changes.

### 13.3 Working Bets

Modules declare each catalogue entry's `lifecycle`: `"round"` (resolved every result) or `"working"` (resolved only on specific results; otherwise `stay`). Players may toggle working bets **Off** where the game allows (craps place bets on a come-out) via a module-defined action; the platform records `BET_UPDATED`.

---

## 14. Virtual Outcomes

Applies when `outcomeSource = virtual`.

### 14.1 Virtual Dealer

Runs inside the sync service (or in-process for Solo). For each virtual table it holds the series **seed** and a **draw counter**, and exposes three operations, all of which append events through the normal log:

| Op | Who may send | Effect |
|---|---|---|
| `virtual.trigger` | Dealer; or the player named by `module.turn()` (e.g., craps shooter) | Calls `module.virtual.step` with `trigger` → appends returned events (e.g., a `RESULT_RECORDED` roll, or a sequence of `LIVE_INPUT` card reveals followed by `RESULT_RECORDED`). |
| `virtual.action` | The player named by `module.turn()` | Calls `step` with the action (blackjack HIT/STAND…); appends events; may leave the round `awaiting: "action"` for the next player. |
| `virtual.force` | Dealer | Same as trigger/action, bypassing the turn check (absent player). |

### 14.2 Randomness

- Seed: 32 bytes from a CSPRNG at `SERIES_STARTED`.
- Draws: `rng.next(n)` returns a uniform integer in `[0, n)` via HMAC-SHA256(seed, counter) with rejection sampling; the counter increments per draw and is recorded on the event (`rng: { from, to }`).
- Shoe games: the module's `virtual.step` builds the shoe by Fisher–Yates using `rng` on the first draw of the series and stores the deck order in the *server-side* module state; only revealed cards ever enter the log until the seed is revealed.
- Dice / wheel: one draw per die / per spin.

### 14.3 Fairness (commit–reveal)

- `SERIES_STARTED` carries `commit = SHA256(seed ∥ tableCode ∥ seriesId)`. Displays and player phones show its first 8 hex characters.
- `SERIES_ENDED` (new series, end of session) carries `seed`. Anyone can recompute the commitment and replay every draw (Appendix C).
- Events produced by the Virtual Dealer are marked `source: "virtual", by: "system"`; a physical entry is `source: "physical", by: "dealer"`. Mixed series (switching modes mid-series) are disallowed; the dealer must start a new series to switch.

### 14.4 Pacing

Virtual reveals are paced for drama: `revealDelayMs` between cards (default 900), `diceTumbleMs` (default 1500), `wheelSpinMs` (default 4000). The Virtual Dealer emits the `LIVE_INPUT` reveal sequence with server timestamps; displays animate on arrival, so all screens stay within network jitter of one another.

### 14.5 Shooter and Turn Handling

- `module.turn()` names who holds the trigger. Craps: the current shooter (dealer-assigned or rotating in join order after seven-out; a player may **pass the dice**). Blackjack: the seat whose action is pending.
- Turn timer `actionTimerSec` (default 20; craps roll has no timer by default). On expiry the module's default action applies (blackjack: stand) or the dealer is prompted to force.
- The shooter's phone offers **shake to roll** (DeviceMotion, threshold configurable) with a large **ROLL** button fallback; a single shared phone in Dealer Mode has the same control when `playerMode = off`.

---

## 15. Shared Input Components

Located in `packages/ui`.

### 15.1 Card Picker (Baccarat, Blackjack)

Bottom sheet, **Rank → Suit → ✓** in three taps with express path; rank grid (≥ 64 px), suit row, preview, Remove. Express mode: suit sticks, rank commits; *Suit required* off commits `suit: null`. Module supplies the value subscript function. Duplicate warning within a round; over-count across a shoe blocks. Keyboard: `A 2–9 0 J Q K`, `S H D C`, `Enter`, `Backspace`.

### 15.2 Number Grid (Roulette dealer entry)

Felt-layout grid, zero(s) on top, 3 × 12, red/black/green, ≥ 56 px targets. Tap, ✓ (or auto-confirm). Keyboard digits + `Enter`, `00` key on American.

### 15.3 Dice Picker (Craps dealer entry)

Two dice as 2 × 3 pip grids; tap A, tap B, ✓ (express: B confirms). Total mode 2–12 with Hard/Easy where ambiguous. Keyboard two digits + `Enter`.

### 15.4 Outcome Chips

Large coloured quick-entry buttons; modules supply definitions.

### 15.5 Chip Tray and Bet Slip (Player)

Denomination selector, current stake display, Clear; bet slip lists pending and placed bets with per-bet remove. Shared across all games.

### 15.6 Felt Zones (Player)

A module-agnostic zone renderer: modules describe zones (`id`, shape/rect, label, colour, `target`) and the component handles tap-to-add, long-press-to-remove, stacked chip rendering, and per-zone totals (own and table-wide when `showOthersBets`).

### 15.7 Action Buttons (Player turn)

Large buttons rendered from `playerActions` with enabled/disabled state from the module, countdown ring, and haptic tick.

---

## 16. Animation Framework

Unchanged from v2.0 in structure; additions marked ★.

### 16.1 Event Definition

```ts
interface AnimationEventDef { id: string; label: string; defaultPreset: AnimationPreset; layered?: boolean; }
interface AnimationTrigger { eventId: string; vars: Record<string, string | number>; anchor?: {x,y}; path?: {x,y}[]; }
```

★ Platform-level events available to every game: `bets_open`, `bets_closed`, `big_win` (a single settlement profit ≥ `bigWinMultiple` × tableMin, default 20), `player_bust` (bankroll → 0), `leaderboard`, `session_end`.

### 16.2 Preset Structure

```ts
interface AnimationPreset {
  enabled: boolean; style: AnimationStyle; durationMs: number; intensity: 1|2|3;
  color?: string; text?: string; sound?: string | null; soundVolume: number; blockBoardUpdate: boolean;
}
```

### 16.3 Scheduling Rules

Main event first; layered concurrently at reduced intensity; interruptible; ≤ 4 s per result at defaults; `prefers-reduced-motion` → `flash` intensity 1; sounds gesture-unlocked and off by default; presets in table settings keyed `game.eventId` or `platform.eventId`.

★ Player phones play a reduced version (`flash`/`banner` only, ≤ 1.2 s) of the main event plus their personal win/lose feedback; this is a device setting (`phoneAnimations`, default on).

### 16.4 Animation Editor

Per event: enable, style, duration, intensity, colour, text, sound + volume, Preview (`ANIMATION_PREVIEW` to all displays). Named bundles per game.

---

## 17. Bet Catalogue and Payout Calculator

The **bet catalogue** is the single description of every wager a game supports. It drives the player felt, validation, settlement (through `settle`), and the dealer's payout calculator.

```ts
interface BetCatalogue<Rules, Result, State, Target> {
  groups: {
    id: string; label: string;                              // "Main", "Odds", "Props" …
    bets: BetDef<Rules, State, Target>[];
  }[];
  summary(bets: PlacedBet<Target>[], state: State): { label: string; amount: number; count: number }[];  // for display/betting strip
}

interface BetDef<Rules, State, Target> {
  id: string; label: string;
  lifecycle: "round" | "working";
  targets?: "none" | "number" | "custom";                   // custom → module renders picker in the felt
  pays(rules: Rules, ctx?: { target?: Target; state?: State }): { num: number; den: number } | "itemised";
  note?(rules: Rules): string | undefined;
  allowedWhen?(state: State, me: PlayerState): boolean | string;   // string = reason when disallowed
  limits?(rules: Rules): { min?: number; max?: number; maxMultipleOf?: string };   // e.g., odds ≤ 3× pass line
}
```

### 17.1 Payout Calculator (Dealer / Solo)

Rendered from the catalogue: enter an amount, see return and profit for every bet under current rules, with contexts the module declares (craps point, blackjack payout variant). Currency symbol from `TableSettings.currency`; rounding per house mode. Optional module tallies (baccarat commission owed). Available whether or not players are enabled.

---

## 18. Settings and Configuration

- **Table settings** (dealer-owned, broadcast): participation modes (§5), module rules, bank settings (§12), betting settings (§13), virtual pacing (§14.4), animation presets, board options (language, theme), table name, currency (calculator only).
- **Device settings** (local): layout preset, scale, sound unlock, animation override, cursor hide, full-screen, express mode, auto-advance, confirm delay, haptics, phone animations, shake sensitivity.

| Table setting | Default | Notes |
|---|---|---|
| `participation.playerMode` | `off` | |
| `participation.bank` | `none` | `house` requires playerMode on |
| `participation.outcomeSource` | `physical` | `virtual` only for modules with `virtual` |
| `players.maxPlayers` | 20 | 2–50 |
| `players.joinApproval` | false | |
| `players.joiningOpen` | true | dealer toggles |
| `players.showBankrolls` | true | on display and leaderboard |
| `players.showOthersBets` | true | table-wide zone totals on phones |
| `players.playersSort` | `bankroll` | `bankroll`, `seat`, `joined` |
| `bank.defaultBuyIn` | 500 | |
| `bank.autoBuyIn` | true | issue on join |
| `bank.chipDenominations` | [5, 25, 100, 500] | |
| `bank.tableMin` / `bank.tableMax` | 5 / 500 | per bet |
| `bank.maxExposure` | 0 (off) | |
| `bank.roundingMode` | `down` | |
| `betting.betTimerSec` | 0 | 0 = manual close |
| `betting.autoOpenDelayMs` | 3000 | |
| `betting.autoCloseOnEntry` | true | |
| `virtual.revealDelayMs` | 900 | |
| `virtual.diceTumbleMs` | 1500 | |
| `virtual.wheelSpinMs` | 4000 | |
| `virtual.actionTimerSec` | 20 | blackjack actions |
| `virtual.shooterRotation` | `join_order` | `join_order`, `dealer_assigns` |
| `virtual.autoTrigger` | false | auto Deal/Spin when bets close (baccarat, roulette) |

Persistence as v2.0: `localStorage` per device; table settings in the log via `SETTINGS_CHANGED`.

---

## 19. Data Model

```ts
interface Table<R> {
  code: string; game: GameId; createdAt: string;
  participation: { playerMode: "off"|"on"; bank: "none"|"house"; outcomeSource: "physical"|"virtual" };
  series: Series<R>[];
  players: Player[];
  settings: TableSettings;
  version: number;
  ended?: string;
}

interface Series<R> {
  id: string; number: number; startedAt: string; label?: string;
  commit?: string;                       // virtual: SHA256(seed ∥ code ∥ seriesId)
  seed?: string;                         // virtual: revealed at series end
  results: ResultEnvelope<R>[];
  rounds: BettingRound[];
}

interface ResultEnvelope<R> {
  id: string; index: number; recordedAt: string;
  quick: boolean;
  source: "physical" | "virtual";
  by: "dealer" | "system";
  rng?: { from: number; to: number };    // draw counter range consumed (virtual)
  roundId?: string;                      // betting round this result settles
  data: R;
}

interface Player {
  id: string; name: string; color: string;
  seat?: number;
  status: "pending" | "active" | "away" | "removed";
  joinedAt: string;
}

interface BettingRound {
  id: string; status: "open" | "closed" | "settled";
  openedAt: string; closedAt?: string; resultId?: string;
}

interface PlacedBet<T = unknown> {
  id: string; playerId: string; roundId: string;
  type: string;                          // BetDef.id
  target?: T;                            // number, hand ref, etc.
  amount: number;                        // chips
  declared: boolean;                     // true when bank = none
  working: boolean;                      // for lifecycle "working"; false = "off"
  placedAt: string;
  originRoundId: string;                 // first round (for working bets)
}
```

### 19.1 Events (append-only log)

```ts
type TableEvent = { seq: number; at: string } & (
  // table & series
  | { type: "TABLE_CREATED";    game: GameId; participation: Participation; settings: TableSettings }
  | { type: "SETTINGS_CHANGED"; patch: Partial<TableSettings> }
  | { type: "PARTICIPATION_CHANGED"; participation: Participation }              // only between series
  | { type: "SERIES_STARTED";   seriesId: string; label?: string; auto?: boolean; commit?: string }
  | { type: "SERIES_ENDED";     seriesId: string; seed?: string }
  | { type: "SESSION_ENDED" }
  | { type: "DEALER_CHANGED" }
  // results
  | { type: "LIVE_INPUT";       payload: unknown; source: "dealer" | "system" }  // ephemeral
  | { type: "RESULT_RECORDED";  result: ResultEnvelope<unknown> }
  | { type: "RESULT_UNDONE";    resultId: string }
  | { type: "RESULT_EDITED";    result: ResultEnvelope<unknown> }
  | { type: "RESULT_DELETED";   resultId: string }
  | { type: "ANIMATION_PREVIEW"; eventId: string }                                // ephemeral
  // players & bank
  | { type: "PLAYER_JOINED";    player: Player }
  | { type: "PLAYER_UPDATED";   playerId: string; patch: Partial<Pick<Player,"name"|"color"|"seat"|"status">> }
  | { type: "PLAYER_REMOVED";   playerId: string; reason?: string }
  | { type: "BANK_ISSUED";      playerId: string; amount: number; reason: "buyin"|"rebuy"|"bonus"|"correction" }
  | { type: "BANK_ADJUSTED";    playerId: string; delta: number; reason: string }
  // betting
  | { type: "BETS_OPENED";      roundId: string; closesAt?: string }
  | { type: "BET_PLACED";       bet: PlacedBet }
  | { type: "BET_UPDATED";      betId: string; patch: Partial<Pick<PlacedBet,"amount"|"working">> }
  | { type: "BET_REMOVED";      betId: string }
  | { type: "BETS_CLOSED";      roundId: string; by: "dealer"|"timer"|"auto" }
  // participation
  | { type: "TURN_ASSIGNED";    playerId: string | null; role: "shooter" | "seat"; auto?: boolean }
  | { type: "PLAYER_ACTION";    playerId: string; action: unknown; intent?: boolean }   // intent = informational (physical tables)
);
```

Ephemeral events (`LIVE_INPUT`, `ANIMATION_PREVIEW`) are broadcast, not persisted; the latest `LIVE_INPUT` is retained in memory for mid-round joiners.

### 19.2 Reducer Composition

State = `moduleReducer(moduleState)` ⊕ `platformReducer(players, bank, rounds, bets, settlements)`. The platform reducer calls `module.settle` on each `RESULT_RECORDED` that closes a round. Both are pure; both run on every client.

---

## 20. Realtime Sync Protocol

### 20.1 Transport

Socket.IO over WebSocket, path `/ws`, JSON.

### 20.2 Handshake

```
client → { op: "join", code, role: "dealer"|"display"|"player", token?, sinceSeq?, takeover? }
server → { op: "joined", role, game, participation, seq, snapshot?: Table, events?: TableEvent[], live?, playerId? }
       | { op: "error", code: "NOT_FOUND"|"BAD_TOKEN"|"DEALER_ACTIVE"|"UNSUPPORTED_GAME"|"PLAYERS_DISABLED"|"TABLE_FULL"|"JOINING_CLOSED"|"SESSION_ENDED" }
```

### 20.3 Messages

```
dealer/player → { op: "event", clientId, event }           // no seq
server        → { op: "ack", clientId, seq } | { op: "reject", clientId, reason }
server        → { op: "event", event }                     // to room
server        → { op: "presence", dealers, displays, players: [{ id, connected }] }
player/dealer → { op: "virtual", kind: "trigger"|"action"|"force", clientId, payload? }
any           → { op: "ping" } / { op: "pong" } / { op: "resync", sinceSeq }
```

### 20.4 Permissions (server-enforced)

| Role | May emit |
|---|---|
| dealer | Every event type except `BET_PLACED`/`BET_UPDATED`/`BET_REMOVED` on behalf of a player (dealer voids bets via `BET_REMOVED` with `by: "dealer"` allowed), `PLAYER_JOINED` (server-generated). |
| player | `BET_PLACED` / `BET_UPDATED` / `BET_REMOVED` where `bet.playerId === self`; `PLAYER_UPDATED` for own `name`/`color`; `PLAYER_ACTION` for self; `virtual.trigger`/`virtual.action` only when `module.turn()` names self. |
| display | Nothing. |

The server checks role and ownership; the reducer checks game legality (bets open, bankroll, limits). Ownership violations are `reject`ed and never logged; legality violations are logged and become reducer no-ops so every client agrees.

### 20.5 Ordering and Idempotency

As v2.0: server-assigned `seq`, `clientId` dedupe, strict order, `resync` on gap.

### 20.6 REST

```
POST /tables                                 { game, participation, settings }   → { code, dealerToken }
GET  /tables/:code                                                               → { exists, game, participation, seriesNumber, resultCount, displays, players, dealerConnected, joiningOpen }
POST /tables/:code/players                   { name, color }                     → { playerId, playerToken, pending }
POST /tables/:code/players/:id/reissue       (dealer token)                      → { playerToken }
GET  /tables/:code/export?series=n           (dealer token)                      → text
GET  /tables/:code/fairness?series=n                                             → { commit, seed?, draws: [...] }   (seed only after reveal)
GET  /games · GET /healthz · GET /version.json
```

### 20.7 Latency Budget

Dealer confirm or player bet → display paint: ≤ 300 ms LAN/same-region, ≤ 800 ms cross-region. Virtual trigger → first reveal on display: ≤ 500 ms.

---

## 21. Persistence

As v2.0 (`localStorage`, IndexedDB, SQLite default / Redis optional, 30-day reopen). Virtual seeds are stored server-side encrypted at rest with a service key and are only written to the log at reveal.

---

## 22. Visual Design

As v2.0 ("Table Felt" default; Midnight, Crimson, High Contrast; scaling rules), plus:

- **Chips**: flat discs with edge stripes, denomination numerals in the centre; colours 5 red, 25 green, 100 black, 500 purple, 1000 gold (mapped to the configured denominations in order).
- **Player colours**: 12-colour palette with ≥ 3:1 contrast against felt; avatar is a chip with the player's initial.
- **Player phone surfaces** use the same tokens at phone scale; felt zones have ≥ 48 px hit areas and show stacked chips with the player's colour ring.
- Virtual outcomes carry a discreet "VIRTUAL" tag on the board; physical ones carry none.

---

## 23. Accessibility and Input

As v2.0, plus: player felt zones announce label and current stake; action buttons ≥ 64 px with countdown announced at 10 s and 5 s; shake-to-roll always has a button alternative; colour is never the only indicator of win/lose on phones.

---

## 24. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | TypeScript, Vite, Preact | Small bundle, fast TV boot, shared component model. |
| Engines | Pure TS, zero deps, 100% branch-tested | Shared by client and Virtual Dealer. |
| Rendering | DOM + CSS for boards and felts; `<canvas>` for particles, wheel, dice tumble | Crisp at any scale. |
| Validation | zod | Shared schemas; server payload validation. |
| Sync server | Node 20, Fastify + Socket.IO | Minimal, Railway-friendly. |
| RNG | Node `crypto` CSPRNG + HMAC-SHA256 draw derivation | Auditable (Appendix C). |
| Persistence | better-sqlite3 on a volume; Redis optional | Zero-ops default. |
| Styling | Vanilla CSS with custom properties | Theming without a framework. |
| PWA | Manifest + service worker | Add-to-home-screen for dealer and player phones. |
| Tooling | pnpm workspaces, Vitest, fast-check, Playwright | Property tests for reducers and settlement. |

---

## 25. Deployment

### 25.1 Topology

Railway project **`casino-lord`**, one service **`sync`** serving the SPA and hosting the Virtual Dealer; one volume at `/data`. Domain `casinolord.noctusoft.dev` (Railway domain initially).

### 25.2 Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | Railway-provided | HTTP/WS |
| `PERSIST` | `sqlite` | `memory` / `sqlite` / `redis` |
| `SQLITE_PATH` | `/data/casino-lord.db` | |
| `REDIS_URL` | — | when `PERSIST=redis` |
| `SEED_KEY` | — (required in prod) | encrypts stored virtual seeds |
| `TABLE_TTL_HOURS` | `6` | idle purge |
| `TABLE_RETENTION_DAYS` | `30` | persisted retention |
| `PUBLIC_URL` | — | QR codes |
| `ENABLED_GAMES` | all four | feature-gate modules |
| `ENABLE_PLAYER_MODE` | `true` | global kill-switch for player joins |
| `ENABLE_VIRTUAL` | `true` | global kill-switch for the Virtual Dealer |
| `MAX_PLAYERS_HARD` | `50` | upper bound regardless of table setting |

### 25.3 Pipeline

GitHub → Railway auto-deploy on `main`; `npm run deploy` stamps `version.json`; `GET /healthz`; Railway SSH for inspection only.

### 25.4 Static-Only Fallback

The SPA runs as a static site with Solo mode fully functional for every game, including local players in extra tabs and an in-process Virtual Dealer. Dealer/Display/Player show "Sync server not configured" when `VITE_SYNC_URL` is unset.

---

## 26. Security, Fairness, and Privacy

- **No real money**: no payment code paths exist; chips are integers with no currency semantics on player surfaces; "Play chips — no cash value" is shown on join, in ℹ, and on the leaderboard.
- **Identity**: no accounts. Dealer token 128-bit; player token 128-bit bound to `playerId`; display needs only the code. Codes: 32^6 ≈ 1.07 B.
- **Authorisation**: server enforces role and ownership (§20.4); rejected events are never logged. Player-supplied names are trimmed, length-limited, and rendered as text (never HTML).
- **Rate limits**: 20 events/s per dealer; 10 events/s per player; 5 table creations/min per IP; 10 player joins/min per IP; 2 virtual triggers/s per table.
- **Fairness**: commit–reveal per series (§14.3, Appendix C). The Virtual Dealer never reads bets when producing outcomes (its `step` receives module state only; bets live in platform state).
- **Physical integrity**: the server never generates or alters results for `outcomeSource = physical`; switching sources requires a new series and is recorded.
- **Transport**: HTTPS/WSS only; CSP without inline scripts.
- **Privacy**: no PII beyond a chosen display name; tables and names purge with retention; exports require the dealer token.

---

## 27. Performance Targets

| Metric | Target |
|---|---|
| Display cold load → first board paint (TV browser, 4G) | ≤ 2.5 s |
| Player join → felt interactive (phone, 4G) | ≤ 3 s |
| Client bundle (gzipped, excl. fonts), core + one game | ≤ 240 KB; games lazy-loaded |
| Dealer/player tap → local UI response | ≤ 50 ms |
| Bet placed → display strip update (LAN) | ≤ 300 ms |
| Virtual trigger → first reveal on display | ≤ 500 ms |
| Settlement for 50 players × 10 bets | ≤ 5 ms |
| Animation frame rate on 2019-era smart TV | ≥ 30 fps; particles auto-degrade |
| Sync server | 500 concurrent tables, 2,000 concurrent players on 512 MB |

---

## 28. Testing Strategy

- **Engine unit tests** per game (100% branch) with fixtures in each game document.
- **Settlement tests** per game: every catalogue entry × every relevant result under each rule variant; working-bet carry; rounding.
- **Bank reducer**: property tests — chips issued always reconcile with bankrolls + felt + net settlements after any sequence of events including undo/edit.
- **Reducer replay**: random event logs replayed twice → identical state; module + platform composition.
- **Virtual Dealer**: same seed → identical results; commitment verifies; shoe exhausts at penetration and forces a new series; `step` never observes bets (type-level and runtime guard).
- **Protocol / permissions**: player cannot bet for another, cannot trigger out of turn, cannot exceed bankroll (logged no-op), late bets no-op; takeover; `TABLE_FULL`, `JOINING_CLOSED`.
- **Contract harness**: every module through a generic suite — initial state, quick entry, undo, series reset, export/import round-trip, catalogue → calculator render, `settle` with an empty bet list.
- **E2E (Playwright)** per game: dealer phone + TV + two player phones; open bets → place → close → result (physical and virtual) → settlement visible everywhere; shooter/turn flows.
- **Visual regression**: each game × layout preset at 720p/1080p/4K; player felt at 360×780 and 430×930.
- **Device matrix**: iOS Safari, Android Chrome (dealer, players); Chrome/Edge Windows, Apple TV via AirPlay, Samsung Tizen, Fire TV Silk (display). Shake-to-roll on iOS requires motion permission prompt; tested.

---

## 29. Milestones

| # | Milestone | Scope |
|---|---|---|
| M1 | Core + Baccarat engine | `core` contract (incl. bets/settle types), event envelope, reducer harness; baccarat engine, roads, catalogue, settle; ASCII board CLI. |
| M2 | Solo Baccarat | Dealer/Display shells, card picker, baccarat views, calculator from catalogue, import/export, IndexedDB. |
| M3 | Sync | Sync service, Dealer/Display modes, codes + QR, reconnect/buffer, takeover, SQLite, Railway deploy. |
| M4 | Animations | Framework, styles (Appendix B), editor, preview, sound, reduced-motion; baccarat presets incl. dragon. |
| M5 | Player Mode core | Player shell, join flow + approval, roster, house bank, chip tray, felt zones, betting rounds, settlement, display players panel + betting strip, leaderboard; baccarat player felt; declared-bets mode. |
| M6 | Virtual Dealer | Server RNG, commit–reveal, `virtual.step` hosting, pacing, fairness endpoint and verifier page; baccarat virtual shoe (dealer-triggered and auto). |
| M7 | Roulette | Engine, number grid, board, wheel, stats, catalogue (inside/outside/call), player felt, virtual spin, presets. |
| M8 | Craps | Engine, dice picker, puck board, shooter stats, working-bet catalogue, player felt, shooter phone (shake/tap), rotation, presets. |
| M9 | Blackjack | Engine, multi-seat entry, dealer play validation, board, catalogue, player seats + actions (virtual) and intents (physical), turn timer, presets. |
| M10 | Polish | Themes, ZH labels, PWA, device matrix, visual regression across all games and phone sizes, session export. |

---

## 30. Resolved Decisions

| Topic | Decision |
|---|---|
| Multi-game | One platform, one code space, one sync service; games are modules behind §6. A table has exactly one game. |
| Player layer | Optional, three independent switches (`playerMode`, `bank`, `outcomeSource`), settable per table and changeable between series. |
| Chips | Play tokens only, integers, no currency semantics on player surfaces. Real money is permanently out of scope. |
| Settlement | Derived deterministically on every client via `module.settle`; never an event. |
| Bet definitions | A single bet catalogue drives felt, validation, settlement, and the dealer calculator. |
| Virtual outcomes | Generated only in the sync service's Virtual Dealer (or in-process for Solo), with per-series commit–reveal; never on physical tables; mixed series disallowed. |
| Server game logic | Only `virtual.step` for virtual tables; all other logic remains client-side. |
| Shooter | Rotates in join order after seven-out by default; dealer can assign; player can pass. |
| Blackjack decisions on physical tables | Relayed to the dealer as intents; not authoritative. |
| Sync backend / authority / multi-dealer / sounds / domain | As v2.0. |

---

## 31. Open Questions

1. **Branding** — final name/logo ("Casino Lord" is the working title).
2. **Pit view** — future display mode tiling several tables; also a "house leaderboard" across tables in one venue.
3. **Player accounts** — whether a persistent nickname/avatar across sessions (still no money) is worth a lightweight account later.
4. **Tournament mode** — timed sessions with fixed buy-ins and a final ranking; natural extension of the bank/leaderboard.
5. **Side games** — baccarat side bets (Dragon Bonus, Perfect Pair, Lucky 6), blackjack Perfect Pairs / 21+3, craps bonus bets beyond Fire/ATS: which to include in the catalogues for v1.
6. **Shake-to-roll on iOS** — motion permission UX; fallback button is always present, but confirm whether shake is worth the prompt.
7. **Chip denominations** — fixed palette vs. dealer-defined; and whether to display a currency label when the dealer is running a real-chip (bank = none) night.
8. **Label language default** — EN, or EN+ZH for baccarat.

---

## Appendix A — Export Text Format (Envelope)

```
#casino-lord v3 game=<id> table=<code> series=<n> started=<ISO> source=<physical|virtual> commit=<hex?> seed=<hex?> rules=<base64url JSON>
<game-specific body — see game document>
#players
<playerId> <name> issued=<n> net=<n> final=<n>
#bets
<roundId> <playerId> <betType>[:<target>] <amount> <outcome> <profit>
```

Import reads the header, validates rules, hands the body to `importSeries`, and (optionally) restores players and bets for a read-only review. Declared outcomes that conflict with recomputed outcomes block import unless forced.

---

## Appendix B — Animation Style Catalogue

| Style | Description | Uses |
|---|---|---|
| `none` | No visual; sound only if set. | — |
| `flash` | Screen-edge glow pulse in event colour. | — |
| `burst` | Radial light burst from `anchor`. | anchor |
| `sweep` | Coloured light bar sweeps across the board. | — |
| `banner` | Large text banner with `text` template. | — |
| `particles` | Confetti/sparks in event colour (GPU canvas). | anchor |
| `trail` | Glowing trail follows `path`. | path |
| `dragon` | Stylised dragon silhouette snakes along `path`. | path |
| `shake` | Brief board shake (seven-out, bust). | — |
| `spin` | Wheel/dice spin-to-result on the board graphic; module renders, framework times it. | — |
| `chips` ★ | Chip stacks slide from the felt to winners (display) / into the bankroll (phone). Used by `big_win` and settlement tickers. | anchor |

---

## Appendix C — Fairness Verification Procedure

For any virtual series after its seed is revealed:

1. Fetch `GET /tables/:code/fairness?series=n` → `{ commit, seed, draws }`, or read `commit` from `SERIES_STARTED` and `seed` from `SERIES_ENDED` in an export.
2. Verify `SHA256(seed ∥ tableCode ∥ seriesId) == commit`.
3. For each draw `i` in order, compute `HMAC-SHA256(seed, i)` and derive a uniform integer in `[0, n_i)` by rejection sampling on the leading 4 bytes (`n_i` is the range the module requested: 6 for a die, 37/38 for a wheel, remaining-cards for a shoe shuffle step).
4. Feed the sequence into the module's `virtual.step` (published as part of the open client bundle) from the series' initial state; the produced results must match the log.

A verifier page at `/verify` performs steps 1–4 in the browser from a pasted export or a table code.

---

*End of platform specification.*
