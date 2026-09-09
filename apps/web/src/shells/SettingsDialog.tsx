import { createElement } from "preact";
import { useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { LayoutPreset, TableSettings } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import type { TableStore } from "../table/store.js";
import type { DeviceSettings } from "../settings/device-settings.js";
import { AnimationEditorTab } from "./AnimationEditorTab.js";
import "./settings-dialog.css";

export interface SettingsDialogProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  deviceSettings: DeviceSettings;
  onDeviceChange: (settings: DeviceSettings) => void;
  onClose: () => void;
}

type Tab = "rules" | "device" | "animations" | "bank";

export function SettingsDialog({
  store,
  module,
  rules,
  deviceSettings,
  onDeviceChange,
  onClose,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<Tab>("rules");
  const [localDevice, setLocalDevice] = useState<DeviceSettings>(deviceSettings);
  const tableSettings = store.getComposed().platform.settings;

  const handleRulesChange = (patch: Record<string, unknown>): void => {
    const merged = { ...(rules as Record<string, unknown>), ...patch };
    const parsed = module.rulesSchema.safeParse(merged);
    if (!parsed.success) return;
    store.emit({ type: "SETTINGS_CHANGED", patch: { rules: patch } });
  };

  const updateDevice = (patch: Partial<DeviceSettings>): void => {
    const next = { ...localDevice, ...patch };
    setLocalDevice(next);
    onDeviceChange(next);
  };

  return (
    <div class="settings-dialog__backdrop" data-testid="settings-dialog" onClick={onClose}>
      <div
        class={`settings-dialog${tab === "animations" ? " settings-dialog--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="settings-dialog__header">
          <div class="settings-dialog__tabs">
            <button
              type="button"
              class={`settings-dialog__tab${tab === "rules" ? " settings-dialog__tab--active" : ""}`}
              onClick={() => setTab("rules")}
            >
              Rules
            </button>
            <button
              type="button"
              class={`settings-dialog__tab${tab === "bank" ? " settings-dialog__tab--active" : ""}`}
              data-testid="tab-bank"
              onClick={() => setTab("bank")}
            >
              Bank &amp; Betting
            </button>
            <button
              type="button"
              class={`settings-dialog__tab${tab === "animations" ? " settings-dialog__tab--active" : ""}`}
              data-testid="tab-animations"
              onClick={() => setTab("animations")}
            >
              Animations
            </button>
            <button
              type="button"
              class={`settings-dialog__tab${tab === "device" ? " settings-dialog__tab--active" : ""}`}
              onClick={() => setTab("device")}
            >
              Device
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div class="settings-dialog__body">
          {tab === "rules" &&
            createElement(
              module.RulesSettingsView as unknown as ComponentType<{
                rules: unknown;
                onChange: (patch: Record<string, unknown>) => void;
              }>,
              { rules, onChange: handleRulesChange },
            )}
          {tab === "bank" && (
            <BankBettingSettingsForm
              settings={tableSettings}
              onPatch={(patch) => store.emit({ type: "SETTINGS_CHANGED", patch })}
            />
          )}
          {tab === "animations" && <AnimationEditorTab store={store} module={module} />}
          {tab === "device" && (
            <DeviceSettingsForm
              layouts={module.layouts}
              settings={localDevice}
              onChange={updateDevice}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BankBettingSettingsForm({
  settings,
  onPatch,
}: {
  settings: TableSettings;
  onPatch: (patch: Partial<TableSettings>) => void;
}) {
  const patchBank = (patch: Partial<TableSettings["bank"]>) => {
    onPatch({ bank: { ...settings.bank, ...patch } });
  };
  const patchBetting = (patch: Partial<TableSettings["betting"]>) => {
    onPatch({ betting: { ...settings.betting, ...patch } });
  };

  return (
    <>
      <div class="settings-dialog__field">
        <label>
          Default buy-in
          <input
            type="number"
            min={1}
            data-testid="bank-default-buyin"
            value={settings.bank.defaultBuyIn}
            onChange={(e) =>
              patchBank({ defaultBuyIn: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>
      <div class="settings-dialog__field">
        <label>
          Table min
          <input
            type="number"
            min={1}
            data-testid="bank-table-min"
            value={settings.bank.tableMin}
            onChange={(e) => patchBank({ tableMin: Number((e.target as HTMLInputElement).value) })}
          />
        </label>
      </div>
      <div class="settings-dialog__field">
        <label>
          Table max
          <input
            type="number"
            min={1}
            data-testid="bank-table-max"
            value={settings.bank.tableMax}
            onChange={(e) => patchBank({ tableMax: Number((e.target as HTMLInputElement).value) })}
          />
        </label>
      </div>
      <div class="settings-dialog__field">
        <label>
          Max exposure (0 = off)
          <input
            type="number"
            min={0}
            data-testid="bank-max-exposure"
            value={settings.bank.maxExposure}
            onChange={(e) =>
              patchBank({ maxExposure: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>
      <div class="settings-dialog__field">
        <label>
          Big win multiple
          <input
            type="number"
            min={1}
            data-testid="bank-big-win-multiple"
            value={settings.bank.bigWinMultiple}
            onChange={(e) =>
              patchBank({ bigWinMultiple: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>
      <div class="settings-dialog__field">
        <label>
          Bet timer (sec, 0 = manual)
          <input
            type="number"
            min={0}
            data-testid="betting-timer-sec"
            value={settings.betting.betTimerSec}
            onChange={(e) =>
              patchBetting({ betTimerSec: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>
      <div class="settings-dialog__field">
        <label>
          Auto-open delay (ms)
          <input
            type="number"
            min={0}
            data-testid="betting-auto-open-ms"
            value={settings.betting.autoOpenDelayMs}
            onChange={(e) =>
              patchBetting({ autoOpenDelayMs: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>
      <div class="settings-dialog__checks">
        <label>
          <input
            type="checkbox"
            data-testid="betting-auto-close-entry"
            checked={settings.betting.autoCloseOnEntry}
            onChange={(e) =>
              patchBetting({ autoCloseOnEntry: (e.target as HTMLInputElement).checked })
            }
          />{" "}
          Auto-close on dealer entry
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="bank-auto-buyin"
            checked={settings.bank.autoBuyIn}
            onChange={(e) => patchBank({ autoBuyIn: (e.target as HTMLInputElement).checked })}
          />{" "}
          Auto buy-in on join
        </label>
      </div>
    </>
  );
}

function DeviceSettingsForm({
  layouts,
  settings,
  onChange,
}: {
  layouts: LayoutPreset[];
  settings: DeviceSettings;
  onChange: (patch: Partial<DeviceSettings>) => void;
}) {
  return (
    <>
      <div class="settings-dialog__field">
        <label for="layout-select">Layout preset</label>
        <select
          id="layout-select"
          data-testid="device-layout"
          value={settings.layoutId}
          onChange={(e) => onChange({ layoutId: (e.target as HTMLSelectElement).value })}
        >
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div class="settings-dialog__field">
        <label for="scale-range">Scale ({settings.scale.toFixed(2)})</label>
        <input
          id="scale-range"
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={settings.scale}
          onInput={(e) => onChange({ scale: Number((e.target as HTMLInputElement).value) })}
        />
      </div>
      <div class="settings-dialog__checks">
        <label>
          <input
            type="checkbox"
            checked={settings.roadFit}
            onChange={(e) => onChange({ roadFit: (e.target as HTMLInputElement).checked })}
          />{" "}
          Road fit
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.expressMode}
            onChange={(e) => onChange({ expressMode: (e.target as HTMLInputElement).checked })}
          />{" "}
          Express mode
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.autoAdvance}
            onChange={(e) => onChange({ autoAdvance: (e.target as HTMLInputElement).checked })}
          />{" "}
          Auto-advance
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.haptics}
            onChange={(e) => onChange({ haptics: (e.target as HTMLInputElement).checked })}
          />{" "}
          Haptics
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.cursorHide}
            onChange={(e) => onChange({ cursorHide: (e.target as HTMLInputElement).checked })}
          />{" "}
          Hide cursor
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.fullScreen}
            onChange={(e) => onChange({ fullScreen: (e.target as HTMLInputElement).checked })}
          />{" "}
          Full screen hint
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="device-sounds"
            checked={settings.soundEnabled}
            onChange={(e) => onChange({ soundEnabled: (e.target as HTMLInputElement).checked })}
          />{" "}
          Sounds
        </label>
      </div>
      <div class="settings-dialog__field">
        <label for="confirm-delay">Confirm delay ({settings.confirmDelayMs} ms)</label>
        <input
          id="confirm-delay"
          type="range"
          min={0}
          max={3000}
          step={100}
          value={settings.confirmDelayMs}
          onInput={(e) =>
            onChange({
              confirmDelayMs: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>
    </>
  );
}
