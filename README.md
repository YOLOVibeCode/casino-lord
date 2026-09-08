# Casino Lord

Multi-game electronic casino table system: a dealer phone records (or virtually deals) results, a TV shows the live scoreboard, and — optionally — a room full of people join from their phones to bet with play chips.

Games: Baccarat · Roulette · Craps · Blackjack.

## Status

Specification phase. No code yet.

## Specifications

| Document | Scope |
|---|---|
| [`SPEC.md`](SPEC.md) | Platform: tables, Dealer / Display / Player roles, participation modes, banks and betting rounds, virtual outcomes with commit–reveal fairness, sync protocol, game-module contract, deployment. |
| [`SPEC-BACCARAT.md`](SPEC-BACCARAT.md) | Six-slot card entry, Punto Banco engine, roads (bead plate, big road, big eye boy, small road, cockroach pig), bets, virtual shoe. |
| [`SPEC-ROULETTE.md`](SPEC-ROULETTE.md) | Number entry, results board, wheel, hot/cold and property stats, full inside/outside/call bet felt, virtual spin. |
| [`SPEC-CRAPS.md`](SPEC-CRAPS.md) | Dice entry, pass-line state machine, puck and point boxes, shooter stats, working bets, shooter-rolls-from-phone. |
| [`SPEC-BLACKJACK.md`](SPEC-BLACKJACK.md) | Multi-seat card entry, hand engine, dealer play validation, player seats and actions, virtual shoe. |

Play chips only — no real money, ever.
