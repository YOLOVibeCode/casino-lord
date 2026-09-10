import type { DeviceSettings } from "../settings/device-settings.js";
import "./player-settings-sheet.css";

export interface PlayerSettingsSheetProps {
  settings: DeviceSettings;
  onChange: (patch: Partial<DeviceSettings>) => void;
  onClose: () => void;
}

export function PlayerSettingsSheet({ settings, onChange, onClose }: PlayerSettingsSheetProps) {
  return (
    <div
      class="player-settings-sheet__backdrop"
      data-testid="player-settings-sheet"
      onClick={onClose}
    >
      <div class="player-settings-sheet" onClick={(e) => e.stopPropagation()}>
        <header class="player-settings-sheet__header">
          <span>Settings</span>
          <button
            type="button"
            class="player-settings-sheet__close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div class="player-settings-sheet__field">
          <label for="player-phone-animations">Phone animations</label>
          <select
            id="player-phone-animations"
            data-testid="player-phone-animations"
            value={settings.phoneAnimations}
            onChange={(e) =>
              onChange({
                phoneAnimations: (e.target as HTMLSelectElement)
                  .value as DeviceSettings["phoneAnimations"],
              })
            }
          >
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div class="player-settings-sheet__field">
          <label for="player-shake-sensitivity">Shake sensitivity</label>
          <select
            id="player-shake-sensitivity"
            data-testid="player-shake-sensitivity"
            value={settings.shakeSensitivity}
            onChange={(e) =>
              onChange({
                shakeSensitivity: (e.target as HTMLSelectElement)
                  .value as DeviceSettings["shakeSensitivity"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
    </div>
  );
}
