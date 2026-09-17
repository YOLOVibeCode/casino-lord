# Onboarding map

Every way a person gets into a table, what breaks at each step, and where the test lives.

Roles: **Dealer** (phone, controls the table) · **Display** (TV, read-only board) · **Player** (guest phone, play chips).

---

## 1. Entry points

| # | Who | Surface | Lands on | Code |
| --- | --- | --- | --- | --- |
| P1 | Player | Join QR on the **Table created** screen | `/play/:code` | [TableCreatedPage.tsx](apps/web/src/pages/TableCreatedPage.tsx) |
| P2 | Player | Join QR badge on the **TV** | `/play/:code` | [DisplayShell.tsx](apps/web/src/shells/DisplayShell.tsx) → [QrBadge.tsx](apps/web/src/sync/QrBadge.tsx) |
| P3 | Player | Dealer menu → **Show QR** → Join (Player) | `/play/:code` | [DealerShell.tsx](apps/web/src/shells/DealerShell.tsx) → [QrDialog.tsx](apps/web/src/sync/QrDialog.tsx) |
| P4 | Player | Landing → **Join** → type code → Join as Player | `/play/:code` | [LandingPage.tsx](apps/web/src/pages/LandingPage.tsx) |
| P5 | Player | **Reissue link** handed out by the dealer | `/play/:code?t=` | [PlayersDialog.tsx](apps/web/src/shells/PlayersDialog.tsx) |
| P6 | Player | Returning — stored token in `localStorage` | `/play/:code` | [player-token.ts](apps/web/src/sync/player-token.ts) |
| P7 | Player | Solo link — another tab of the **same browser**, never another device (no QR, by design) | `/solo/:game/play` | [SoloPage.tsx](apps/web/src/pages/SoloPage.tsx) |
| D1 | Dealer | Dealer QR / link on the Table created screen | `/dealer/:code?t=` | [TableCreatedPage.tsx](apps/web/src/pages/TableCreatedPage.tsx) |
| D2 | Dealer | Landing → **Your tables** → Reopen | `/dealer/:code?t=` | [dealer-token.ts](apps/web/src/sync/dealer-token.ts) |
| D3 | Dealer | Landing → Join → Staff → paste dealer token | `/dealer/:code?t=` | [LandingPage.tsx](apps/web/src/pages/LandingPage.tsx) |
| D4 | Dealer | Second device on the same table → **takeover** | `/dealer/:code` | [handler.ts](apps/sync/src/ws/handler.ts) |
| V1 | Display | Display QR / link | `/display/:code` | [TableCreatedPage.tsx](apps/web/src/pages/TableCreatedPage.tsx) |
| V2 | Display | Landing → Join → Staff → Join as Display | `/display/:code` | [LandingPage.tsx](apps/web/src/pages/LandingPage.tsx) |

Everything a guest can do depends on a choice made **before** any of this: *Dealer only* vs *With players* in the create sheet. On a dealer-only table there is no join QR anywhere, and `/play/:code` answers `PLAYERS_DISABLED`.

---

## 2. The player path, step by step

```
create table ──▶ /created/:code ──▶ [QR] ──▶ /play/:code
                                              │
                        GET /tables/:code ────┤  NOT_FOUND · PLAYERS_DISABLED · INVALID_TABLE_CODE · TABLE_LOOKUP_FAILED
                                              │
                        ?t= or stored token ──┤  BAD_TOKEN → back to the name form
                                              │
                             name + colour ───┤  INVALID_NAME · INVALID_COLOR
                                              │
        POST /tables/:code/players ───────────┤  JOINING_CLOSED · TABLE_FULL · SESSION_ENDED · 429
                                              │
                    socket join (role=player) ┤  BAD_TOKEN · PLAYERS_DISABLED · timeout → enter anyway + banner
                                              │
                  pending → dealer approves ──┤  DECLINED
                                              ▼
                                         PlayerShell
```

### Where it breaks

| Stage | Failure | Why it happens | Guard |
| --- | --- | --- | --- |
| QR target | Scanned URL is unreachable from the phone | Links were built from the **sync** URL (`VITE_SYNC_URL`), which can be `localhost`, a loopback address or a private API host. | `tableUrl()` now builds from the **page origin** — [urls.ts](apps/web/src/sync/urls.ts), [urls.test.ts](apps/web/src/sync/urls.test.ts) |
| QR target | Dealer's **Show QR** had no Join entry — guests scanned Display (read-only) or Dealer (full control) | `buildQrDialogEntries` supported a Join entry; `DealerShell` never passed `playerModeOn`/`joinUrl`. | [DealerShell.qr.test.tsx](apps/web/src/shells/DealerShell.qr.test.tsx) |
| QR target | Solo QR scanned from a phone never connects | Solo is one browser over `BroadcastChannel`, so a scanned code could only ever time out on the phone that scanned it. The QR is gone; the page offers a same-device link and points phones at Create Table. | [SoloPage.tsx](apps/web/src/pages/SoloPage.tsx), [join-timeout.spec.ts](e2e/join-timeout.spec.ts) |
| Socket | Player enters a blank page | `initialPlatformState()` returned `settings: {} as TableSettings`. A shell rendering before `TABLE_CREATED` arrives — the #94 "enter after timeout" path — threw on `settings.bank`, leaving `<main>` holding nothing but the timeout banner. | [platform-state.ts](packages/core/src/platform-state.ts), [PlayerShell.connecting.test.tsx](apps/web/src/shells/PlayerShell.connecting.test.tsx) |
| Socket | Player told the dealer has not approved them | `playerPending = !player \|\| …` could not tell "not in the log yet" from "awaiting approval". | [PlayerShell.tsx](apps/web/src/shells/PlayerShell.tsx) |
| Page load | `/play/:code` 404s | SPA deep links depend on the server's not-found handler. | [server.ts](apps/sync/src/server.ts); covered by every e2e that opens a join URL cold |
| Lookup | Code is gone | Tables expire (`TABLE_TTL_HOURS`, default 6) and `PERSIST=memory` loses them on restart. | `NOT_FOUND` copy |
| Lookup | Wrong error shown | Socket reject reasons were relabelled `TABLE_LOOKUP_FAILED`, sending people to chase a network fault. | [PlayPage.tsx](apps/web/src/pages/PlayPage.tsx), PlayPage test *"surfaces the socket's own reason"* |
| Colour | Two guests pick the same colour | `takenColors` is a snapshot from lookup and is not refreshed; the server does not reject duplicates. | e2e *"a second guest cannot take a colour that is already in use"* — **still a race between two simultaneous joins** |
| Join | A room of guests gets `429` | Everyone shares one NAT IP, so one `join:<ip>` bucket. The old limit (10/min) was below the table's own capacity (20, hard cap 50). | [rate-limit.ts](apps/sync/src/rate-limit.ts), *"lets a full table's worth of guests join from one shared IP"* |
| Socket | Phone stalls on the websocket | Carrier NAT / proxies; the client falls back to polling and enters the table after 8s with a banner. | PlayPage test *"enters the table when HTTP join succeeds but the socket times out"* |
| Approval | Player waits forever | Only a connected dealer can admit; pending players are re-sent in the dealer's `joined` payload. | [player-onboarding.test.ts](apps/sync/src/routes/player-onboarding.test.ts) |

---

## 3. Coverage

| Flow | Unit | E2E |
| --- | --- | --- |
| P1 created-screen Join QR | `TableCreatedPage.test.tsx` | `onboarding.spec.ts` — scans the QR and joins |
| P2 TV join badge | `QrBadge.test.tsx`, `DisplayShell.test.tsx` | `onboarding.spec.ts` — badge content + hidden when joining closes |
| P3 dealer Show QR | `DealerShell.qr.test.tsx` | `onboarding.spec.ts` — scans the dialog's Join QR and joins |
| P4 join by code | `LandingPage.test.tsx` | `onboarding.spec.ts` |
| P5 reissue link | `PlayersDialog.test.tsx` | `onboarding.spec.ts` — fresh device, no name form, token stripped |
| P6 returning player | `PlayPage.test.tsx` | `onboarding.spec.ts` — reload |
| Approval / decline | `PlayPage.test.tsx` | `player-onboarding.test.ts` (server) |
| Refusals with copy | `PlayPage.test.tsx`, `error-copy.test.ts` | `onboarding.spec.ts` — dealer-only, unknown code, joining closed |
| D1–D3 dealer entry | `TableCreatedPage.test.tsx`, `LandingPage.test.tsx`, `dealer-token.test.ts` | `onboarding.spec.ts` — dealer QR opens the dealer shell |
| V1–V2 display entry | `DisplayShell.test.tsx` | `onboarding.spec.ts` |
| Gameplay after onboarding | per-game shell tests | `sync-*-players.spec.ts`, `sync-virtual-*.spec.ts` |
| Timeouts and dead sockets | `PlayerShell.connecting.test.tsx` | `join-timeout.spec.ts` — solo link, dead socket for player and dealer |

### Still uncovered

- **D4 dealer takeover** (`DEALER_ACTIVE` → "Take over") has copy and server handling but no end-to-end test.
- **Simultaneous colour pick** — two guests choosing the same colour in the same instant both succeed.
- **PWA / service-worker staleness** on a phone that has the app cached from an older deploy.
- **Session-ended mid-play** for a connected player.
- **`PUBLIC_URL`** is parsed by the sync config and read by nothing. Either wire it as an override for `appBaseUrl` or drop it.

---

## 4. Running it

```bash
pnpm test                                   # unit (Node 22 — see below)
pnpm e2e                                    # full Playwright suite
npx playwright test --config e2e/playwright.config.ts e2e/onboarding.spec.ts
```

The e2e server runs with `TABLE_CREATE_LIMIT=1000`. The suite creates tables far
faster than a venue does and every page shares `127.0.0.1`, so the production
guard (5/min) otherwise throttles it into minutes of retry sleep.

`onboarding.spec.ts` decodes each rendered QR (`pngjs` + `jsqr`) and navigates to what it
decoded, so a QR pointed at the wrong host fails the test rather than passing on an
assumption about the URL.

> Use Node 22 (`.nvmrc`). On Node 26 the built-in `localStorage` global shadows jsdom's,
> and the DOM-storage tests (`dealer-token.test.ts`, `LandingPage.test.tsx`) fail locally
> for reasons that have nothing to do with the code under test.
