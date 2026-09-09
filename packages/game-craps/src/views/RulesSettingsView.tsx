import type { CrapsRules } from "../rules.js";
import { rulesSchema } from "../schemas.js";
import "./craps-tokens.css";
import "./rules-settings-view.css";

export interface RulesSettingsViewProps {
  rules: CrapsRules;
  onChange: (patch: Partial<CrapsRules>) => void;
}

function emitChange(
  rules: CrapsRules,
  onChange: (patch: Partial<CrapsRules>) => void,
  patch: Partial<CrapsRules>,
): void {
  const merged = { ...rules, ...patch };
  const parsed = rulesSchema.safeParse(merged);
  if (parsed.success) onChange(patch);
}

const MAX_ODDS_OPTIONS = ["1x", "2x", "3x", "3-4-5x", "5x", "10x", "20x", "100x"] as const;

export function RulesSettingsView({ rules, onChange }: RulesSettingsViewProps) {
  return (
    <div class="craps-display rules-settings" data-testid="rules-settings">
      <div class="rules-settings__field">
        <span class="rules-settings__label">Max odds</span>
        <div class="rules-settings__options">
          {MAX_ODDS_OPTIONS.map((opt) => (
            <label key={opt}>
              <input
                type="radio"
                name="maxOdds"
                checked={rules.maxOdds === opt}
                onChange={() => emitChange(rules, onChange, { maxOdds: opt })}
              />{" "}
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Field 12 pays</span>
        <label>
          <input
            type="radio"
            name="field12"
            checked={rules.field12 === 2}
            onChange={() => emitChange(rules, onChange, { field12: 2 })}
          />{" "}
          2:1
        </label>
        <label>
          <input
            type="radio"
            name="field12"
            checked={rules.field12 === 3}
            onChange={() => emitChange(rules, onChange, { field12: 3 })}
          />{" "}
          3:1
        </label>
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Field 2 pays</span>
        <label>
          <input
            type="radio"
            name="field2"
            checked={rules.field2 === 2}
            onChange={() => emitChange(rules, onChange, { field2: 2 })}
          />{" "}
          2:1
        </label>
        <label>
          <input
            type="radio"
            name="field2"
            checked={rules.field2 === 3}
            onChange={() => emitChange(rules, onChange, { field2: 3 })}
          />{" "}
          3:1
        </label>
      </div>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.buyVigOnWin}
          onChange={(e) =>
            emitChange(rules, onChange, { buyVigOnWin: (e.target as HTMLInputElement).checked })
          }
        />{" "}
        Buy vig on win
      </label>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Fire payouts</span>
        <label>
          fire4{" "}
          <input
            type="number"
            value={rules.fire4}
            onChange={(e) =>
              emitChange(rules, onChange, { fire4: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
        <label>
          fire5{" "}
          <input
            type="number"
            value={rules.fire5}
            onChange={(e) =>
              emitChange(rules, onChange, { fire5: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
        <label>
          fire6{" "}
          <input
            type="number"
            value={rules.fire6}
            onChange={(e) =>
              emitChange(rules, onChange, { fire6: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.trackFire}
          onChange={(e) =>
            emitChange(rules, onChange, { trackFire: (e.target as HTMLInputElement).checked })
          }
        />{" "}
        Track Fire Bet
      </label>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.trackAllTallSmall}
          onChange={(e) =>
            emitChange(rules, onChange, {
              trackAllTallSmall: (e.target as HTMLInputElement).checked,
            })
          }
        />{" "}
        Track All/Tall/Small
      </label>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Hot shooter threshold</span>
        <input
          type="number"
          min={10}
          max={50}
          value={rules.hotShooterThreshold}
          onChange={(e) =>
            emitChange(rules, onChange, {
              hotShooterThreshold: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Distribution window</span>
        <label>
          <input
            type="radio"
            name="distributionWindow"
            checked={rules.distributionWindow === "shooter"}
            onChange={() => emitChange(rules, onChange, { distributionWindow: "shooter" })}
          />{" "}
          Shooter
        </label>
        <label>
          <input
            type="radio"
            name="distributionWindow"
            checked={rules.distributionWindow === "table"}
            onChange={() => emitChange(rules, onChange, { distributionWindow: "table" })}
          />{" "}
          Table
        </label>
      </div>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.autoNewShooterOnSevenOut}
          onChange={(e) =>
            emitChange(rules, onChange, {
              autoNewShooterOnSevenOut: (e.target as HTMLInputElement).checked,
            })
          }
        />{" "}
        Auto new shooter on seven-out
      </label>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.showLiveDice}
          onChange={(e) =>
            emitChange(rules, onChange, { showLiveDice: (e.target as HTMLInputElement).checked })
          }
        />{" "}
        Show live dice on display
      </label>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Don't pass bar</span>
        <label>
          <input
            type="radio"
            name="barNumber"
            checked={rules.barNumber === 2}
            onChange={() => emitChange(rules, onChange, { barNumber: 2 })}
          />{" "}
          2
        </label>
        <label>
          <input
            type="radio"
            name="barNumber"
            checked={rules.barNumber === 12}
            onChange={() => emitChange(rules, onChange, { barNumber: 12 })}
          />{" "}
          12
        </label>
      </div>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.putBets}
          onChange={(e) =>
            emitChange(rules, onChange, { putBets: (e.target as HTMLInputElement).checked })
          }
        />{" "}
        Put bets (come-out place/come allowed)
      </label>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.placeWorkingOnComeOut}
          onChange={(e) =>
            emitChange(rules, onChange, {
              placeWorkingOnComeOut: (e.target as HTMLInputElement).checked,
            })
          }
        />{" "}
        Place bets working on come-out
      </label>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.shooterMustBetLine}
          onChange={(e) =>
            emitChange(rules, onChange, {
              shooterMustBetLine: (e.target as HTMLInputElement).checked,
            })
          }
        />{" "}
        Shooter must bet line
      </label>

      <div class="rules-settings__field">
        <span class="rules-settings__label">Shooter idle (sec)</span>
        <input
          type="number"
          value={rules.shooterIdleSec}
          onChange={(e) =>
            emitChange(rules, onChange, {
              shooterIdleSec: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      <label class="rules-settings__toggle">
        <input
          type="checkbox"
          checked={rules.hornHigh}
          onChange={(e) =>
            emitChange(rules, onChange, { hornHigh: (e.target as HTMLInputElement).checked })
          }
        />{" "}
        Horn high
      </label>
    </div>
  );
}
