import { usePlayerBetting } from "./player-betting-context.js";
import type { FeltZoneDef } from "./felt-zone-types.js";
import { useLongPress } from "./use-long-press.js";
import "./felt-zones.css";

export interface FeltZonesProps {
  zones: FeltZoneDef[];
  layout?: "default" | "baccarat";
  onTap: (zone: FeltZoneDef) => void;
  onLongPress: (zone: FeltZoneDef) => void;
}

function FeltZoneButton({
  zone,
  onTap,
  onLongPress,
}: {
  zone: FeltZoneDef;
  onTap: (zone: FeltZoneDef) => void;
  onLongPress: (zone: FeltZoneDef) => void;
}) {
  const { showOthersBets, playerColor, getOwnStake, getTableStake, settlementFlash } =
    usePlayerBetting();
  const ownStake = getOwnStake(zone.id);
  const tableStake = getTableStake(zone.id);
  const chipCount = Math.min(5, Math.ceil(ownStake / 25) || (ownStake > 0 ? 1 : 0));

  const press = useLongPress({
    onTap: () => onTap(zone),
    onLongPress: () => onLongPress(zone),
  });

  const flashClass =
    settlementFlash === "win"
      ? " felt-zones__zone--flash-win"
      : settlementFlash === "lose"
        ? " felt-zones__zone--flash-lose"
        : "";

  const ariaLabel = `${zone.label}, stake ${ownStake}${showOthersBets && tableStake > ownStake ? `, table total ${tableStake}` : ""}`;

  return (
    <button
      type="button"
      class={`felt-zones__zone${zone.className ? ` ${zone.className}` : ""}${flashClass}`}
      style={{ borderColor: zone.color, "--player-color": playerColor } as Record<string, string>}
      aria-label={ariaLabel}
      data-testid={`felt-zone-${zone.id}`}
      onMouseDown={press.startPress}
      onMouseUp={press.endPress}
      onMouseLeave={press.cancelPress}
      onTouchStart={press.startPress}
      onTouchEnd={press.endPress}
      onTouchCancel={press.cancelPress}
      onKeyDown={(e) => press.handleKeyDown(e as unknown as KeyboardEvent)}
    >
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

export function FeltZones({ zones, layout = "default", onTap, onLongPress }: FeltZonesProps) {
  if (layout === "baccarat") {
    const sideZones = zones.filter((z) => z.id.includes("pair"));
    const mainZones = zones.filter((z) => !z.id.includes("pair"));
    return (
      <div class="felt-zones felt-zones--baccarat" data-testid="felt-zones">
        <div class="felt-zones__side-row">
          {sideZones.map((zone) => (
            <FeltZoneButton key={zone.id} zone={zone} onTap={onTap} onLongPress={onLongPress} />
          ))}
        </div>
        <div class="felt-zones__main-row">
          {mainZones.map((zone) => (
            <FeltZoneButton key={zone.id} zone={zone} onTap={onTap} onLongPress={onLongPress} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div class="felt-zones" data-testid="felt-zones">
      {zones.map((zone) => (
        <FeltZoneButton key={zone.id} zone={zone} onTap={onTap} onLongPress={onLongPress} />
      ))}
    </div>
  );
}
