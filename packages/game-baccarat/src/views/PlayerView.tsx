import type { BettingRound, PlayerState } from "@casino-lord/core";
import { FeltZones, PlayingCard, usePlayerBetting, type FeltZoneDef } from "@casino-lord/ui";
import type { BaccaratBetId } from "../bet-target.js";
import type { BaccaratRules } from "../rules.js";
import type { BaccaratState } from "../state.js";
import type { BaccaratResult } from "../types.js";
import { BANKER_SLOTS, formatCardList, outcomeDisplayLabel, PLAYER_SLOTS } from "./card-display.js";
import { MiniBigRoad } from "./MiniBigRoad.js";
import "./player-view.css";

export interface PlayerViewProps {
  state: BaccaratState;
  rules: BaccaratRules;
  me: PlayerState;
  round: BettingRound;
  place: (bet: {
    playerId: string;
    roundId: string;
    type: string;
    amount: number;
    declared: boolean;
    working: boolean;
    originRoundId: string;
  }) => void;
  remove: (betId: string) => void;
  act: (action: never) => void;
}

function formatPayout(betId: BaccaratBetId, rules: BaccaratRules): string {
  switch (betId) {
    case "player":
      return "1:1";
    case "banker":
      if (rules.bankerCommission === 0) {
        return "1:2 on 6";
      }
      return `1:1 −${Math.round(rules.bankerCommission * 100)}%`;
    case "tie":
      return `${rules.tiePayout}:1`;
    case "player_pair":
    case "banker_pair":
      return `${rules.pairPayout}:1`;
  }
}

function lastResult(state: BaccaratState): BaccaratResult | null {
  const last = state.results[state.results.length - 1];
  return last?.data ?? null;
}

function formatLastHand(result: BaccaratResult): string {
  const hasCards = result.cards !== null && Object.keys(result.cards).length > 0;
  const hasPlayerTotal = result.playerTotal !== null;
  const hasBankerTotal = result.bankerTotal !== null;

  if (!hasCards && !hasPlayerTotal && !hasBankerTotal) {
    return `Last hand: ${outcomeDisplayLabel(result.outcome)}`;
  }

  const parts: string[] = [];
  if (hasPlayerTotal || hasCards) {
    const pCards = hasCards ? formatCardList(result.cards!, PLAYER_SLOTS) : "";
    const pPart = pCards
      ? `P ${pCards} =${result.playerTotal}`
      : hasPlayerTotal
        ? `P =${result.playerTotal}`
        : "";
    if (pPart) parts.push(pPart);
  }
  if (hasBankerTotal || hasCards) {
    const bCards = hasCards ? formatCardList(result.cards!, BANKER_SLOTS) : "";
    const bPart = bCards
      ? `B ${bCards} =${result.bankerTotal}`
      : hasBankerTotal
        ? `B =${result.bankerTotal}`
        : "";
    if (bPart) parts.push(bPart);
  }

  if (parts.length === 0) {
    return `Last hand: ${outcomeDisplayLabel(result.outcome)}`;
  }

  return `Last hand: ${parts.join(" · ")}`;
}

export function PlayerView({ state, rules }: PlayerViewProps) {
  const { onZoneTap, onZoneLongPress } = usePlayerBetting();

  const zones: FeltZoneDef[] = [
    {
      id: "player_pair",
      label: "P PAIR",
      sublabel: formatPayout("player_pair", rules),
      color: "#64748b",
      target: "player_pair",
      className: "felt-zones__zone--side",
    },
    {
      id: "banker_pair",
      label: "B PAIR",
      sublabel: formatPayout("banker_pair", rules),
      color: "#64748b",
      target: "banker_pair",
      className: "felt-zones__zone--side",
    },
    {
      id: "player",
      label: "PLAYER",
      sublabel: formatPayout("player", rules),
      color: "#2563eb",
      target: "player",
      className: "felt-zones__zone--player",
    },
    {
      id: "tie",
      label: "TIE",
      sublabel: formatPayout("tie", rules),
      color: "#16a34a",
      target: "tie",
      className: "felt-zones__zone--tie",
    },
    {
      id: "banker",
      label: "BANKER",
      sublabel: formatPayout("banker", rules),
      color: "#e5322d",
      target: "banker",
      className: "felt-zones__zone--banker",
    },
  ];

  const result = lastResult(state);

  return (
    <div class="baccarat-player-view" data-testid="baccarat-player-view">
      <FeltZones
        layout="baccarat"
        zones={zones}
        onTap={(zone) => onZoneTap(String(zone.target))}
        onLongPress={(zone) => onZoneLongPress(String(zone.target))}
      />
      <div class="baccarat-player-view__road-wrap">
        <div class="baccarat-player-view__road-label">Mini big road</div>
        <MiniBigRoad grid={state.roads.bigRoad} visibleCols={8} />
      </div>
      {result && (
        <div class="baccarat-player-view__last-hand" data-testid="last-hand-line">
          {result.cards && (
            <div class="baccarat-player-view__last-cards" aria-hidden="true">
              {PLAYER_SLOTS.map((slot) => result.cards?.[slot]).map((card, i) =>
                card ? (
                  <PlayingCard key={`p-${i}`} rank={card.rank} suit={card.suit} size="sm" />
                ) : null,
              )}
              {BANKER_SLOTS.map((slot) => result.cards?.[slot]).map((card, i) =>
                card ? (
                  <PlayingCard key={`b-${i}`} rank={card.rank} suit={card.suit} size="sm" />
                ) : null,
              )}
            </div>
          )}
          <p>
            {formatLastHand(result)}
            {result.outcome && hasDetailedHand(result)
              ? ` · ${outcomeDisplayLabel(result.outcome)}`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function hasDetailedHand(result: BaccaratResult): boolean {
  return (
    (result.cards !== null && Object.keys(result.cards).length > 0) ||
    result.playerTotal !== null ||
    result.bankerTotal !== null
  );
}
