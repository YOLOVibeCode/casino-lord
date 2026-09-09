# Casino Lord — Platform Specification

> **Status: superseded baseline.** This is the 2.0 platform specification, kept because `SPEC.md` (3.0) says "as v2.0" for behaviours it did not restate — shell confirm/undo/result-detail/connection/haptics (§8), display full-screen/scaling/idle-attract/info-gesture/late-join (§9), the payout calculator framework (§12), persistence (§16), themes and scaling rules (§17). Read the referenced section here when `SPEC.md` points to it. Where the two documents disagree, **`SPEC.md` 3.0 wins**; game documents are versioned 3.0 and depend on `SPEC.md`, not on this file.

**Version:** 2.0
**Status:** Specification (development-ready)
**Owner:** Noctusoft
**Last updated:** 2026-09-08

**Document set**

| Document | Scope |
|---|---|
| `SPEC.md` (this file) | Platform: tables, roles, sync, animation framework, game-module contract, stack, deployment. |
| `SPEC-BACCARAT.md` | Baccarat module: six-slot dealer entry, Punto Banco engine, roads, calculator. |
| `SPEC-ROULETTE.md` | Roulette module: number entry, results board, wheel, statistics, calculator. |
| `SPEC-CRAPS.md` | Craps module: dice entry, pass-line state machine, puck, shooter stats, calculator. |
| `SPEC-BLACKJACK.md` | Blackjack module: multi-seat card entry, hand engine, dealer play validation, calculator. |

Game documents depend on this one and never redefine platform behaviour. Where a game document says "platform", it refers to a section here.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Glossary](#3-glossary)
4. [System Architecture](#4-system-architecture)
5. [Game Module Contract](#5-game-module-contract)
6. [Roles and Modes](#6-roles-and-modes)
7. [Table Lifecycle](#7-table-lifecycle)
8. [Dealer Shell](#8-dealer-shell)
9. [Display Shell](#9-display-shell)
10. [Shared Input Components](#10-shared-input-components)
11. [Animation Framework](#11-animation-framework)
12. [Payout Calculator Framework](#12-payout-calculator-framework)
13. [Settings and Configuration](#13-settings-and-configuration)
14. [Data Model](#14-data-model)
15. [Realtime Sync Protocol](#15-realtime-sync-protocol)
16. [Persistence](#16-persistence)
17. [Visual Design](#17-visual-design)
18. [Accessibility and Input](#18-accessibility-and-input)
19. [Technology Stack](#19-technology-stack)
20. [Deployment](#20-deployment)
21. [Security and Privacy](#21-security-and-privacy)
22. [Performance Targets](#22-performance-targets)
23. [Testing Strategy](#23-testing-strategy)
24. [Milestones](#24-milestones)
25. [Resolved Decisions](#25-resolved-decisions)
26. [Open Questions](#26-open-questions)
27. [Appendix A — Export Text Format (Envelope)](#appendix-a--export-text-format-envelope)
28. [Appendix B — Animation Style Catalogue](#appendix-b--animation-style-catalogue)

---

## 1. Overview

Casino Lord is a professional-grade **multi-game electronic table display** that replicates the scoreboards seen at live casino tables. It runs entirely in the browser and is split into two coordinated experiences that share one **table**:

- **Dealer Mode** — a phone/tablet interface where the dealer records what physically happened at the table (cards dealt, number spun, dice rolled). A game-specific engine applies the official rules, determines the outcome, and publishes it.
- **Display Mode** — a large-screen (TV / monitor / projector) interface that shows the game's live scoreboard, statistics, the current round, and plays configurable outcome animations when a result is declared.

The platform supports four games at launch, each as a self-contained module on a common core:

| Game | What the dealer enters | What the display shows |
|---|---|---|
| **Baccarat** | Up to six cards (Player/Banker) | Bead plate, big road, derived roads, hand cards, stats |
| **Roulette** | Winning number (0–36, 00) | Results column, wheel, hot/cold, sector and property stats |
| **Craps** | Two dice | Puck ON/OFF + point, roll history, shooter stats, distribution |
| **Blackjack** | Dealer hand cards; per-seat cards or outcomes | Dealer hand, seat results, table stats, shoe penetration |

Both devices join the same table via a short code. Results entered on the dealer device appear on every display in real time. A single-device **Solo** mode (dealer + display on one screen) is supported for practice and home use.

---

## 2. Goals and Non-Goals

### Goals

- Look and feel indistinguishable in quality from a real casino table display, for every supported game.
- Dealer records any single result in under 6 seconds with one thumb (game documents define per-game targets).
- Outcome resolution is 100% rule-accurate for each game, with the common rule variants configurable.
- Display updates within 300 ms of the dealer confirming a result on the same network.
- All animations are configurable (on/off, style, duration, sound) per outcome type, per game.
- Adding a fifth game requires implementing the module contract (§5) and nothing else: no changes to sync, tables, shells, or deployment.
- Works offline on a single device; works across devices with a lightweight realtime backend.
- Zero-account, zero-install: open a URL, enter a table code.

### Non-Goals

- Prediction or betting advice. Boards are trackers, not predictors; the UI never suggests a bet.
- Real-money wagering, chips, bet placement, or payments of any kind.
- Casino-floor / pit management across many tables (one table per session; see Open Questions for a future pit view).
- Native mobile apps (PWA is sufficient).
- Random number generation or dealing. Casino Lord records real-world events; it never generates outcomes.

---

## 3. Glossary

Platform-wide terms. Game-specific terms live in each game document.

| Term | Meaning |
|---|---|
| **Table** | A session bound to one game, one active dealer device, and any number of display devices. Identified by a 6-character code. |
| **Game module** | A package implementing §5 for one game. |
| **Result** | One recorded unit of play: a baccarat hand, a roulette spin, a craps roll, a blackjack round. |
| **Series** | The natural reset unit for a game's board. Baccarat/Blackjack: *shoe*. Roulette: *session*. Craps: *shooter*. Starting a new series clears the board (history retained). |
| **Live input** | Ephemeral, pre-confirmation state mirrored from dealer to display (e.g., cards as they are entered). Not part of the permanent log. |
| **Event log** | The ordered, append-only list of table events. Source of truth; state is derived by replay. |
| **Shell** | The game-agnostic frame of the Dealer or Display UI (header, connection, menu, animation layer) into which a module mounts its views. |

---

## 4. System Architecture

```
┌──────────────────┐        WebSocket (Socket.IO)      ┌──────────────────┐
│   Dealer Mode    │ ───────────────────────────────▶  │   Sync Service   │
│  (phone/tablet)  │ ◀───────────────────────────────  │  (Node, Railway) │
│  shell + module  │           ack / state             └────────┬─────────┘
└──────────────────┘                                            │ broadcast
                                                                ▼
                                                       ┌──────────────────┐
                                                       │   Display Mode   │
                                                       │  (TV / browser)  │  × N
                                                       │  shell + module  │
                                                       └──────────────────┘
```

- **Client**: one static SPA. The route selects the mode; the table's `game` field selects which module to mount. All game logic lives client-side in pure, framework-free engine packages so dealer, display, and server compute identical state.
- **Sync Service**: a small relay that owns table rooms, holds the authoritative event log per table (memory + SQLite/Redis), assigns sequence numbers, and fans out events. It is **game-agnostic**: it validates the envelope of every event and delegates payload validation to the module's schema, but never runs game logic.
- **Source of truth**: the ordered event log per table. Any client rebuilds full state by replaying events through the module's reducer. Late joins, reconnects, undo, and edits fall out of this for free.
- **Sync adapter**: clients talk to sync through `SyncAdapter` with three implementations: `LocalAdapter` (same device), `BroadcastChannelAdapter` (multiple tabs, one machine), `WebSocketAdapter` (cross-device). Swapping backends requires no UI changes.

### 4.1 Package Layout

```
casino-lord/
  apps/
    web/                    # SPA: shells, routing, sync adapters, settings UI
    sync/                   # Fastify + Socket.IO relay
  packages/
    core/                   # Table, event envelope, GameModule contract, shared types, calculator/animation frameworks
    ui/                     # Shared input components (card picker, number grid, dice picker), theme tokens
    game-baccarat/
    game-roulette/
    game-craps/
    game-blackjack/
```

Each `game-*` package has no dependency on `apps/*` and depends only on `core` (and `ui` for its views). `apps/web` imports a static registry of modules.

---

## 5. Game Module Contract

A game is a package exporting a single `GameModule`. Everything the platform needs to know about a game is expressed here.

```ts
export type GameId = "baccarat" | "roulette" | "craps" | "blackjack";

export interface GameModule<
  Rules,                 // rule/variant configuration (persisted in TableSettings)
  Result,                // one recorded result (persisted in RESULT_* events)
  LiveInput,             // ephemeral pre-confirm state (LIVE_INPUT events)
  State                  // derived state after replay (never persisted)
> {
  id: GameId;
  name: string;                                  // "Baccarat"
  seriesLabel: string;                           // "Shoe" | "Session" | "Shooter"
  resultLabel: string;                           // "Hand" | "Spin" | "Roll" | "Round"

  defaultRules: Rules;
  rulesSchema: ZodSchema<Rules>;
  resultSchema: ZodSchema<Result>;               // used by the sync server to validate payloads
  liveInputSchema: ZodSchema<LiveInput>;

  initialState(rules: Rules): State;
  reduce(state: State, event: TableEvent<Result, LiveInput>, rules: Rules): State;   // pure

  // Views (Preact components). The shell provides layout, header, menu, animation layer.
  DealerView: Component<{ state: State; rules: Rules; emit: Emit<Result, LiveInput> }>;
  DisplayView: Component<{ state: State; rules: Rules; layout: LayoutPreset }>;
  ResultDetailView: Component<{ result: Result; rules: Rules }>;   // tap-a-cell detail
  RulesSettingsView: Component<{ rules: Rules; onChange(patch: Partial<Rules>): void }>;

  // Animation events this game can raise, with default presets.
  animationEvents: AnimationEventDef[];
  deriveAnimations(prev: State, next: State, event: TableEvent): AnimationTrigger[];

  // Statistics rows shown in the shell's stats panel (label/value pairs; module decides content).
  stats(state: State, rules: Rules): StatRow[];

  // Payout calculator definition (§12).
  calculator: CalculatorDef<Rules>;

  // Import/export of a series as text (Appendix A body format is game-defined).
  exportSeries(series: Series<Result>, rules: Rules): string;
  importSeries(text: string, rules: Rules): { results: Result[]; warnings: string[] } | { error: string };

  // Layout presets supported by DisplayView.
  layouts: LayoutPreset[];
}
```

### 5.1 Contract Rules

- `reduce` must be pure and deterministic. Replaying the same log yields byte-identical state on every device.
- Modules never touch the network, storage, or clock. Timestamps come from event envelopes.
- Modules must handle `RESULT_EDITED` / `RESULT_DELETED` for any result in the series (recompute from that point).
- A module's `DealerView` must provide **Quick Entry**: recording an outcome with minimal or no detail (no cards, total-only dice, etc.). Quick-entry results are flagged so detail views can say "no detail recorded".
- A module's `DisplayView` is strictly read-only.
- Modules register their rule variants with the platform; the platform renders them through `RulesSettingsView` inside the shared settings screen.

---

## 6. Roles and Modes

| Mode | Device | Route | Capabilities |
|---|---|---|---|
| **Host** | Any | `/` | Landing: pick a game → Create Table; or Join as Display / Join as Dealer; or Solo. |
| **Dealer** | Phone / tablet | `/dealer/:code` | Record results, undo/edit, quick entry, new series, settings, export/import. |
| **Display** | TV / monitor | `/display/:code` | Read-only board, stats, animations. Full-screen. |
| **Solo** | Any | `/solo/:game` | Dealer controls + display on one screen. `LocalAdapter`. |

The table's game is fixed at creation and inferred by joining clients; a code never needs a game in the URL. Multiple displays may join one table. One dealer is active per table; a second dealer is offered takeover (§7.4).

---

## 7. Table Lifecycle

### 7.1 Create

1. Host picks a game and taps **Create Table**.
2. Client sends `POST /tables { game }`.
3. Service generates a 6-character code from an unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), unique among active tables, and returns `{ code, dealerToken }`. It appends `TABLE_CREATED { game, settings: defaults }`.
4. Host sees the code and two QR codes: `https://<host>/display/<code>` and `https://<host>/dealer/<code>?t=<dealerToken>`.

### 7.2 Join

- Display: enters code → connects → receives snapshot or event log → mounts the module for `table.game` → renders.
- Dealer: enters code + dealer token (QR or typed) → connects with write permission.

### 7.3 Idle and Expiry

- No connected clients for **6 hours** → purged from memory. Persisted tables can be reopened by code for 30 days (§16).
- Codes are never reused while a table is live.

### 7.4 Dealer Takeover

If a dealer connects while another dealer socket is active, the new client is offered **Take over**. On accept, the service revokes the old socket's write permission and notifies it ("Another device is now dealing"). Handles a dead phone battery gracefully.

### 7.5 New Series

Dealer taps **New {Shoe|Session|Shooter}** → confirmation → `SERIES_STARTED`. Displays clear the board with a wipe animation, increment the series number, and reset series stats. Previous series remain in history for the table's lifetime. Modules may also raise `SERIES_STARTED` automatically from a result (e.g., craps seven-out starts a new shooter) — see game documents.

---

## 8. Dealer Shell

The shell is common to all games. The module supplies the centre region.

```
┌─────────────────────────────────────┐
│ ● Table K7X2PQ · Shoe 3 · Hand 42   │  ← header: connection dot, code, series, result index
├─────────────────────────────────────┤
│                                     │
│        [ module DealerView ]        │  ← game-specific entry surface
│                                     │
├─────────────────────────────────────┤
│  [ UNDO ]   [ ✓ CONFIRM … ]         │  ← shell-owned action bar; module supplies label/colour/enabled
├─────────────────────────────────────┤
│  [ quick-entry row from module ]  ⚙ │
└─────────────────────────────────────┘
```

### 8.1 Shell Behaviours (all games)

- **Confirm**: enabled only when the module reports `readyToRecord`. Label and colour come from the module (e.g., `✓ CONFIRM BANKER 9`, `✓ CONFIRM 17 BLACK`, `✓ CONFIRM 7 — SEVEN OUT`). Optional **confirm delay** (0–3 s, default 0) with progress ring and Cancel.
- **Undo**: removes the last recorded result (`RESULT_UNDONE`). Multi-level to the start of the series. Requires a second tap within 3 s ("Tap again to undo Hand 42").
- **Result Detail**: tapping a result in the module's mini-history opens the module's `ResultDetailView` with **Edit** (reopens in the entry surface → `RESULT_EDITED`) and **Delete** (`RESULT_DELETED`).
- **Live input mirroring**: the module emits `LIVE_INPUT` as the dealer enters detail; displays mirror it. Ephemeral (§14.2).
- **Menu (⚙)**: New Series · Settings (rules, animations, display) · Show QR/code · Export series · Import series · History · Payout calculator · Disconnect.
- **Connection indicator**: green (connected), amber (reconnecting; results queued locally), red (offline > 10 s). Queued results flush in order on reconnect; displays show a catch-up animation.
- **Haptics**: `navigator.vibrate(10)` on each selection where supported (device setting).

---

## 9. Display Shell

```
┌────────────────────────────────────────────────────────────────────────┐
│ ♠ CASINO LORD · {Game}   Table 7 · {Series} 3        [ module stats ]  │  ← header
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                       [ module DisplayView ]                           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                     [ animation layer — full-screen overlay canvas ]
```

### 9.1 Shell Behaviours (all games)

- Reference resolution 1920×1080; scales to 720p and 4K via `rem`/`vmin` (§17.3). Portrait supported where a module offers a portrait layout.
- Full-screen on first tap/click (browser requirement) with a "Tap for full screen" hint. Cursor auto-hides after 3 s.
- Strictly read-only. Hidden info gesture: tap logo 5× → read-only panel with table code, game, connection state, version.
- **Idle attract**: after 90 s without events, a subtle shimmer moves across the board; disabled by setting.
- Late-joining displays receive the module's animation presets and rule settings from the log (`SETTINGS_CHANGED`) before rendering.
- Each display keeps its own layout preset and scale locally; animation settings are table-level unless the display sets *Override locally*.

---

## 10. Shared Input Components

Located in `packages/ui`, used by modules so entry feels identical across games.

### 10.1 Card Picker (Baccarat, Blackjack)

Bottom sheet, ~70% height. **Rank → Suit → ✓** in three taps, with an express path.

```
┌─────────────────────────────────────┐
│  {Context, e.g. Player · Card 2} ✕  │
├─────────────────────────────────────┤
│   A    2    3    4    5             │
│   6    7    8    9    10            │  ← rank grid, targets ≥ 64 px
│   J    Q    K                       │
├─────────────────────────────────────┤
│   ♠     ♥     ♦     ♣               │  ← suit row (♥♦ red, ♠♣ white)
├─────────────────────────────────────┤
│        ┌────────────┐               │
│        │    K♥      │  preview      │
│        └────────────┘               │
│  [ Remove ]              [   ✓   ]  │
└─────────────────────────────────────┘
```

- Tapping a rank selects it; tapping a suit selects it; preview updates; **✓** commits and (with *Auto-advance*, default on) reopens for the next slot the module names.
- **Express mode** (default on): if a suit is selected it "sticks"; tapping a rank commits instantly. With *Suit required* off, a rank alone commits `suit: null`.
- Ranks display the game's value as a subscript (module supplies the value function: baccarat 10/J/Q/K → 0; blackjack J/Q/K → 10, A → 1/11).
- Duplicate-card warning within a round (amber, non-blocking); over-count across a shoe (`decks × 4` copies) is blocking.
- Keyboard: `A 2–9 0(=10) J Q K`, suits `S H D C`, `Enter` confirm, `Backspace` remove.

### 10.2 Number Grid (Roulette)

Full-width layout mirroring the betting felt: zero(s) on top, 3 columns × 12 rows, coloured red/black/green, targets ≥ 56 px. Single tap selects; **✓** confirms (or auto-confirm setting for one-tap entry). Keyboard: type digits + `Enter`; `00` via double-zero key.

### 10.3 Dice Picker (Craps)

Two dice, side by side, each a 2×3 grid of pip faces (1–6). Tap die A face, tap die B face, **✓**. Express: tapping the second die auto-confirms (setting). Alternate **Total** mode: a 2–12 row with a Hard/Easy toggle where the total is ambiguous. Keyboard: two digits + `Enter`.

### 10.4 Outcome Chips

A row of large coloured buttons for quick entry (P/B/T; Red/Black/Green; Win/Lose/Push…). Modules supply chip definitions; the shell places them.

---

## 11. Animation Framework

Modules declare **animation events**; the platform owns presets, editor, scheduling, and rendering.

### 11.1 Event Definition

```ts
interface AnimationEventDef {
  id: string;                 // "banker_win", "seven_out", "zero_hit" …
  label: string;
  defaultPreset: AnimationPreset;
  layered?: boolean;          // plays concurrently with a main event at reduced intensity
}

interface AnimationTrigger {
  eventId: string;
  vars: Record<string, string | number>;   // substituted into banner text: {outcome} {total} {streak} …
  anchor?: { x: number; y: number };       // 0–1 screen coords; where bursts originate
  path?: { x: number; y: number }[];       // for path-following styles (e.g., dragon along a streak)
}
```

### 11.2 Preset Structure

```ts
interface AnimationPreset {
  enabled: boolean;
  style: AnimationStyle;        // Appendix B
  durationMs: number;           // 300–4000
  intensity: 1 | 2 | 3;
  color?: string;               // override; defaults to the event's semantic colour
  text?: string;                // banner text template
  sound?: string | null;        // asset id
  soundVolume: number;          // 0–1
  blockBoardUpdate: boolean;    // if true, the board updates after the animation
}
```

### 11.3 Scheduling Rules

- Main event plays first; layered events play concurrently at reduced intensity unless `blockBoardUpdate`.
- Interruptible: a new result cancels the current animation and plays the new one.
- Total animation time per result ≤ 4 s at default settings.
- `prefers-reduced-motion` → fall back to `flash` at intensity 1, no particles.
- Sounds require a user gesture to unlock audio; the display prompts once. Default: all sounds off.
- Presets are stored as JSON in table settings (`SETTINGS_CHANGED`), keyed by `game.eventId`. Import/export supported.

### 11.4 Animation Editor

Per event: enable, style, duration slider, intensity, colour (with "use event colour" default), banner text, sound + volume, **Preview** (fires `ANIMATION_PREVIEW` to all displays). Presets can be saved/loaded as named bundles per game.

---

## 12. Payout Calculator Framework

The platform renders a calculator from a module-supplied definition. Available in Dealer (menu) and Solo; optional small panel on Display.

```ts
interface CalculatorDef<Rules> {
  currency?: string;                           // overrides table default
  groups: {
    label: string;                             // "Main", "Odds", "Props" …
    bets: {
      id: string; label: string;
      pays(rules: Rules, ctx?: CalcContext): { num: number; den: number } | ((bet: number) => number);
      note?(rules: Rules): string | undefined; // "5% commission", "pays 1:2 on Banker 6" …
    }[];
  }[];
  contexts?: CalcContextDef[];                 // e.g., craps point number; blackjack BJ payout
}
```

- Input: bet amount (numeric keypad). Output: return and profit for every bet given the current rules.
- Rounding: to the currency's minor unit; house rounding mode configurable (down / nearest / up to 0.25, 0.50, 1.00).
- Modules may add running tallies (e.g., baccarat commission owed). Default off.

---

## 13. Settings and Configuration

Settings are scoped:

- **Table settings** (dealer-owned, broadcast): game rules (module `Rules`), animation presets, board options (labels/language, theme), table name.
- **Device settings** (local): layout preset, scale, sound unlock, animation override, cursor hide, full-screen preference, express mode, auto-advance, confirm delay, haptics.

Persistence: `localStorage` per device; table settings additionally in the event log so late joiners receive them.

---

## 14. Data Model

```ts
interface Table<R, L> {
  code: string;
  game: GameId;
  createdAt: string;
  series: Series<R>[];              // current = last
  settings: TableSettings;
  version: number;                  // event log length
}

interface Series<R> {
  id: string;                       // ulid
  number: number;                   // 1-based within table
  startedAt: string;
  label?: string;                   // e.g., shooter name/seat (craps), optional
  results: ResultEnvelope<R>[];
}

interface ResultEnvelope<R> {
  id: string;                       // ulid
  index: number;                    // 1-based within series
  recordedAt: string;               // ISO 8601
  quick: boolean;                   // true if recorded via quick entry (limited detail)
  data: R;                          // module Result
}

interface TableSettings {
  name: string;
  rules: unknown;                   // module Rules, validated by rulesSchema
  animations: Record<string, AnimationPreset>;    // key: eventId
  board: { language: "EN" | "ZH" | "EN+ZH"; theme: string; };
  currency: string;                 // ISO 4217
}
```

### 14.1 Events (append-only log)

```ts
type TableEvent<R = unknown, L = unknown> = { seq: number; at: string } & (
  | { type: "TABLE_CREATED";     game: GameId; settings: TableSettings }
  | { type: "SERIES_STARTED";    seriesId: string; label?: string; auto?: boolean }
  | { type: "LIVE_INPUT";        payload: L }                       // ephemeral
  | { type: "RESULT_RECORDED";   result: ResultEnvelope<R> }
  | { type: "RESULT_UNDONE";     resultId: string }
  | { type: "RESULT_EDITED";     result: ResultEnvelope<R> }
  | { type: "RESULT_DELETED";    resultId: string }
  | { type: "SETTINGS_CHANGED";  patch: Partial<TableSettings> }
  | { type: "ANIMATION_PREVIEW"; eventId: string }
  | { type: "DEALER_CHANGED" }
);
```

### 14.2 Ephemeral Events

`LIVE_INPUT` and `ANIMATION_PREVIEW` are broadcast but **not persisted** and not replayed to late joiners except the most recent `LIVE_INPUT`, which the server retains in memory so a display joining mid-round sees the in-progress state.

---

## 15. Realtime Sync Protocol

### 15.1 Transport

WebSocket via Socket.IO (reconnect, rooms, long-poll fallback). Path `/ws`. JSON messages.

### 15.2 Handshake

```
client → { op: "join", code, role: "dealer"|"display", token?, sinceSeq?, takeover? }
server → { op: "joined", role, game, seq, snapshot?: Table, events?: TableEvent[], live?: LiveInput }
       | { op: "error", code: "NOT_FOUND"|"BAD_TOKEN"|"DEALER_ACTIVE"|"UNSUPPORTED_GAME" }
```

- With `sinceSeq`, the server sends only the delta when it can; otherwise a snapshot.
- `UNSUPPORTED_GAME` is returned when a client build lacks the table's module (version skew).

### 15.3 Messages

```
dealer → { op: "event", clientId, event }                 // no seq yet
server → { op: "ack", clientId, seq }                     // to sender
server → { op: "event", event: TableEvent }               // to room, with seq
server → { op: "presence", dealers: 0|1, displays: n }
any    → { op: "ping" } / { op: "pong" }
client → { op: "resync", sinceSeq }
```

### 15.4 Ordering and Idempotency

- The server assigns a monotonically increasing `seq` per table and is the single writer.
- Clients buffer events while disconnected, tagged with `clientId` (ulid); the server deduplicates on `clientId`.
- Displays apply events strictly in `seq` order; on a gap they `resync`.
- The server validates the envelope with the core schema and the payload with the module's `resultSchema` / `liveInputSchema` (modules are bundled into the sync service for validation only; no reducers run server-side in v1).

### 15.5 REST

```
POST /tables                          { game }        → { code, dealerToken }
GET  /tables/:code                                    → { exists, game, seriesNumber, resultCount, displays, dealerConnected }
GET  /tables/:code/export?series=n                    → text (Appendix A), requires dealer token
GET  /games                                           → [{ id, name, version }]
GET  /healthz · GET /version.json
```

### 15.6 Latency Budget

Dealer confirm → display paint: ≤ 300 ms LAN/same-region, ≤ 800 ms cross-region.

---

## 16. Persistence

- **Client**: `localStorage` for device settings and last table code; `IndexedDB` for the local event log (Solo and offline queue).
- **Server**: in-memory log per table plus `PERSIST=sqlite` (default; volume-backed) or `PERSIST=redis`. Persisted tables can be reopened by code for 30 days.
- Export/import via text (Appendix A) is always available regardless of backend.

---

## 17. Visual Design

### 17.1 Theme: "Table Felt" (default)

- Background: deep green felt gradient `#0B3D2E → #062418` with noise texture and vignette.
- Panels: near-black `#0F1412`, 1 px gold hairline `#B8945A` at 40%, 8 px radius.
- Typography: display numerals in a condensed geometric sans (*Barlow Condensed* / *Oswald*); labels in *Inter*; Chinese in *Noto Sans SC*.
- Gold accent `#D4AF37` for headers and premium effects.
- Cards: white face, rounded 6%, rank in corner + centre pip; red suits `#C8102E`, black `#111`; back navy with gold lattice.
- Dice: ivory faces, black pips, subtle bevel.
- Semantic colour tokens per game are defined in game documents (e.g., baccarat Banker red / Player blue / Tie green; roulette red / black / green; craps point-made gold / seven-out red).

### 17.2 Alternate Themes

- **Midnight** — black/graphite, neon semantics.
- **Crimson** — burgundy felt, brass accents.
- **High Contrast** — pure black, saturated colours, thicker strokes.

Themes are CSS custom-property sets. Adding a theme requires no code changes.

### 17.3 Scaling

All dimensions in `rem`/`vmin`; root font size derived from viewport so 1080p and 4K render identical proportions. Modules declare a minimum cell size; below it the display switches to scrolling.

---

## 18. Accessibility and Input

- Dealer targets ≥ 56×56 px (≥ 64 px for card ranks); text contrast ≥ 4.5:1.
- Full keyboard support in Dealer/Solo; shared bindings in §10, game bindings in game documents. `Z` undo, `Enter` confirm, `N` new series (with confirmation).
- Outcomes never conveyed by colour alone (letters/glyphs/numerals always present).
- Screen-reader live region on the dealer announces the module's hint line.
- `prefers-reduced-motion` honoured (§11.3).

---

## 19. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | TypeScript, Vite, Preact | Small bundle, fast TV boot, shared component model. |
| Engines | Pure TS, zero deps, 100% branch-tested | Shared by client and server. |
| Rendering | DOM + CSS for boards; `<canvas>` for particle/path animations and the roulette wheel | Crisp at any scale; GPU only where needed. |
| Validation | zod | Shared schemas, server payload validation. |
| Sync server | Node 20, Fastify + Socket.IO | Minimal, Railway-friendly. |
| Persistence | better-sqlite3 on a volume; Redis optional | Zero-ops default. |
| Styling | Vanilla CSS with custom properties | Theming without a framework. |
| PWA | Manifest + service worker (offline shell) | Add-to-home-screen for dealer phones. |
| Tooling | pnpm workspaces, Vitest, Playwright | Per §4.1. |

---

## 20. Deployment

### 20.1 Topology

- Railway project **`casino-lord`**, one environment, one service **`sync`** that also serves the built SPA (single origin; no CORS/WS-origin issues). One volume at `/data` for SQLite.
- Domain: `casinolord.noctusoft.dev` (Railway-generated domain initially). Per-game paths are client routes, not subdomains.

### 20.2 Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | Railway-provided | HTTP/WS |
| `PERSIST` | `sqlite` | `memory` / `sqlite` / `redis` |
| `SQLITE_PATH` | `/data/casino-lord.db` | |
| `REDIS_URL` | — | when `PERSIST=redis` |
| `TABLE_TTL_HOURS` | `6` | idle purge |
| `TABLE_RETENTION_DAYS` | `30` | persisted retention |
| `PUBLIC_URL` | — | QR codes |
| `ENABLED_GAMES` | `baccarat,roulette,craps,blackjack` | feature-gate modules at the API |

### 20.3 Pipeline

- GitHub → Railway auto-deploy on `main`.
- `npm run deploy` locally stamps `version.json` with git SHA/date before pushing (Noctusoft convention); served at `GET /version.json`.
- Health check `GET /healthz`. Railway SSH only for live inspection.

### 20.4 Static-Only Fallback

The SPA must also run as a plain static site with Solo mode fully functional for every game; Dealer/Display show "Sync server not configured" when `VITE_SYNC_URL` is unset.

---

## 21. Security and Privacy

- No accounts, no PII. Codes: 32^6 ≈ 1.07 B; dealer token 128-bit.
- Displays are read-only by protocol; the server rejects `event` from non-dealer sockets.
- Rate limits: 20 events/s per dealer socket; 5 table creations/min per IP.
- Envelope + module payload validation server-side. Reducers not run server-side in v1.
- HTTPS/WSS only in production. CSP without inline scripts.
- Export requires the dealer token.

---

## 22. Performance Targets

| Metric | Target |
|---|---|
| Display cold load → first board paint (TV browser, 4G) | ≤ 2.5 s |
| Client bundle (gzipped, excl. fonts), core + one game | ≤ 220 KB; games lazy-loaded |
| Dealer tap → local UI response | ≤ 50 ms |
| Dealer confirm → display paint (LAN) | ≤ 300 ms |
| Animation frame rate on 2019-era smart TV | ≥ 30 fps; particles auto-degrade |
| Board recompute + paint at 500 results | ≤ 16 ms |
| Sync server | 500 concurrent tables on 512 MB |

---

## 23. Testing Strategy

- **Engine unit tests** per game (100% branch), with the fixtures listed in each game document.
- **Reducer replay tests**: random event logs (incl. undo/edit/delete) replayed twice must produce identical state; property-based.
- **Protocol tests**: join/snapshot/delta, reconnect with buffered events, takeover, out-of-order arrival, `UNSUPPORTED_GAME`.
- **Contract tests**: every registered module is exercised through a generic harness (initial state, quick entry, undo, series reset, export → import round-trip, schema round-trip).
- **E2E (Playwright)** per game: phone viewport records a result → TV viewport shows it and fires the animation hook; undo; new series.
- **Visual regression**: each game × layout preset at 720p/1080p/4K.
- **Device matrix**: iOS Safari, Android Chrome (dealer); Chrome/Edge Windows, Apple TV via AirPlay, Samsung Tizen, Fire TV Silk (display).

---

## 24. Milestones

| # | Milestone | Scope |
|---|---|---|
| M1 | Core + Baccarat engine | `core` contract, event envelope, reducer harness; baccarat engine + roads with tests; CLI renders any game's board as ASCII from an export file. |
| M2 | Solo Baccarat | Shells, card picker, baccarat Dealer/Display views, calculator, import/export, IndexedDB. Deployable static. |
| M3 | Sync | Sync service, Dealer/Display modes, codes + QR, reconnect/buffer, takeover, SQLite, Railway deploy. |
| M4 | Animation framework | All styles (Appendix B), editor, preview, sound, reduced-motion; baccarat presets incl. dragon. |
| M5 | Roulette | Engine, number grid, results board, wheel, stats, calculator, presets. |
| M6 | Craps | Engine (pass-line state machine), dice picker, puck/point board, shooter stats, calculator, presets. |
| M7 | Blackjack | Engine, multi-seat entry, dealer play validation, board, stats, calculator, presets. |
| M8 | Polish | Themes, ZH labels, PWA, device matrix, visual regression across all games. |

Game order (M5–M7) is by implementation complexity and may be reordered.

---

## 25. Resolved Decisions

| Topic | Decision |
|---|---|
| Multi-game | One platform, one table code space, one sync service; games are modules behind the §5 contract. A table has exactly one game. |
| Sync backend | Self-hosted Node (Fastify + Socket.IO) on Railway behind a `SyncAdapter` interface. |
| Authority | Server-assigned `seq`; event-sourced; clients replay through the module reducer. |
| Server game logic | None in v1; the server validates schemas only. |
| Series concept | Generic reset unit; each game names it (Shoe / Session / Shooter). |
| Quick entry | Mandatory for every module. |
| Multi-dealer | One active dealer; explicit takeover. |
| Sounds | Off by default; gesture-unlocked. |
| Domain | `casinolord.noctusoft.dev`; games as client routes. |

---

## 26. Open Questions

1. **Branding** — final name/logo for the display header ("Casino Lord" is working title).
2. **Currency default** and house rounding mode for calculators.
3. **Pit view** — a future display mode that rotates or tiles several tables (currently a non-goal).
4. **Game order** — confirm roulette → craps → blackjack, or reprioritise.
5. **Label language default** — EN, or EN+ZH dual labels for baccarat only.
6. **Admin PIN** — whether a lightweight PIN should allow reopening past tables from a new device.

---

## Appendix A — Export Text Format (Envelope)

Every export is UTF-8 text:

```
#casino-lord v2 game=<id> table=<code> series=<n> started=<ISO> rules=<base64url JSON>
<game-specific body — one result per whitespace-separated token or line; see game document>
```

Import reads the header, validates rules against the module's schema, and hands the body to `importSeries`. Declared outcomes that conflict with recomputed outcomes are reported line-by-line and block import unless forced.

---

## Appendix B — Animation Style Catalogue

| Style | Description | Uses `path`/`anchor` |
|---|---|---|
| `none` | No visual; sound only if set. | — |
| `flash` | Screen-edge glow pulse in event colour. | — |
| `burst` | Radial light burst from `anchor` (default: board centre). | anchor |
| `sweep` | Coloured light bar sweeps across the board. | — |
| `banner` | Large text banner slides in/out with `text` template. | — |
| `particles` | Confetti/sparks in event colour (GPU canvas). | anchor |
| `trail` | Glowing trail follows `path` (baccarat dragon streak, roulette wheel arc, craps roll history). | path |
| `dragon` | Stylised dragon silhouette snakes along `path`; intensity scales length and glow. | path |
| `shake` | Brief board shake (used for seven-out, bust). | — |
| `spin` | Wheel/dice spin-to-result on the board's graphic (roulette wheel, dice tumble). Module renders; framework times it. | — |

Modules may declare additional styles by registering a renderer with the framework; the editor lists all registered styles.

---

*End of platform specification.*
