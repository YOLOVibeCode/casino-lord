import type { RouletteRules } from "../rules.js";
import { rulesSchema } from "../schemas.js";
import "./roulette-tokens.css";
import "./rules-settings-view.css";

export interface RulesSettingsViewProps {
  rules: RouletteRules;
  onChange: (patch: Partial<RouletteRules>) => void;
}

function emitChange(
  rules: RouletteRules,
  onChange: (patch: Partial<RouletteRules>) => void,
  patch: Partial<RouletteRules>,
): void {
  const merged = { ...rules, ...patch };
  const parsed = rulesSchema.safeParse(merged);
  if (parsed.success) {
    onChange(patch);
  }
}

export function RulesSettingsView({ rules, onChange }: RulesSettingsViewProps) {
  return (
    <div class="roulette-display rules-settings" data-testid="rules-settings">
      <div class="rules-settings__field">
        <span class="rules-settings__label">Wheel</span>
        <div class="rules-settings__options">
          {(["european", "american", "french"] as const).map((wheel) => (
            <label key={wheel}>
              <input
                type="radio"
                name="wheel"
                checked={rules.wheel === wheel}
                onChange={() => emitChange(rules, onChange, { wheel })}
              />{" "}
              {wheel}
            </label>
          ))}
        </div>
      </div>

      {(rules.wheel === "french" || rules.wheel === "european") && (
        <div class="rules-settings__field">
          <span class="rules-settings__label">Zero rule</span>
          <div class="rules-settings__options">
            {(["none", "la_partage", "en_prison"] as const).map((zeroRule) => (
              <label key={zeroRule}>
                <input
                  type="radio"
                  name="zeroRule"
                  checked={rules.zeroRule === zeroRule}
                  onChange={() => emitChange(rules, onChange, { zeroRule })}
                />{" "}
                {zeroRule.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
      )}

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="historyLength">
          History length
        </label>
        <input
          id="historyLength"
          type="number"
          min={10}
          max={40}
          value={rules.historyLength}
          onInput={(e) =>
            emitChange(rules, onChange, {
              historyLength: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Stats window</span>
        <div class="rules-settings__options">
          {(["session", 50, 100, 200] as const).map((w) => (
            <label key={String(w)}>
              <input
                type="radio"
                name="statsWindow"
                checked={rules.statsWindow === w}
                onChange={() => emitChange(rules, onChange, { statsWindow: w })}
              />{" "}
              {String(w)}
            </label>
          ))}
        </div>
      </div>

      <div class="rules-settings__field">
        <label class="rules-settings__label" htmlFor="streakThreshold">
          Streak threshold
        </label>
        <input
          id="streakThreshold"
          type="number"
          min={4}
          max={12}
          value={rules.streakThreshold}
          onInput={(e) =>
            emitChange(rules, onChange, {
              streakThreshold: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      <div class="rules-settings__field">
        <label>
          <input
            type="checkbox"
            checked={rules.zeroInDenominator}
            onChange={(e) =>
              emitChange(rules, onChange, {
                zeroInDenominator: (e.target as HTMLInputElement).checked,
              })
            }
          />{" "}
          Include zero in denominator
        </label>
      </div>

      <div class="rules-settings__field">
        <label>
          <input
            type="checkbox"
            checked={rules.showSectors}
            onChange={(e) =>
              emitChange(rules, onChange, { showSectors: (e.target as HTMLInputElement).checked })
            }
          />{" "}
          Show sectors
        </label>
      </div>

      <div class="rules-settings__field">
        <label>
          <input
            type="checkbox"
            checked={rules.sectorHeat}
            onChange={(e) =>
              emitChange(rules, onChange, { sectorHeat: (e.target as HTMLInputElement).checked })
            }
          />{" "}
          Sector heat on wheel
        </label>
      </div>

      <div class="rules-settings__field">
        <label>
          <input
            type="checkbox"
            checked={rules.autoConfirm}
            onChange={(e) =>
              emitChange(rules, onChange, { autoConfirm: (e.target as HTMLInputElement).checked })
            }
          />{" "}
          Auto-confirm entry
        </label>
      </div>

      <div class="rules-settings__field">
        <label>
          <input
            type="checkbox"
            checked={rules.allowCallBets}
            onChange={(e) =>
              emitChange(rules, onChange, { allowCallBets: (e.target as HTMLInputElement).checked })
            }
          />{" "}
          Allow call bets
        </label>
      </div>
    </div>
  );
}
