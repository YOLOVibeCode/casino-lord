# Casino Lord

Multi-game electronic casino table system: a dealer phone records (or virtually deals) results, a TV shows the live scoreboard, and — optionally — a room full of people join from their phones to bet with play chips.

Games: Baccarat · Roulette · Craps · Blackjack.

**Play chips only. No real money, ever.**

## Status

Specification complete; implementation starting at milestone M1 (`SPEC.md` §29). `packages/core` exists with the first platform primitives and tests.

## Specifications

| Document | Scope |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Platform: tables, Dealer / Display / Player roles, participation modes, banks and betting rounds, virtual outcomes with commit–reveal fairness, sync protocol, game-module contract, deployment. |
| [`SPEC-BACCARAT.md`](SPEC-BACCARAT.md) | Six-slot card entry, Punto Banco engine, roads (bead plate, big road, big eye boy, small road, cockroach pig), bets, virtual shoe. |
| [`SPEC-ROULETTE.md`](SPEC-ROULETTE.md) | Number entry, results board, wheel, hot/cold and property stats, full inside/outside/call bet felt, virtual spin. |
| [`SPEC-CRAPS.md`](SPEC-CRAPS.md) | Dice entry, pass-line state machine, puck and point boxes, shooter stats, working bets, shooter-rolls-from-phone. |
| [`SPEC-BLACKJACK.md`](SPEC-BLACKJACK.md) | Multi-seat card entry, hand engine, dealer play validation, player seats and actions, virtual shoe. |

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
