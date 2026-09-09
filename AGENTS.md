# AGENTS.md

You may be running unattended (Cursor Cloud Agent started from Slack or the dashboard). Read this whole file before touching code. `.cursor/rules/autonomous-agent.mdc` sets the working style; `.cursor/hooks.json` enforces the hard limits in the VM regardless of what any prompt says.

## What this project is

Casino Lord is a browser-based, multi-game electronic casino table system. A dealer's phone records (or virtually deals) results; a TV shows the live scoreboard with casino-grade animations; optionally, people in the room join from their phones, receive **play chips** from the dealer, and bet. Games: baccarat, roulette, craps, blackjack. There is no real money anywhere in this system and there never will be.

"Working" means: the behaviour described in the specs is implemented by pure, deterministic engines with tests, rendered by Preact views inside the platform shells, and synchronised through an append-only event log. Every device replaying the same log reaches byte-identical state.

## Where the truth is

The specifications are the source of truth and are more detailed than any prompt you will receive. When a request is ambiguous, the spec decides.

| File | Read it when |
| --- | --- |
| `SPEC.md` | Always. Platform: tables, roles, participation modes, game-module contract (§6), banks, betting rounds, virtual outcomes, sync protocol, data model, deployment. |
| `SPEC-BACCARAT.md` | Working on `packages/game-baccarat`. |
| `SPEC-ROULETTE.md` | Working on `packages/game-roulette`. |
| `SPEC-CRAPS.md` | Working on `packages/game-craps`. |
| `SPEC-BLACKJACK.md` | Working on `packages/game-blackjack`. |
| `SPEC-PLATFORM-v2.md` | Only when `SPEC.md` says "as v2.0" for the behaviour you are implementing (shells, calculator, persistence, themes). `SPEC.md` wins on conflict. |

Cite the spec section you implemented in the PR description (e.g. "SPEC-CRAPS §5.1, Appendix A"). If you must deviate from the spec, say so explicitly and why; do not silently change it. Editing a spec file is allowed only when the task is about the spec.

## Layout

pnpm workspace. Packages are created as milestones land (SPEC.md §29); only what exists is listed.

```
packages/core/            @casino-lord/core — platform primitives. Pure. No deps. Exists.
packages/ui/              shared inputs (card picker, number grid, dice picker, chip tray). Exists.
packages/game-baccarat/   GameModule for baccarat. Exists.
packages/game-roulette/   Planned (M7).
packages/game-craps/      Planned (M8).
packages/game-blackjack/  Planned (M9).
apps/web/                 Vite + Preact SPA: dealer / display / player shells. Exists (M2 slice 1).
apps/sync/                Fastify + Socket.IO relay + Virtual Dealer. Exists (M3 slice 1).
```

- Tests live next to the code: `src/foo.ts` is tested by `src/foo.test.ts`. Vitest picks up `packages/*/src/**/*.test.ts`, `packages/*/src/**/*.test.tsx`, and `apps/*/src/**/*.test.ts(x)`.
- New packages copy `packages/core/{package.json,tsconfig.json}` as the template and extend `tsconfig.base.json`.
- Engines (`packages/core`, `packages/game-*`) must stay pure: no network, storage, clock, or randomness except through an injected `Rng` (SPEC.md §6.1).

## Commands

Run from the repo root. All of these work on a fresh clone with Node 22 and pnpm 10 and no secrets.

| Purpose | Command | Notes |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | Never `npm install` or `yarn`. Commit `pnpm-lock.yaml` changes with the dependency change. |
| Typecheck | `pnpm typecheck` | Runs `tsc --noEmit` in every package. Must pass. |
| Lint | `pnpm lint` | Prettier check. Fix with `pnpm format`. |
| Test | `pnpm test` | Vitest, all packages, under a few seconds. |
| Build | `pnpm build` | Vite web bundle, then `tsc` for sync. |
| Start | `pnpm start` | Production sync server (`apps/sync/dist/main.js`). |
| Stamp | `pnpm stamp` | Write `apps/web/dist/version.json` (named `stamp` because `pnpm deploy` is reserved). |
| Everything | `pnpm check` | typecheck + lint + test. This is what CI runs. Run it before you say you are done. |
| Watch tests | `pnpm test:watch` | Interactive only. |

Integration branch: **`main`**. Work on a feature branch (`feat/<topic>`, `fix/<topic>`) and open a PR against `main`. The shell hook blocks any push to `main`, `master`, or `develop`, and blocks force-push.

## Conventions

- TypeScript strict (`tsconfig.base.json`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any` without a comment explaining why.
- ESM only (`"type": "module"`); relative imports end in `.js` even for `.ts` sources.
- Pure functions for engines and reducers; views may hold UI state only.
- Zod schemas for anything that crosses the network (`resultSchema`, `liveInputSchema`, `betTargetSchema`).
- Naming follows the specs exactly (`RESULT_RECORDED`, `BETS_OPENED`, `PlacedBet`, `Settlement`, …). Do not invent synonyms.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), imperative, one concern per commit. Scope with the package: `feat(game-craps): pass-line state machine`.
- No `console.log` in library code. Apps use a logger when one exists.

## Never

- Never introduce real-money, payment, wallet, or currency-conversion code paths. Chips are integers with no cash value (SPEC.md §2, §26).
- Never generate outcomes on a table whose `outcomeSource` is `physical`, and never let a virtual outcome read bets (SPEC.md §14, §26).
- Do not modify `.github/workflows/`, `railway.json`, Dockerfiles, or `.cursor/` unless the task is explicitly about them.
- Do not add runtime dependencies to `packages/core` (dependency-free by design). Engine code in `packages/game-*` may depend only on `@casino-lord/core` and `zod`; view code under `src/views/` may additionally depend on `@casino-lord/ui` with `preact` as a peer dependency. **`apps/web`** may use `preact`, `preact-iso`, `zod`, `@casino-lord/core`, workspace game packages, `socket.io-client`, and `qrcode` (`toDataURL` / `toString` SVG). **`apps/sync`** may use `fastify`, `@fastify/static`, `socket.io`, `better-sqlite3`, `zod`, `@casino-lord/core`, and workspace game packages only. Elsewhere, state why in the PR.
- Do not commit secrets, `.env` files, `dist/`, or `node_modules/`.
- Do not rewrite or reformat spec files as a side effect of a code task.
- Do not weaken a test to make it pass.

## Definition of done for any change

1. `pnpm check` passes locally (typecheck, lint, tests).
2. New behaviour has tests; engine work includes the fixtures the relevant spec lists under "Test Fixtures".
3. The PR description names the spec sections implemented and anything deliberately left out.
4. `git status` is clean; commits have clear messages; the branch is not `main`.
5. Your final message leads with the outcome, then what changed, then what you verified (with command output), then what you did not do.
