import "./chip-tray.css";

const CHIP_COLORS = ["#e5322d", "#16a34a", "#1a1a1a", "#7c3aed", "#ca8a04"];

export interface ChipTrayProps {
  denominations: number[];
  selected: number;
  onSelect: (denomination: number) => void;
  onClear: () => void;
}

export function ChipTray({ denominations, selected, onSelect, onClear }: ChipTrayProps) {
  return (
    <div class="chip-tray" data-testid="chip-tray">
      {denominations.map((denom, i) => (
        <button
          key={denom}
          type="button"
          class={`chip-tray__denom${selected === denom ? " chip-tray__denom--selected" : ""}`}
          style={{ background: CHIP_COLORS[i % CHIP_COLORS.length] }}
          aria-label={`Select ${denom} chip`}
          aria-pressed={selected === denom}
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
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}
