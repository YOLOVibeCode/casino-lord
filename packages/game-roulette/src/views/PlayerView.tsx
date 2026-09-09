import type { BettingRound, PlacedBet, PlayerState } from "@casino-lord/core";
import {
  FeltZones,
  PlayerBettingContext,
  usePlayerBetting,
  type FeltZoneDef,
  type PlayerBettingContextValue,
} from "@casino-lord/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RouletteBetTarget } from "../bet-target.js";
import type { RouletteRules } from "../rules.js";
import { isEuropeanLayout } from "../rules.js";
import type { RouletteState } from "../state.js";
import type { Pocket } from "../types.js";
import { wheelOrder } from "../wheel.js";
import { formatPocket, pocketColorClass } from "./colors.js";
import {
  betPayloadFromZone,
  formatZonePayout,
  hitZoneStyle,
  insideHitZones,
  isZoneAllowed,
  labelForTarget,
  numberGridPosition,
  portraitNumberLines,
  zoneIdForTarget,
  type BetPayloadContext,
} from "./felt-bet.js";
import "./player-view.css";

export interface PlayerViewProps {
  state: RouletteState;
  rules: RouletteRules;
  me: PlayerState;
  round: BettingRound;
  place: (bet: Omit<PlacedBet<RouletteBetTarget>, "id" | "placedAt">) => void;
  remove: (betId: string) => void;
  act: (action: never) => void;
}

interface BetSnapshot {
  type: string;
  target?: RouletteBetTarget;
  amount: number;
}

function historySlice(state: RouletteState) {
  const history = Array.isArray(state.history) ? state.history : [];
  return [...history].slice(-10).reverse();
}

function renderHistoryChip(pocket: Pocket | null, rules: RouletteRules, key: string) {
  if (pocket === null) {
    return (
      <div key={key} class="roulette-player-view__chip roulette-player-view__chip--void">
        —
      </div>
    );
  }
  const color = pocketColorClass(pocket, rules);
  return (
    <div
      key={key}
      class={`roulette-player-view__chip roulette-player-view__chip--${color}`}
      data-testid={`player-history-${formatPocket(pocket)}`}
    >
      {formatPocket(pocket)}
    </div>
  );
}

function HotColdPanel({
  title,
  pockets,
  counts,
}: {
  title: string;
  pockets: Pocket[];
  counts: Record<string, number>;
}) {
  return (
    <div class="roulette-player-view__hotcold-panel">
      <div class="roulette-player-view__hotcold-title">{title}</div>
      {pockets.slice(0, 5).map((p) => (
        <div key={String(p)} class="roulette-player-view__hotcold-row">
          <span>{formatPocket(p)}</span>
          <span>×{counts[String(p === "00" ? "00" : p)] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function InsideHitLayer({
  rules,
  me,
  round,
  place,
  remove,
  setMagnifierLabel,
}: {
  rules: RouletteRules;
  me: PlayerState;
  round: BettingRound;
  place: PlayerViewProps["place"];
  remove: PlayerViewProps["remove"];
  setMagnifierLabel: (label: string | null) => void;
}) {
  const parentCtx = usePlayerBetting();
  const zones = insideHitZones(rules);

  const getStake = (zoneId: string) =>
    (me.openBets as PlacedBet<RouletteBetTarget>[])
      .filter((b) => {
        const t = b.target ?? ({ kind: b.type } as RouletteBetTarget);
        return zoneIdForTarget(b.type as RouletteBetTarget["kind"], t) === zoneId;
      })
      .reduce((s, b) => s + b.amount, 0);

  const tryPlace = (zoneId: string) => {
    if (round.status !== "open") return;
    const ctx: BetPayloadContext = {
      playerId: me.player.id,
      roundId: round.id,
      amount: parentCtx.selectedDenomination,
      declared: true,
      originRoundId: round.id,
    };
    const payload = betPayloadFromZone(zoneId, ctx, rules);
    if (payload) place(payload);
  };

  const tryRemove = (zoneId: string) => {
    const match = (me.openBets as PlacedBet<RouletteBetTarget>[]).find((b) => {
      const t = b.target ?? ({ kind: b.type } as RouletteBetTarget);
      return zoneIdForTarget(b.type as RouletteBetTarget["kind"], t) === zoneId;
    });
    if (match) remove(match.id);
  };

  return (
    <div class="player-felt__hits" data-testid="inside-hit-layer">
      {zones.map((zone) => {
        const allowed = isZoneAllowed(zone.zoneId, rules);
        const style = hitZoneStyle(zone.target, rules);
        const stake = getStake(zone.zoneId);
        return (
          <button
            key={zone.zoneId}
            type="button"
            class={`player-felt__hit${allowed !== true ? " player-felt__hit--disabled" : ""}`}
            data-testid={`felt-hit-${zone.zoneId}`}
            title={allowed !== true ? allowed : zone.label}
            aria-label={allowed !== true ? allowed : zone.label}
            aria-disabled={allowed !== true}
            style={{
              left: style.left,
              top: style.top,
              width: style.width,
              height: style.height,
              transform: "translate(-50%, -50%)",
            }}
            onMouseDown={() => {
              if (allowed === true) setMagnifierLabel(zone.label);
            }}
            onTouchStart={() => {
              if (allowed === true) setMagnifierLabel(zone.label);
            }}
            onMouseUp={() => setMagnifierLabel(null)}
            onMouseLeave={() => setMagnifierLabel(null)}
            onTouchEnd={() => setMagnifierLabel(null)}
            onTouchCancel={() => setMagnifierLabel(null)}
            onClick={(e) => {
              if (allowed !== true) return;
              e.preventDefault();
              tryPlace(zone.zoneId);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (allowed === true) tryRemove(zone.zoneId);
            }}
          >
            {stake > 0 && <span class="player-felt__hit-stake">⛁ {stake}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RacetrackPanel({
  rules,
  onSector,
  onNeighbour,
}: {
  rules: RouletteRules;
  onSector: (kind: "voisins" | "tiers" | "orphelins" | "jeu_zero") => void;
  onNeighbour: (pocket: Pocket) => void;
}) {
  const order = wheelOrder(rules);
  return (
    <div class="player-felt__racetrack" data-testid="racetrack">
      <div class="player-felt__racetrack-sectors">
        {(
          [
            ["voisins", "Voisins"],
            ["tiers", "Tiers"],
            ["orphelins", "Orphelins"],
            ["jeu_zero", "Zéro"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            class="player-felt__sector-btn"
            data-testid={`racetrack-${kind}`}
            onClick={() => onSector(kind)}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="player-felt__racetrack-numbers">
        {order.map((p) => (
          <button
            key={String(p)}
            type="button"
            class={`player-felt__track-num player-felt__track-num--${pocketColorClass(p, rules)}`}
            data-testid={`racetrack-pocket-${formatPocket(p)}`}
            onClick={() => onNeighbour(p)}
          >
            {formatPocket(p)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlayerView({ state, rules, me, round, place, remove }: PlayerViewProps) {
  const parentCtx = usePlayerBetting();
  const [showRacetrack, setShowRacetrack] = useState(false);
  const [magnifierLabel, setMagnifierLabel] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<BetSnapshot[]>([]);
  const prevRoundStatusRef = useRef(round.status);
  const betsDuringRoundRef = useRef<BetSnapshot[]>([]);

  useEffect(() => {
    if (round.status === "open") {
      betsDuringRoundRef.current = (me.openBets as PlacedBet<RouletteBetTarget>[]).map((b) => ({
        type: b.type,
        ...(b.target !== undefined ? { target: b.target } : {}),
        amount: b.amount,
      }));
    }
    if (prevRoundStatusRef.current === "open" && round.status !== "open") {
      setLastSnapshot([...betsDuringRoundRef.current]);
    }
    prevRoundStatusRef.current = round.status;
  }, [round.status, me.openBets]);

  const lines = portraitNumberLines();
  const american = rules.wheel === "american";
  const showCallBets = isEuropeanLayout(rules) && rules.allowCallBets;

  const outsideZones: FeltZoneDef[] = useMemo(
    () =>
      (["red", "black", "odd", "even", "low", "high"] as const).map((kind) => ({
        id: kind,
        label: labelForTarget(kind, { kind }),
        sublabel: formatZonePayout(kind, rules),
        color:
          kind === "red"
            ? "#d7263d"
            : kind === "black"
              ? "#111318"
              : kind === "even"
                ? "#2563eb"
                : "#64748b",
        target: kind,
        className: "player-felt__outside",
      })),
    [rules],
  );

  const getOwnStakeByZone = useCallback(
    (zoneId: string) => {
      return (me.openBets as PlacedBet<RouletteBetTarget>[])
        .filter((b) => {
          if (["red", "black", "odd", "even", "low", "high"].includes(zoneId)) {
            return b.type === zoneId;
          }
          const t = b.target ?? ({ kind: b.type } as RouletteBetTarget);
          return zoneIdForTarget(b.type as RouletteBetTarget["kind"], t) === zoneId;
        })
        .reduce((s, b) => s + b.amount, 0);
    },
    [me.openBets],
  );

  const nestedCtx: PlayerBettingContextValue = useMemo(
    () => ({
      ...parentCtx,
      getOwnStake: getOwnStakeByZone,
      getTableStake: (zoneId) => {
        if (["red", "black", "odd", "even", "low", "high"].includes(zoneId)) {
          return parentCtx.getTableStake(zoneId);
        }
        return 0;
      },
      onZoneTap: (betType: string) => {
        if (round.status !== "open") return;
        if (["red", "black", "odd", "even", "low", "high"].includes(betType)) {
          parentCtx.onZoneTap(betType);
          return;
        }
        const ctx: BetPayloadContext = {
          playerId: me.player.id,
          roundId: round.id,
          amount: parentCtx.selectedDenomination,
          declared: true,
          originRoundId: round.id,
        };
        const payload = betPayloadFromZone(betType, ctx, rules);
        if (payload) place(payload);
      },
      onZoneLongPress: (betType: string) => {
        const match = (me.openBets as PlacedBet<RouletteBetTarget>[]).find((b) => {
          if (["red", "black", "odd", "even", "low", "high"].includes(betType)) {
            return b.type === betType;
          }
          const t = b.target ?? ({ kind: b.type } as RouletteBetTarget);
          return zoneIdForTarget(b.type as RouletteBetTarget["kind"], t) === betType;
        });
        if (match) {
          remove(match.id);
          return;
        }
        parentCtx.onZoneLongPress(betType);
      },
    }),
    [parentCtx, getOwnStakeByZone, round, me, rules, place, remove],
  );

  const placeZone = (zoneId: string) => {
    if (round.status !== "open") return;
    const allowed = isZoneAllowed(zoneId, rules);
    if (allowed !== true) return;
    const ctx: BetPayloadContext = {
      playerId: me.player.id,
      roundId: round.id,
      amount: parentCtx.selectedDenomination,
      declared: true,
      originRoundId: round.id,
    };
    const payload = betPayloadFromZone(zoneId, ctx, rules);
    if (payload) place(payload);
  };

  const handleRepeatLast = () => {
    if (round.status !== "open" || lastSnapshot.length === 0) return;
    let spent = 0;
    for (const snap of lastSnapshot) {
      if (spent + snap.amount > me.bankroll) break;
      place({
        playerId: me.player.id,
        roundId: round.id,
        type: snap.type,
        ...(snap.target !== undefined ? { target: snap.target } : {}),
        amount: snap.amount,
        declared: true,
        working: false,
        originRoundId: round.id,
      });
      spent += snap.amount;
    }
  };

  const history = historySlice(state);

  const dozenZones: FeltZoneDef[] = ([1, 2, 3] as const).map((n) => {
    const target: RouletteBetTarget = { kind: "dozen", n };
    const zoneId = zoneIdForTarget("dozen", target);
    return {
      id: zoneId,
      label: labelForTarget("dozen", target),
      sublabel: formatZonePayout("dozen", rules),
      color: "#64748b",
      target,
      className: "player-felt__dozen",
    };
  });

  return (
    <PlayerBettingContext.Provider value={nestedCtx}>
      <div class="roulette-player-view" data-testid="roulette-player-view">
        {magnifierLabel && (
          <div class="player-felt__magnifier" data-testid="felt-magnifier" role="status">
            {magnifierLabel}
          </div>
        )}
        <div class="roulette-player-view__body">
          <aside class="roulette-player-view__sidebar">
            <div class="roulette-player-view__history-col" data-testid="player-history">
              <div class="roulette-player-view__section-label">LAST</div>
              {history.map((spin, i) =>
                renderHistoryChip(spin.pocket, rules, `${String(spin.pocket)}-${i}`),
              )}
            </div>
            <HotColdPanel
              title="HOT"
              pockets={Array.isArray(state.hot) ? state.hot : []}
              counts={state.counts ?? {}}
            />
            <HotColdPanel
              title="COLD"
              pockets={Array.isArray(state.cold) ? state.cold : []}
              counts={state.counts ?? {}}
            />
          </aside>

          <div class="roulette-player-view__main">
            <div class="player-felt">
              <div class="player-felt__grid-wrap">
                <div class="player-felt__grid" data-testid="player-felt-grid">
                  <div class="player-felt__zero-col">
                    <div
                      class="player-felt__number player-felt__number--green player-felt__zero"
                      data-testid="player-felt-number-0"
                    >
                      0
                    </div>
                    {american && (
                      <div
                        class="player-felt__number player-felt__number--green player-felt__zero"
                        data-testid="player-felt-number-00"
                      >
                        00
                      </div>
                    )}
                  </div>

                  {lines.map((line, lineIdx) =>
                    line.map((n) => {
                      const pos = numberGridPosition(n);
                      return (
                        <div
                          key={n}
                          class={`player-felt__number player-felt__number--${pocketColorClass(n, rules)}`}
                          data-testid={`player-felt-number-${n}`}
                          style={{
                            gridRow: lineIdx + 1,
                            gridColumn: pos.gridCol,
                            minWidth: "48px",
                            minHeight: "48px",
                          }}
                        >
                          {n}
                        </div>
                      );
                    }),
                  )}

                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={`col-${n}`}
                      type="button"
                      class="player-felt__number player-felt__column-btn"
                      data-testid={`felt-zone-${zoneIdForTarget("column", { kind: "column", n })}`}
                      style={{ gridColumn: 14, gridRow: n }}
                      onClick={() => placeZone(zoneIdForTarget("column", { kind: "column", n }))}
                    >
                      2:1
                    </button>
                  ))}
                </div>

                <InsideHitLayer
                  rules={rules}
                  me={me}
                  round={round}
                  place={place}
                  remove={remove}
                  setMagnifierLabel={setMagnifierLabel}
                />
              </div>

              <div class="player-felt__dozens">
                <FeltZones
                  zones={dozenZones}
                  onTap={(z) => nestedCtx.onZoneTap(z.id)}
                  onLongPress={(z) => nestedCtx.onZoneLongPress(z.id)}
                />
              </div>

              <div class="player-felt__outsides">
                <FeltZones
                  zones={outsideZones}
                  onTap={(z) => nestedCtx.onZoneTap(z.id)}
                  onLongPress={(z) => nestedCtx.onZoneLongPress(z.id)}
                />
              </div>

              <div class="player-felt__actions">
                <button
                  type="button"
                  class="player-felt__repeat"
                  data-testid="repeat-last"
                  disabled={round.status !== "open" || lastSnapshot.length === 0}
                  onClick={handleRepeatLast}
                >
                  Repeat last
                </button>
                {showCallBets && (
                  <button
                    type="button"
                    class="player-felt__racetrack-toggle"
                    data-testid="racetrack-toggle"
                    onClick={() => setShowRacetrack((v) => !v)}
                  >
                    {showRacetrack ? "Hide racetrack" : "Racetrack"}
                  </button>
                )}
              </div>

              {showCallBets && showRacetrack && (
                <RacetrackPanel
                  rules={rules}
                  onSector={(kind) => placeZone(kind)}
                  onNeighbour={(pocket) =>
                    placeZone(zoneIdForTarget("neighbours", { kind: "neighbours", pocket }))
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </PlayerBettingContext.Provider>
  );
}
