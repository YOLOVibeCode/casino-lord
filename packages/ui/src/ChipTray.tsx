import "./chip-tray.css";

const CHIP_COLORS = ["#e5322d", "#16a34a", "#1a1a1a", "#7c3aed", "#ca8a04"];

export interface ChipTrayProps {
  denominations: number[];
  selected: number;
  onSelect: (denomination: number) => void;
  onClear: () => void;
  showSelectedLabel?: boolean;
  disabled?: boolean;
}

export function ChipTray({
  denominations,
  selected,
  onSelect,
  onClear,
  showSelectedLabel = true,
  disabled = false,
}: ChipTrayProps) {
  return (
    <div
      class={`chip-tray${disabled ? " chip-tray--disabled" : ""}`}
      data-testid="chip-tray"
      aria-disabled={disabled ? "true" : undefined}
    >
      {showSelectedLabel && (
        <span class="chip-tray__selected" data-testid="chip-tray-selected">
          Selected chip: {selected}
        </span>
      )}
      {denominations.map((denom, i) => (
        <button
          key={denom}
          type="button"
          class={`chip-tray__denom${selected === denom ? " chip-tray__denom--selected" : ""}`}
          style={{ background: CHIP_COLORS[i % CHIP_COLORS.length] }}
          aria-label={`Select ${denom} chip`}
          aria-pressed={selected === denom}
          aria-disabled={disabled ? "true" : undefined}
          disabled={disabled}
          data-testid={`chip-denom-${denom}`}
          onClick={() => onSelect(denom)}
        >
          {denom}
        </button>
      ))}
      <button
        type="button"
        class="chip-tray__clear"
        data-testid="chip-tray-clear"
        aria-label="Clear pending bets"
        aria-disabled={disabled ? "true" : undefined}
        disabled={disabled}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}
