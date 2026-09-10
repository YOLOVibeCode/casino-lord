import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import type { Participation } from "@casino-lord/core";
import { useDeviceSettings } from "../hooks/use-device-settings.js";
import { DealerShell } from "../shells/DealerShell.js";
import { DisplayShell } from "../shells/DisplayShell.js";
import { useStore } from "../hooks/use-store.js";
import { qrDataUrl } from "../sync/qr.js";
import { getGame } from "../table/games.js";
import { createNewSoloTable, resolveSoloTableStore } from "../table/solo-table.js";
import {
  attachSoloBroadcastChannel,
  isSoloBroadcastChannelAvailable,
  soloLocalUrl,
  type SoloBroadcastChannelHandle,
} from "../table/solo-channel.js";
import type { TableStore } from "../table/store.js";
import "./solo.css";

function soloParticipation(outcomeSource: "physical" | "virtual"): Participation {
  return { playerMode: "off", bank: "none", outcomeSource };
}

export function SoloPage(_props: { path?: string }) {
  const { params } = useRoute();
  const gameId = params.game ?? "";
  const entry = getGame(gameId);
  const [store, setStore] = useState<TableStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcomeSource, setOutcomeSource] = useState<"physical" | "virtual">("physical");
  const [deviceSettings, setDeviceSettings] = useDeviceSettings();
  const supportsVirtual = Boolean(entry?.module?.virtual);

  useEffect(() => {
    if (!entry?.enabled || !entry.module) {
      setStore(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void resolveSoloTableStore({
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
    }).then((resolved) => {
      if (!cancelled) {
        setStore(resolved);
        setOutcomeSource(resolved.getComposed().platform.participation.outcomeSource);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [entry]);

  const handleNewTable = useCallback(async () => {
    if (!entry?.enabled || !entry.module) return;
    const next = await createNewSoloTable({
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
      participation: soloParticipation(outcomeSource),
    });
    setStore(next);
  }, [entry, outcomeSource]);

  const handleOutcomeSourceChange = useCallback(
    async (next: "physical" | "virtual") => {
      if (!entry?.enabled || !entry.module || next === outcomeSource) return;
      if (next === "virtual" && !supportsVirtual) return;
      setOutcomeSource(next);
      const nextStore = await createNewSoloTable({
        game: entry.id,
        module: entry.module,
        rules: entry.module.defaultRules,
        participation: soloParticipation(next),
      });
      setStore(nextStore);
    },
    [entry, outcomeSource, supportsVirtual],
  );

  if (!entry) {
    return (
      <main class="solo solo--error">
        <p>Unknown game.</p>
        <a href="/">Back</a>
      </main>
    );
  }

  if (!entry.enabled) {
    return (
      <main class="solo solo--error">
        <p>{entry.name} is coming soon.</p>
        <a href="/">Back</a>
      </main>
    );
  }

  if (loading || !store) {
    return (
      <main class="solo">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <SoloPanes
      store={store}
      gameId={gameId}
      entry={entry}
      outcomeSource={outcomeSource}
      supportsVirtual={supportsVirtual}
      onOutcomeSourceChange={(next) => void handleOutcomeSourceChange(next)}
      deviceSettings={deviceSettings}
      setDeviceSettings={setDeviceSettings}
      onNewTable={() => void handleNewTable()}
    />
  );
}

function SoloPanes({
  store,
  gameId,
  entry,
  outcomeSource,
  supportsVirtual,
  onOutcomeSourceChange,
  deviceSettings,
  setDeviceSettings,
  onNewTable,
}: {
  store: TableStore;
  gameId: string;
  entry: NonNullable<ReturnType<typeof getGame>>;
  outcomeSource: "physical" | "virtual";
  supportsVirtual: boolean;
  onOutcomeSourceChange: (next: "physical" | "virtual") => void;
  deviceSettings: ReturnType<typeof useDeviceSettings>[0];
  setDeviceSettings: ReturnType<typeof useDeviceSettings>[1];
  onNewTable: () => void;
}) {
  useStore(store);
  const rules = store.getRules();
  const composed = store.getComposed();
  const channelAvailable = isSoloBroadcastChannelAvailable();
  const localPlayersOn = composed.platform.participation.playerMode === "on";
  const channelRef = useRef<SoloBroadcastChannelHandle | null>(null);
  const [playQr, setPlayQr] = useState("");
  const [displayQr, setDisplayQr] = useState("");

  const playUrl = soloLocalUrl(`/solo/${gameId}/play?code=${store.code}`);
  const displayUrl = soloLocalUrl(`/solo/${gameId}/display?code=${store.code}`);

  useEffect(() => {
    if (!channelAvailable || !localPlayersOn || !entry.module) {
      channelRef.current?.detach();
      channelRef.current = null;
      return;
    }

    channelRef.current?.detach();
    channelRef.current = attachSoloBroadcastChannel(store, { module: entry.module });

    return () => {
      channelRef.current?.detach();
      channelRef.current = null;
    };
  }, [store, channelAvailable, localPlayersOn, entry.module]);

  useEffect(() => {
    if (!localPlayersOn) {
      setPlayQr("");
      setDisplayQr("");
      return;
    }

    let cancelled = false;
    void (async () => {
      const [p, d] = await Promise.all([qrDataUrl(playUrl), qrDataUrl(displayUrl)]);
      if (!cancelled) {
        setPlayQr(p);
        setDisplayQr(d);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [localPlayersOn, playUrl, displayUrl]);

  const handleLocalPlayersToggle = (): void => {
    const outcomeSource = composed.platform.participation.outcomeSource;
    if (localPlayersOn) {
      store.emit({
        type: "PARTICIPATION_CHANGED",
        participation: { playerMode: "off", bank: "none", outcomeSource },
      });
      return;
    }

    store.emit({
      type: "PARTICIPATION_CHANGED",
      participation: { playerMode: "on", bank: "house", outcomeSource },
    });
  };

  return (
    <main class="solo">
      <div class="solo__toolbar">
        <a href="/">← Home</a>
        <span>
          {entry.name} · {store.code}
        </span>
        <div class="solo__mode" role="group" aria-label="Outcome source">
          <button
            type="button"
            class={`solo__mode-btn${outcomeSource === "physical" ? " solo__mode-btn--active" : ""}`}
            aria-pressed={outcomeSource === "physical"}
            onClick={() => onOutcomeSourceChange("physical")}
          >
            Physical
          </button>
          <button
            type="button"
            class={`solo__mode-btn${outcomeSource === "virtual" ? " solo__mode-btn--active" : ""}`}
            aria-pressed={outcomeSource === "virtual"}
            disabled={!supportsVirtual}
            title={supportsVirtual ? undefined : "Virtual not available for this game"}
            onClick={() => onOutcomeSourceChange("virtual")}
          >
            Virtual
          </button>
        </div>
        {channelAvailable && (
          <div class="solo__local-players-wrap">
            <label class="solo__local-players" data-testid="local-players-toggle">
              <input type="checkbox" checked={localPlayersOn} onChange={handleLocalPlayersToggle} />
              Local players
            </label>
            <p class="solo__field-help" data-testid="local-players-help">
              Open the play link on other tabs of this browser — same device only
            </p>
          </div>
        )}
      </div>
      {localPlayersOn && (
        <section class="solo__local-links" data-testid="solo-local-links">
          <div class="solo__local-link">
            <h2>Join (Player)</h2>
            {playQr && <img src={playQr} alt="Player join QR" data-testid="solo-play-qr" />}
            <a href={playUrl} data-testid="solo-play-link">
              {playUrl}
            </a>
          </div>
          <div class="solo__local-link">
            <h2>Display mirror</h2>
            {displayQr && (
              <img src={displayQr} alt="Display mirror QR" data-testid="solo-display-qr" />
            )}
            <a href={displayUrl} data-testid="solo-display-link">
              {displayUrl}
            </a>
          </div>
        </section>
      )}
      <div class="solo__panes">
        <section class="solo__dealer" aria-label="Dealer">
          <DealerShell
            store={store}
            module={entry.module!}
            rules={rules}
            deviceSettings={deviceSettings}
            onDeviceSettingsChange={setDeviceSettings}
            onNewTable={onNewTable}
          />
        </section>
        <section class="solo__display" aria-label="Display">
          <DisplayShell
            store={store}
            module={entry.module!}
            rules={rules}
            deviceSettings={deviceSettings}
          />
        </section>
      </div>
    </main>
  );
}
