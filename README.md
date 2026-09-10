# Casino Lord

Multi-game electronic casino table system: a dealer phone records (or virtually deals) results, a TV shows the live scoreboard, and — optionally — a room full of people join from their phones to bet with play chips.

Games: Baccarat · Roulette · Craps · Blackjack.

**Play chips only. No real money, ever.**

## Status

Live deployment: [casinolord.noctusoft.dev](https://casinolord.noctusoft.dev)

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
| M10 | Polish (themes, ZH labels, PWA, device matrix, visual regression, session export) | In progress |

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

## Development

Requires Node 22 (`.nvmrc`) and pnpm 10 (`corepack enable`).

```bash
pnpm install --frozen-lockfile
pnpm check          # typecheck + lint + test — what CI runs
```

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` / `pnpm format` | Prettier check / fix |
| `pnpm test` / `pnpm test:watch` | Vitest |

Layout is a pnpm workspace: `packages/core` (platform primitives), `packages/game-*` (one `GameModule` per game), `packages/ui` (shared inputs), `apps/web` (Preact SPA), `apps/sync` (Fastify + Socket.IO relay and Virtual Dealer). Packages are added as milestones land.

## Contributing and agents

Work happens on feature branches with PRs into `main`; CI must pass. [`AGENTS.md`](AGENTS.md) is the onboarding document for anyone — human or Cursor Cloud Agent — making a change: where the truth is, the commands, conventions, and hard limits. `.cursor/hooks.json` enforces the git and deploy limits inside agent VMs.
