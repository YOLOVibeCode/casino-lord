# Casino Lord

Multi-game electronic casino table system: a dealer phone records (or virtually deals) results, a TV shows the live scoreboard, and — optionally — a room full of people join from their phones to bet with play chips.

Games: Baccarat · Roulette · Craps · Blackjack.

**Play chips only. No real money, ever.**

## Status

Live: [casinonight.app](https://casinonight.app) (also served at [vegasnight.app](https://vegasnight.app) and [casinolord.app](https://casinolord.app) — same deployment, three domains). Check what's actually running with `GET /healthz` or `GET /version.json` on any of them; both are more current than any date in this file.

Milestones M1–M9 are complete; M10 (polish) is in progress.

| # | Milestone | Status |
| --- | --- | --- |
| M1 | Core + Baccarat engine | Complete |
| M2 | Solo Baccarat | Complete |
| M3 | Sync | Complete |
| M4 | Animations | Complete |
| M5 | Player Mode core | Complete |
| M6 | Virtual Dealer | Complete |
| M7 | Roulette | Complete |
| M8 | Craps | Complete |
| M9 | Blackjack | Complete |
| M10 | Polish (themes, ZH labels, PWA, device matrix, visual regression, session export) | In progress — visual regression currently covers baccarat only; roulette/craps/blackjack baselines are still open. |

See [`SPEC.md`](SPEC.md) §29 for full milestone scope.

## Specifications

| Document | Scope |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Platform: tables, Dealer / Display / Player roles, participation modes, banks and betting rounds, virtual outcomes with commit–reveal fairness, sync protocol, game-module contract, deployment. |
| [`SPEC-BACCARAT.md`](SPEC-BACCARAT.md) | Six-slot card entry, Punto Banco engine, roads (bead plate, big road, big eye boy, small road, cockroach pig), bets, virtual shoe. |
| [`SPEC-ROULETTE.md`](SPEC-ROULETTE.md) | Number entry, results board, wheel, hot/cold and property stats, full inside/outside/call bet felt, virtual spin. |
| [`SPEC-CRAPS.md`](SPEC-CRAPS.md) | Dice entry, pass-line state machine, puck and point boxes, shooter stats, working bets, shooter-rolls-from-phone. |
| [`SPEC-BLACKJACK.md`](SPEC-BLACKJACK.md) | Multi-seat card entry, hand engine, dealer play validation, player seats and actions, virtual shoe. |
| [`SPEC-PLATFORM-v2.md`](SPEC-PLATFORM-v2.md) | Superseded 2.0 platform baseline, retained for the shell, calculator, persistence and theme behaviours that `SPEC.md` references as "v2.0". |
| [`ONBOARDING.md`](ONBOARDING.md) | Every way a person gets into a table (QR, code, reissue link, reconnect), what breaks at each step, and where the test for it lives. Not a spec — a map of the actual join/reconnect/timeout behaviour and its coverage. |

## Development

Requires Node 22 (`.nvmrc`) and pnpm 10 (`corepack enable`).

```bash
pnpm install --frozen-lockfile
pnpm check          # typecheck + lint + test — what CI runs
```

> **Node 26 gotcha:** on Node 26+ the built-in `localStorage` global shadows jsdom's, and a few unit tests that touch `localStorage` directly (`dealer-token.test.ts`, `LandingPage.test.tsx`) fail for reasons unrelated to the code under test. Use the `.nvmrc` version (Node 22) locally; CI already does.

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` / `pnpm format` | Prettier check / fix |
| `pnpm test` / `pnpm test:watch` | Vitest, all packages |
| `pnpm e2e` | Playwright end-to-end suite (`e2e/`) — boots a production-style build against an in-memory sync server |
| `pnpm e2e:update` | Same, regenerating visual-regression baselines |
| `pnpm build` | Vite web bundle, then `tsc` for sync |
| `pnpm start` | Run the built sync server (`apps/sync/dist/main.js`), serving the built web app |
| `pnpm stamp` | Write `apps/web/dist/version.json` (what `/version.json` reports in production) |

Layout is a pnpm workspace: `packages/core` (platform primitives), `packages/game-*` (one `GameModule` per game), `packages/ui` (shared inputs), `apps/web` (Preact SPA), `apps/sync` (Fastify + Socket.IO relay and Virtual Dealer), `e2e` (Playwright end-to-end tests, run against a built instance, separate from each package's own Vitest unit tests). Packages are added as milestones land.

## Contributing and agents

Work happens on feature branches with PRs into `main`; CI must pass. [`AGENTS.md`](AGENTS.md) is the onboarding document for anyone — human or Cursor Cloud Agent — making a change: where the truth is, the commands, conventions, and hard limits. `.cursor/hooks.json` enforces the git and deploy limits inside agent VMs.
