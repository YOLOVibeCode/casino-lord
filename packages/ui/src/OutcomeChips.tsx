import type { OutcomeChipDef } from "./types.js";
import { useLongPress } from "./use-long-press.js";
import "./outcome-chips.css";

export interface OutcomeChipsProps {
  chips: OutcomeChipDef[];
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
}

function OutcomeChipButton({
  chip,
  onTap,
  onLongPress,
}: {
  chip: OutcomeChipDef;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  const press = useLongPress({
    onTap: () => onTap(chip.id),
    onLongPress: () => onLongPress(chip.id),
  });

  return (
    <button
      type="button"
      class="outcome-chips__chip"
      style={{ background: chip.color }}
      aria-label={chip.ariaLabel}
      data-testid={`outcome-chip-${chip.id}`}
      onMouseDown={press.startPress}
      onMouseUp={press.endPress}
      onMouseLeave={press.cancelPress}
      onTouchStart={press.startPress}
      onTouchEnd={press.endPress}
      onTouchCancel={press.cancelPress}
      onKeyDown={(e) => press.handleKeyDown(e as unknown as KeyboardEvent)}
    >
      {chip.label}
    </button>
  );
}

export function OutcomeChips({ chips, onTap, onLongPress }: OutcomeChipsProps) {
  return (
    <div class="outcome-chips" data-testid="outcome-chips">
      {chips.map((chip) => (
        <OutcomeChipButton key={chip.id} chip={chip} onTap={onTap} onLongPress={onLongPress} />
      ))}
    </div>
  );
}
