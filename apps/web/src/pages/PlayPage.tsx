import {
  PLAYER_COLORS,
  isValidTableCode,
  normalizeTableCode,
  validatePlayerName,
} from "@casino-lord/core";
import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { PlayerShell } from "../shells/PlayerShell.js";
import { getTableMeta, joinTablePlayer } from "../sync/api.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { clearPlayerToken, loadPlayerToken, savePlayerToken } from "../sync/player-token.js";
import { getGame } from "../table/games.js";
import { createSyncedTableStore, waitForSyncReady } from "../table/synced-store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./play-page.css";

type Phase = "loading" | "join" | "pending" | "playing" | "error";

export function PlayPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params } = useRoute();
  const rawCode = params.code ?? "";
  const code = normalizeTableCode(rawCode);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]!);
  const [store, setStore] = useState<SyncStore | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [joinPending, setJoinPending] = useState(false);

  useEffect(() => {
    if (!isSyncConfigured()) {
      setPhase("error");
      setError("Sync server not configured");
      return;
    }
    if (!isValidTableCode(code)) {
      setPhase("error");
      setError("Invalid table code");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const meta = await getTableMeta(getSyncBaseUrl(), code);
        if (!meta.exists) {
          if (!cancelled) {
            setPhase("error");
            setError("Table not found");
          }
          return;
        }
        if (meta.participation?.playerMode !== "on") {
          if (!cancelled) {
            setPhase("error");
            setError("Player mode is not enabled on this table");
          }
          return;
        }

        const storedToken = loadPlayerToken(code);
        if (storedToken) {
          await connectPlayer(storedToken, "", false);
          if (!cancelled) setPhase("playing");
          return;
        }

        if (!cancelled) setPhase("join");
      } catch {
        if (!cancelled) {
          setPhase("error");
          setError("Could not load table");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const connectPlayer = async (token: string, displayName: string, pending: boolean) => {
    const entry = getGame("baccarat");
    if (!entry?.module) {
      setPhase("error");
      setError("Unsupported game");
      return;
    }

    let syncStore: SyncStore | null = null;
    syncStore = createSyncedTableStore({
      code,
      role: "player",
      token,
      syncUrl: getSyncBaseUrl(),
      module: entry.module,
      rules: entry.module.defaultRules,
      onJoinError: (errCode) => {
        if (errCode === "BAD_TOKEN") {
          clearStoredAndJoin();
        } else {
          setPhase("error");
          setError(errCode);
        }
      },
    });

    await waitForSyncReady(syncStore);
    savePlayerToken(code, token);
    setStore(syncStore);
    const pid = syncStore.getPlayerId();
    const fromLog = pid
      ? syncStore.getComposed().platform.players.find((p) => p.id === pid)?.name
      : undefined;
    const resolvedName = displayName || fromLog || "Player";
    setPlayerName(resolvedName);
    const inLog = pid
      ? syncStore.getComposed().platform.players.find((p) => p.id === pid)
      : undefined;
    const isActive = inLog?.status === "active";
    setJoinPending(pending && !isActive);
    setPhase(isActive ? "playing" : pending ? "pending" : "playing");
  };

  const clearStoredAndJoin = () => {
    clearPlayerToken(code);
    setStore(null);
    setPhase("join");
  };

  useEffect(() => {
    if (!store || phase !== "pending") return;
    const playerId = store.getPlayerId();
    if (!playerId) return;

    const check = (): void => {
      const composed = store.getComposed();
      const joined = composed.platform.players.some(
        (p) => p.id === playerId && p.status === "active",
      );
      if (joined) {
        setJoinPending(false);
        setPhase("playing");
      }
    };

    check();
    return store.subscribe(check);
  }, [store, phase]);

  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe(() => {
      const reason = store.getRejectReason();
      if (reason === "DECLINED") {
        store.destroy();
        setStore(null);
        setPhase("error");
        setError("The dealer declined your join request");
      }
    });
    return unsub;
  }, [store]);

  const handleJoin = async () => {
    const validated = validatePlayerName(name);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setError("");
    try {
      const result = await joinTablePlayer(getSyncBaseUrl(), code, {
        name: validated.name,
        color,
      });
      savePlayerToken(code, result.playerToken);
      setPlayerName(validated.name);
      await connectPlayer(result.playerToken, validated.name, result.pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed");
    }
  };

  if (phase === "loading") {
    return (
      <main class="play-page" data-testid="play-page">
        <p>Loading…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main class="play-page" data-testid="play-page">
        <p class="play-page__error">{error}</p>
        <button type="button" onClick={() => route("/")}>
          Home
        </button>
      </main>
    );
  }

  if (phase === "join") {
    return (
      <main class="play-page" data-testid="play-page">
        <h1>Join table {code}</h1>
        <p class="play-page__disclaimer">Play chips — no cash value</p>
        <label class="play-page__field">
          Display name
          <input
            type="text"
            value={name}
            maxLength={16}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            data-testid="player-name-input"
          />
        </label>
        <fieldset class="play-page__colors">
          <legend>Colour</legend>
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              class={`play-page__swatch${color === c ? " play-page__swatch--selected" : ""}`}
              style={{ background: c }}
              aria-label={c}
              onClick={() => setColor(c)}
              data-testid={`color-${c}`}
            />
          ))}
        </fieldset>
        {error && <p class="play-page__error">{error}</p>}
        <button
          type="button"
          class="play-page__join"
          onClick={() => void handleJoin()}
          data-testid="join-btn"
        >
          Join
        </button>
      </main>
    );
  }

  if (phase === "pending" && store) {
    return (
      <main class="play-page play-page--pending" data-testid="play-page">
        <p data-testid="pending-message">Waiting for the dealer to approve</p>
        <PlayerShell store={store} playerName={playerName} />
      </main>
    );
  }

  if (phase === "playing" && store) {
    return (
      <main class="play-page" data-testid="play-page">
        <PlayerShell store={store} playerName={playerName || "Player"} />
      </main>
    );
  }

  return null;
}
