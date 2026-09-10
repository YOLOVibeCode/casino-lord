import { usePlayerBetting } from "./player-betting-context.js";
import type { FeltZoneDef } from "./felt-zone-types.js";
import { useLongPress } from "./use-long-press.js";
import "./felt-zones.css";

export interface FeltZonesProps {
  zones: FeltZoneDef[];
  layout?: "default" | "baccarat";
  disabled?: boolean;
  onTap: (zone: FeltZoneDef) => void;
  onLongPress: (zone: FeltZoneDef) => void;
}

function FeltZoneButton({
  zone,
  disabled,
  onTap,
  onLongPress,
}: {
  zone: FeltZoneDef;
  disabled: boolean;
  onTap: (zone: FeltZoneDef) => void;
  onLongPress: (zone: FeltZoneDef) => void;
}) {
  const {
    showOthersBets,
    playerColor,
    getOwnStake,
    getTableStake,
    settlementFlash,
    settlementByZone,
  } = usePlayerBetting();
  const ownStake = getOwnStake(zone.id);
  const tableStake = getTableStake(zone.id);
  const chipCount = Math.min(5, Math.ceil(ownStake / 25) || (ownStake > 0 ? 1 : 0));

  const press = useLongPress({
    onTap: () => {
      if (!disabled) onTap(zone);
    },
    onLongPress: () => {
      if (!disabled) onLongPress(zone);
    },
  });

  const zoneOutcome = settlementByZone[zone.id];
  const flashClass =
    zoneOutcome === "win" || settlementFlash === "win"
      ? " felt-zones__zone--flash-win"
      : zoneOutcome === "lose" || settlementFlash === "lose"
        ? " felt-zones__zone--flash-lose"
        : "";

  const ownClass = ownStake > 0 && disabled ? " felt-zones__zone--own" : "";
  const disabledClass = disabled ? " felt-zones__zone--disabled" : "";

  const ariaLabel = `${zone.label}, stake ${ownStake}${showOthersBets && tableStake > ownStake ? `, table total ${tableStake}` : ""}${zoneOutcome ? `, ${zoneOutcome}` : ""}${disabled ? ", bets closed" : ""}`;

  return (
    <button
      type="button"
      class={`felt-zones__zone${zone.className ? ` ${zone.className}` : ""}${flashClass}${ownClass}${disabledClass}`}
      style={{ borderColor: zone.color, "--player-color": playerColor } as Record<string, string>}
      aria-label={ariaLabel}
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      data-testid={`felt-zone-${zone.id}`}
      onMouseDown={disabled ? undefined : press.startPress}
      onMouseUp={disabled ? undefined : press.endPress}
      onMouseLeave={disabled ? undefined : press.cancelPress}
      onTouchStart={disabled ? undefined : press.startPress}
      onTouchEnd={disabled ? undefined : press.endPress}
      onTouchCancel={disabled ? undefined : press.cancelPress}
      onKeyDown={disabled ? undefined : (e) => press.handleKeyDown(e as unknown as KeyboardEvent)}
    >
      {ownStake > 0 && disabled && (
        <span class="felt-zones__you" data-testid={`felt-zone-you-${zone.id}`} aria-hidden="true">
          you
        </span>
      )}
      {zoneOutcome && (
        <span
          class={`felt-zones__badge felt-zones__badge--${zoneOutcome}`}
          data-testid={`felt-zone-badge-${zone.id}`}
          aria-hidden="true"
        >
          {zoneOutcome === "win" ? "WIN" : "LOSE"}
        </span>
      )}
      <span class="felt-zones__label">{zone.label}</span>
      {zone.sublabel && <span class="felt-zones__sublabel">{zone.sublabel}</span>}
      {ownStake > 0 && (
        <>
          <span class="felt-zones__stake" data-testid={`felt-zone-stake-${zone.id}`}>
            ⛁ {ownStake}
          </span>
          {chipCount > 0 && (
            <div class="felt-zones__chips" aria-hidden="true">
              {Array.from({ length: chipCount }, (_, i) => (
                <span key={i} class="felt-zones__chip" />
              ))}
            </div>
          )}
        </>
      )}
      {showOthersBets && tableStake > 0 && (
        <span class="felt-zones__table-stake" data-testid={`felt-zone-table-${zone.id}`}>
          Table: {tableStake}
        </span>
      )}
    </button>
  );
}

export function FeltZones({
  zones,
  layout = "default",
  disabled: disabledProp,
  onTap,
  onLongPress,
}: FeltZonesProps) {
  const { bettingDisabled } = usePlayerBetting();
  const disabled = disabledProp ?? bettingDisabled;

  if (layout === "baccarat") {
    const sideZones = zones.filter((z) => z.id.includes("pair"));
    const mainZones = zones.filter((z) => !z.id.includes("pair"));
    return (
      <div
        class={`felt-zones felt-zones--baccarat${disabled ? " felt-zones--disabled" : ""}`}
        data-testid="felt-zones"
      >
        <div class="felt-zones__side-row">
          {sideZones.map((zone) => (
            <FeltZoneButton
              key={zone.id}
              zone={zone}
              disabled={disabled}
              onTap={onTap}
              onLongPress={onLongPress}
            />
          ))}
        </div>
        <div class="felt-zones__main-row">
          {mainZones.map((zone) => (
            <FeltZoneButton
              key={zone.id}
              zone={zone}
              disabled={disabled}
              onTap={onTap}
              onLongPress={onLongPress}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div class={`felt-zones${disabled ? " felt-zones--disabled" : ""}`} data-testid="felt-zones">
      {zones.map((zone) => (
        <FeltZoneButton
          key={zone.id}
          zone={zone}
          disabled={disabled}
          onTap={onTap}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
