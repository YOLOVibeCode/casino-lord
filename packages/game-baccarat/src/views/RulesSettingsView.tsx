import type { BaccaratRules } from "../rules.js";
import { rulesSchema } from "../schemas.js";
import "./baccarat-tokens.css";
import "./rules-settings-view.css";

export interface RulesSettingsViewProps {
  rules: BaccaratRules;
  onChange: (patch: Partial<BaccaratRules>) => void;
}

function emitChange(
  rules: BaccaratRules,
  onChange: (patch: Partial<BaccaratRules>) => void,
  patch: Partial<BaccaratRules>,
): void {
  const merged = { ...rules, ...patch };
  const parsed = rulesSchema.safeParse(merged);
  if (parsed.success) {
    onChange(patch);
  }
}

export function RulesSettingsView({ rules, onChange }: RulesSettingsViewProps) {
  return (
    <div class="baccarat-display rules-settings" data-testid="rules-settings">
      <div class="rules-settings__field">
        <span class="rules-settings__label">Decks</span>
        <div class="rules-settings__options">
          <label>
            <input
              type="radio"
              name="decks"
              checked={rules.decks === 6}
              onChange={() => emitChange(rules, onChange, { decks: 6 })}
            />{" "}
            6
          </label>
          <label>
            <input
              type="radio"
              name="decks"
              checked={rules.decks === 8}
              onChange={() => emitChange(rules, onChange, { decks: 8 })}
            />{" "}
            8
          </label>
        </div>
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Banker commission</span>
        <div class="rules-settings__options">
          <label>
            <input
              type="radio"
              name="bankerCommission"
              checked={rules.bankerCommission === 0}
              onChange={() => emitChange(rules, onChange, { bankerCommission: 0 })}
            />{" "}
            0 (no commission)
          </label>
          <label>
            <input
              type="radio"
              name="bankerCommission"
              checked={rules.bankerCommission === 0.05}
              onChange={() => emitChange(rules, onChange, { bankerCommission: 0.05 })}
            />{" "}
            5%
          </label>
        </div>
        {rules.bankerCommission === 0 && (
          <p class="rules-settings__note">Banker wins with 6 pay 1:2 (noCommissionBanker6Payout)</p>
        )}
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Tie payout</span>
        <div class="rules-settings__options">
          <label>
            <input
              type="radio"
              name="tiePayout"
              checked={rules.tiePayout === 8}
              onChange={() => emitChange(rules, onChange, { tiePayout: 8 })}
            />{" "}
            8:1
          </label>
          <label>
            <input
              type="radio"
              name="tiePayout"
              checked={rules.tiePayout === 9}
              onChange={() => emitChange(rules, onChange, { tiePayout: 9 })}
            />{" "}
            9:1
          </label>
        </div>
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Pair payout</span>
        <span>{rules.pairPayout}:1</span>
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label">
          <input
            type="checkbox"
            checked={rules.suitRequired}
            onChange={(e) =>
              emitChange(rules, onChange, { suitRequired: (e.target as HTMLInputElement).checked })
            }
          />{" "}
          Suit required
        </label>
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="dragon-threshold">
          Dragon threshold: {rules.dragonThreshold}
        </label>
        <input
          id="dragon-threshold"
          type="range"
          min={4}
          max={12}
          value={rules.dragonThreshold}
          onInput={(e) =>
            emitChange(rules, onChange, {
              dragonThreshold: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label">
          <input
            type="checkbox"
            checked={rules.predictionCells}
            onChange={(e) =>
              emitChange(rules, onChange, {
                predictionCells: (e.target as HTMLInputElement).checked,
              })
            }
          />{" "}
          Prediction cells (Ask the Road)
        </label>
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="tie-max-divisor">
          Tie max divisor
        </label>
        <input
          id="tie-max-divisor"
          type="number"
          min={1}
          value={rules.tieMaxDivisor}
          onChange={(e) =>
            emitChange(rules, onChange, {
              tieMaxDivisor: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Burn rule (virtual only)</span>
        <select
          value={rules.burnRule}
          onChange={(e) =>
            emitChange(rules, onChange, {
              burnRule: (e.target as HTMLSelectElement).value as BaccaratRules["burnRule"],
            })
          }
        >
          <option value="none">None</option>
          <option value="first_card_value">First card value</option>
        </select>
      </div>
    </div>
  );
}
