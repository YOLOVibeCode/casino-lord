import type { AnimationPreset, AnimationStyle, TableSettings } from "@casino-lord/core";
import { animationPresetSchema } from "@casino-lord/core";
import type { z } from "zod";
import { useState } from "preact/hooks";
import {
  allEditorEvents,
  scopedAnimationKey,
  templateVarsForEvent,
  type EditorEventScope,
} from "../animation/platform-events.js";
import { getEffectivePreset } from "../animation/presets.js";
import { useStore } from "../hooks/use-store.js";
import {
  BUILTIN_BUNDLE_IDS,
  buildBundleLoadPatch,
  buildResetAllPatch,
  collectGameOverrides,
  listSavedBundles,
  saveBundle,
} from "../settings/animation-bundles.js";
import type { UntypedGameModule } from "../table/module-types.js";
import type { TableStore } from "../table/store.js";

const STYLE_OPTIONS: Array<{ value: AnimationStyle; label: string; disabled?: boolean }> = [
  { value: "none", label: "None" },
  { value: "flash", label: "Flash" },
  { value: "burst", label: "Burst" },
  { value: "sweep", label: "Sweep" },
  { value: "banner", label: "Banner" },
  { value: "particles", label: "Particles" },
  { value: "trail", label: "Trail" },
  { value: "dragon", label: "Dragon" },
  { value: "shake", label: "Shake" },
  { value: "spin", label: "Spin (not yet available)", disabled: true },
  { value: "chips", label: "Chips (not yet available)", disabled: true },
];

const SOUND_OPTIONS = [
  { value: "", label: "Off" },
  { value: "flash", label: "Flash" },
  { value: "burst", label: "Burst" },
  { value: "sweep", label: "Sweep" },
  { value: "dragon", label: "Dragon" },
] as const;

export interface AnimationEditorTabProps {
  store: TableStore;
  module: UntypedGameModule;
}

type ParsedPreset = z.infer<typeof animationPresetSchema>;

function toAnimationPreset(data: ParsedPreset): AnimationPreset {
  const preset: AnimationPreset = {
    enabled: data.enabled,
    style: data.style,
    durationMs: data.durationMs,
    intensity: data.intensity,
    sound: data.sound ?? null,
    soundVolume: data.soundVolume,
    blockBoardUpdate: data.blockBoardUpdate,
  };
  if (data.color !== undefined) preset.color = data.color;
  if (data.text !== undefined) preset.text = data.text;
  return preset;
}

function emitPresetPatch(store: TableStore, key: string, preset: AnimationPreset | null): void {
  store.emit({
    type: "SETTINGS_CHANGED",
    patch: { animations: { [key]: preset } } as {
      animations: Record<string, AnimationPreset | null>;
    },
  });
}

function validateAndEmit(store: TableStore, key: string, preset: AnimationPreset): boolean {
  const parsed = animationPresetSchema.safeParse(preset);
  if (!parsed.success) return false;
  emitPresetPatch(store, key, toAnimationPreset(parsed.data));
  return true;
}

export function AnimationEditorTab({ store, module }: AnimationEditorTabProps) {
  useStore(store);
  const settings = store.getComposed().platform.settings;
  const events = allEditorEvents(module);
  const [expandedId, setExpandedId] = useState<string | null>(
    events[0] ? `${events[0].scope}-${events[0].id}` : null,
  );
  const [bundleSelect, setBundleSelect] = useState("");

  const savedBundles = listSavedBundles(store.game);

  const applyPatch = (patch: Record<string, AnimationPreset | null>): void => {
    store.emit({
      type: "SETTINGS_CHANGED",
      patch: { animations: patch } as { animations: Record<string, AnimationPreset | null> },
    });
  };

  const handleSaveBundle = (): void => {
    const name = window.prompt("Bundle name");
    if (!name?.trim()) return;
    const overrides = collectGameOverrides(settings.animations, module);
    saveBundle(store.game, name.trim(), overrides);
  };

  const handleLoadBundle = (): void => {
    if (!bundleSelect) return;
    const patch = buildBundleLoadPatch(bundleSelect, store.game, module, settings.animations);
    applyPatch(patch);
    setBundleSelect("");
  };

  const handleResetAll = (): void => {
    applyPatch(buildResetAllPatch(module, settings.animations));
  };

  return (
    <div class="animation-editor" data-testid="animation-editor">
      <div class="animation-editor__bundles">
        <select
          data-testid="bundle-select"
          value={bundleSelect}
          onChange={(e) => setBundleSelect((e.target as HTMLSelectElement).value)}
        >
          <option value="">Load bundle…</option>
          <optgroup label="Built-in">
            <option value={BUILTIN_BUNDLE_IDS.casinoFloor}>Casino floor</option>
            {store.game === "baccarat" && <option value={BUILTIN_BUNDLE_IDS.quiet}>Quiet</option>}
            <option value={BUILTIN_BUNDLE_IDS.resetAll}>Reset all</option>
          </optgroup>
          {savedBundles.length > 0 && (
            <optgroup label="Saved">
              {savedBundles.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          data-testid="bundle-load"
          onClick={handleLoadBundle}
          disabled={!bundleSelect}
        >
          Load
        </button>
        <button type="button" data-testid="bundle-save" onClick={handleSaveBundle}>
          Save as bundle…
        </button>
        <button type="button" data-testid="bundle-reset-all" onClick={handleResetAll}>
          Reset all
        </button>
      </div>

      <div class="animation-editor__rows">
        {events.map((def) => (
          <AnimationEventRow
            key={`${def.scope}-${def.id}`}
            store={store}
            module={module}
            def={def}
            scope={def.scope}
            settings={settings}
            expanded={expandedId === `${def.scope}-${def.id}`}
            onToggle={() =>
              setExpandedId((cur) =>
                cur === `${def.scope}-${def.id}` ? null : `${def.scope}-${def.id}`,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function AnimationEventRow({
  store,
  module,
  def,
  scope,
  settings,
  expanded,
  onToggle,
}: {
  store: TableStore;
  module: UntypedGameModule;
  def: { id: string; label: string; defaultPreset: AnimationPreset };
  scope: EditorEventScope;
  settings: TableSettings;
  expanded: boolean;
  onToggle: () => void;
}) {
  const key = scopedAnimationKey(def.id, scope);
  const preset = getEffectivePreset(def.id, module, settings);
  const hasOverride = Boolean(settings.animations?.[key]);
  const varsHint = templateVarsForEvent(def)
    .map((v) => `{${v}}`)
    .join(", ");

  const update = (patch: Partial<AnimationPreset>): void => {
    validateAndEmit(store, key, { ...preset, ...patch });
  };

  const clearColor = (): void => {
    const { color: _removed, ...rest } = preset;
    validateAndEmit(store, key, rest);
  };

  return (
    <details
      class="animation-editor__row"
      data-testid={`animation-row-${def.id}`}
      data-scope={scope}
      open={expanded}
    >
      <summary
        class="animation-editor__summary"
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
      >
        <span>{def.label}</span>
        <span class="animation-editor__badge">{scope}</span>
        {hasOverride && <span class="animation-editor__override">custom</span>}
      </summary>

      {expanded && (
        <div class="animation-editor__controls">
          <label class="settings-dialog__field">
            <span>Enabled</span>
            <input
              type="checkbox"
              data-testid={`${def.id}-enabled`}
              checked={preset.enabled}
              onChange={(e) => update({ enabled: (e.target as HTMLInputElement).checked })}
            />
          </label>

          <label class="settings-dialog__field">
            <span>Style</span>
            <select
              data-testid={`${def.id}-style`}
              value={preset.style}
              onChange={(e) =>
                update({ style: (e.target as HTMLSelectElement).value as AnimationStyle })
              }
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label class="settings-dialog__field">
            <span>Duration ({preset.durationMs} ms)</span>
            <input
              type="range"
              min={200}
              max={4000}
              step={100}
              data-testid={`${def.id}-duration`}
              value={preset.durationMs}
              onInput={(e) => update({ durationMs: Number((e.target as HTMLInputElement).value) })}
            />
          </label>

          <label class="settings-dialog__field">
            <span>Intensity</span>
            <select
              data-testid={`${def.id}-intensity`}
              value={preset.intensity}
              onChange={(e) =>
                update({ intensity: Number((e.target as HTMLSelectElement).value) as 1 | 2 | 3 })
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>

          <label class="settings-dialog__field">
            <span>Colour</span>
            <input
              type="color"
              data-testid={`${def.id}-color`}
              value={preset.color ?? "#D4AF37"}
              onInput={(e) => update({ color: (e.target as HTMLInputElement).value })}
            />
            <button type="button" onClick={clearColor}>
              Use default
            </button>
          </label>

          <label class="settings-dialog__field">
            <span>Text template</span>
            <input
              type="text"
              data-testid={`${def.id}-text`}
              value={preset.text ?? ""}
              onInput={(e) => update({ text: (e.target as HTMLInputElement).value })}
            />
            <small class="animation-editor__vars">Vars: {varsHint}</small>
          </label>

          <label class="settings-dialog__field">
            <span>Sound</span>
            <select
              data-testid={`${def.id}-sound`}
              value={preset.sound ?? ""}
              onChange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                update({ sound: val === "" ? null : val });
              }}
            >
              {SOUND_OPTIONS.map((opt) => (
                <option key={opt.value || "off"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label class="settings-dialog__field">
            <span>Volume ({preset.soundVolume.toFixed(2)})</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              data-testid={`${def.id}-volume`}
              value={preset.soundVolume}
              onInput={(e) => update({ soundVolume: Number((e.target as HTMLInputElement).value) })}
            />
          </label>

          <label class="settings-dialog__field animation-editor__advanced">
            <span>Block board update (advanced)</span>
            <input
              type="checkbox"
              data-testid={`${def.id}-block-board`}
              checked={preset.blockBoardUpdate}
              onChange={(e) => update({ blockBoardUpdate: (e.target as HTMLInputElement).checked })}
            />
          </label>

          <div class="animation-editor__actions">
            <button
              type="button"
              data-testid={`${def.id}-preview`}
              onClick={() => store.emit({ type: "ANIMATION_PREVIEW", eventId: def.id })}
            >
              Preview
            </button>
            <button
              type="button"
              data-testid={`${def.id}-reset`}
              disabled={!hasOverride}
              onClick={() => emitPresetPatch(store, key, null)}
            >
              Reset to default
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
