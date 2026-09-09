import type { BlackjackRules } from "../rules.js";
import { rulesSchema } from "../schemas.js";
import "./blackjack-tokens.css";
import "./rules-settings-view.css";

export interface RulesSettingsViewProps {
  rules: BlackjackRules;
  onChange: (patch: Partial<BlackjackRules>) => void;
}

function emitChange(
  rules: BlackjackRules,
  onChange: (patch: Partial<BlackjackRules>) => void,
  patch: Partial<BlackjackRules>,
): void {
  const merged = { ...rules, ...patch };
  const parsed = rulesSchema.safeParse(merged);
  if (parsed.success) {
    onChange(patch);
  }
}

function RadioGroup<T extends string | number>({
  name,
  label,
  value,
  options,
  onSelect,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div class="rules-settings__field">
      <span class="rules-settings__label">{label}</span>
      <div class="rules-settings__options">
        {options.map((opt) => (
          <label key={String(opt.value)}>
            <input
              type="radio"
              name={name}
              checked={value === opt.value}
              onChange={() => onSelect(opt.value)}
            />{" "}
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div class="rules-settings__field">
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        />{" "}
        {label}
      </label>
    </div>
  );
}

export function RulesSettingsView({ rules, onChange }: RulesSettingsViewProps) {
  const emit = (patch: Partial<BlackjackRules>) => emitChange(rules, onChange, patch);

  return (
    <div class="blackjack-display rules-settings" data-testid="rules-settings">
      <RadioGroup
        name="decks"
        label="Decks"
        value={rules.decks}
        options={[
          { value: 1, label: "1" },
          { value: 2, label: "2" },
          { value: 4, label: "4" },
          { value: 6, label: "6" },
          { value: 8, label: "8" },
        ]}
        onSelect={(decks) => emit({ decks })}
      />

      <RadioGroup
        name="seats"
        label="Seats"
        value={rules.seats}
        options={[
          { value: 5, label: "5" },
          { value: 6, label: "6" },
          { value: 7, label: "7" },
        ]}
        onSelect={(seats) => emit({ seats })}
      />

      <RadioGroup
        name="entryDepth"
        label="Entry depth"
        value={rules.entryDepth}
        options={[
          { value: "outcomes", label: "Outcomes" },
          { value: "full", label: "Full cards" },
        ]}
        onSelect={(entryDepth) => emit({ entryDepth })}
      />

      <RadioGroup
        name="dealerSoft17"
        label="Dealer soft 17"
        value={rules.dealerSoft17}
        options={[
          { value: "stand", label: "Stand (S17)" },
          { value: "hit", label: "Hit (H17)" },
        ]}
        onSelect={(dealerSoft17) => emit({ dealerSoft17 })}
      />

      <RadioGroup
        name="blackjackPayout"
        label="Blackjack pays"
        value={rules.blackjackPayout}
        options={[
          { value: "3:2", label: "3:2" },
          { value: "6:5", label: "6:5" },
          { value: "2:1", label: "2:1" },
        ]}
        onSelect={(blackjackPayout) => emit({ blackjackPayout })}
      />

      <CheckboxField
        label="Peek for dealer blackjack"
        checked={rules.peek}
        onChange={(peek) => emit({ peek })}
      />
      <CheckboxField
        label="Double after split"
        checked={rules.doubleAfterSplit}
        onChange={(doubleAfterSplit) => emit({ doubleAfterSplit })}
      />

      <RadioGroup
        name="maxSplits"
        label="Max splits"
        value={rules.maxSplits}
        options={[
          { value: 1, label: "1" },
          { value: 2, label: "2" },
          { value: 3, label: "3" },
        ]}
        onSelect={(maxSplits) => emit({ maxSplits })}
      />

      <CheckboxField
        label="Split aces receive one card"
        checked={rules.splitAcesOneCard}
        onChange={(splitAcesOneCard) => emit({ splitAcesOneCard })}
      />
      <CheckboxField
        label="Resplit aces"
        checked={rules.resplitAces}
        onChange={(resplitAces) => emit({ resplitAces })}
      />
      <CheckboxField
        label="Blackjack after split"
        checked={rules.blackjackAfterSplit}
        onChange={(blackjackAfterSplit) => emit({ blackjackAfterSplit })}
      />

      <RadioGroup
        name="surrender"
        label="Surrender"
        value={rules.surrender}
        options={[
          { value: "none", label: "None" },
          { value: "late", label: "Late" },
          { value: "early", label: "Early" },
        ]}
        onSelect={(surrender) => emit({ surrender })}
      />

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="penetration">
          Penetration: {Math.round(rules.penetration * 100)}%
        </label>
        <input
          id="penetration"
          type="range"
          class="rules-settings__range"
          min={50}
          max={90}
          step={5}
          value={Math.round(rules.penetration * 100)}
          onInput={(e) => emit({ penetration: Number((e.target as HTMLInputElement).value) / 100 })}
        />
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="roundHoldMs">
          Round hold: {rules.roundHoldMs} ms
        </label>
        <input
          id="roundHoldMs"
          type="range"
          class="rules-settings__range"
          min={2000}
          max={15000}
          step={1000}
          value={rules.roundHoldMs}
          onInput={(e) => emit({ roundHoldMs: Number((e.target as HTMLInputElement).value) })}
        />
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="streakThreshold">
          Streak threshold: {rules.streakThreshold}
        </label>
        <input
          id="streakThreshold"
          type="range"
          class="rules-settings__range"
          min={3}
          max={10}
          step={1}
          value={rules.streakThreshold}
          onInput={(e) => emit({ streakThreshold: Number((e.target as HTMLInputElement).value) })}
        />
      </div>

      <CheckboxField
        label="Side bets"
        checked={rules.sideBets}
        onChange={(sideBets) => emit({ sideBets })}
      />
      <CheckboxField
        label="Training overlay (solo)"
        checked={rules.trainingOverlay}
        onChange={(trainingOverlay) => emit({ trainingOverlay })}
      />

      <RadioGroup
        name="handsPerPlayer"
        label="Hands per player"
        value={rules.handsPerPlayer}
        options={[
          { value: 1, label: "1" },
          { value: 2, label: "2" },
        ]}
        onSelect={(handsPerPlayer) => emit({ handsPerPlayer })}
      />

      <CheckboxField
        label="Double for less"
        checked={rules.doubleForLess}
        onChange={(doubleForLess) => emit({ doubleForLess })}
      />

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="insuranceTimerSec">
          Insurance timer: {rules.insuranceTimerSec}s
        </label>
        <input
          id="insuranceTimerSec"
          type="range"
          class="rules-settings__range"
          min={5}
          max={30}
          step={1}
          value={rules.insuranceTimerSec}
          onInput={(e) => emit({ insuranceTimerSec: Number((e.target as HTMLInputElement).value) })}
        />
      </div>

      <CheckboxField
        label="Auto-hit on ≤11 at timeout"
        checked={rules.autoHitLow}
        onChange={(autoHitLow) => emit({ autoHitLow })}
      />
    </div>
  );
}
