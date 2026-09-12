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
import { describeSyncError, SYNC_JOIN_TIMEOUT, type SyncErrorAction } from "../sync/error-copy.js";
import { JoinDiagnosticsPanel } from "../sync/JoinDiagnosticsPanel.js";
import { appendJoinTrace, type JoinTrace } from "../sync/join-diagnostics.js";
import { clearPlayerToken, loadPlayerToken, savePlayerToken } from "../sync/player-token.js";
import { getGame } from "../table/games.js";
import type { UntypedGameModule } from "../table/module-types.js";
import { createSyncedTableStore, waitForSyncReady } from "../table/synced-store.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./play-page.css";

type Phase = "loading" | "join" | "pending" | "playing" | "error";

const NAME_HELPER = "Display name must be 2–16 characters.";
const NAME_MAX_LENGTH = 16;

function firstAvailableColor(takenColors: string[]): string {
  return PLAYER_COLORS.find((c) => !takenColors.includes(c)) ?? PLAYER_COLORS[0]!;
}

const COLOR_LABELS = [
  "Red",
  "Blue",
  "Green",
  "Orange",
  "Purple",
  "Pink",
  "Teal",
  "Yellow",
  "Cyan",
  "Lime",
  "Indigo",
  "Rose",
];

const ACTION_LABELS: Record<SyncErrorAction, string> = {
  retry: "Try again",
  home: "Home",
  display: "Open as Display",
  takeover: "Take over",
};

function setErrorPhase(setPhase: (p: Phase) => void, setError: (c: string) => void, code: string) {
  setPhase("error");
  setError(code);
}

export function PlayPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params, query } = useRoute();
  const rawCode = params.code ?? "";
  const code = normalizeTableCode(rawCode);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorCode, setErrorCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]!);
  const [store, setStore] = useState<SyncStore | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [takenColors, setTakenColors] = useState<string[]>([]);
  const [bootstrapKey, setBootstrapKey] = useState(0);
  const [joining, setJoining] = useState(false);
  const [traces, setTraces] = useState<JoinTrace[]>([]);
  const [enteredOnTimeout, setEnteredOnTimeout] = useState(false);

  const pushTrace = (event: string, detail?: string): void => {
    setTraces((prev) => appendJoinTrace(prev, event, detail));
  };

  const diagnosticsReport = () => ({
    phase,
    tableCode: code,
    href: typeof window !== "undefined" ? window.location.href : "",
    syncUrl: isSyncConfigured() ? getSyncBaseUrl() : "not-configured",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    connectionState: store?.getConnectionState() ?? "none",
    rejectReason: store?.getRejectReason() ?? (joinError || errorCode || null),
    playerId: store?.getPlayerId() ?? null,
    traces,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  });

  useEffect(() => {
    if (!isSyncConfigured()) {
      setErrorPhase(setPhase, setErrorCode, "NOT_CONFIGURED");
      return;
    }
    if (!isValidTableCode(code)) {
      setErrorPhase(setPhase, setErrorCode, "INVALID_TABLE_CODE");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        pushTrace("lookup-start", getSyncBaseUrl());
        const meta = await getTableMeta(getSyncBaseUrl(), code);
        pushTrace(
          "lookup-ok",
          `game=${meta.game ?? "?"} playerMode=${meta.participation?.playerMode ?? "?"}`,
        );
        if (!meta.exists) {
          if (!cancelled) {
            setErrorPhase(setPhase, setErrorCode, "NOT_FOUND");
          }
          return;
        }
        if (meta.participation?.playerMode !== "on") {
          if (!cancelled) {
            setErrorPhase(setPhase, setErrorCode, "PLAYERS_DISABLED");
          }
          return;
        }

        const taken = meta.takenColors ?? [];
        if (!cancelled) {
          setTakenColors(taken);
          setColor((current) => (taken.includes(current) ? firstAvailableColor(taken) : current));
        }

        const queryToken = query.t;
        if (queryToken) {
          savePlayerToken(code, queryToken);
          stripTokenFromUrl();
          await connectPlayer(queryToken, "", false);
          if (!cancelled) return;
        }

        const storedToken = loadPlayerToken(code);
        if (storedToken) {
          await connectPlayer(storedToken, "", false);
          if (!cancelled) return;
        }

        if (!cancelled) setPhase("join");
      } catch (e) {
        pushTrace("lookup-failed", e instanceof Error ? e.message : "unknown");
        if (!cancelled) {
          setErrorPhase(setPhase, setErrorCode, "TABLE_LOOKUP_FAILED");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, query.t, bootstrapKey]);

  const stripTokenFromUrl = (): void => {
    const params = new URLSearchParams(window.location.search);
    params.delete("t");
    const qs = params.toString();
    history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };

  const connectPlayer = async (
    token: string,
    displayName: string,
    pending: boolean,
    knownPlayerId?: string,
  ) => {
    const resolveModule = (g: import("@casino-lord/core").GameId): UntypedGameModule => {
      const entry = getGame(g);
      if (!entry?.module) throw new Error("UNSUPPORTED_GAME");
      return entry.module;
    };

    let syncStore: SyncStore | null = null;
    syncStore = createSyncedTableStore({
      code,
      role: "player",
      token,
      syncUrl: getSyncBaseUrl(),
      resolveModule,
      ...(knownPlayerId ? { playerId: knownPlayerId } : {}),
      onTrace: (event, detail) => {
        pushTrace(event, detail);
      },
      onJoinError: (errCode) => {
        pushTrace("join-error", errCode);
        if (errCode === "BAD_TOKEN") {
          clearStoredAndJoin();
        } else {
          setErrorPhase(setPhase, setErrorCode, errCode);
        }
      },
    });

    try {
      await waitForSyncReady(syncStore);
      setEnteredOnTimeout(false);
    } catch (err) {
      const reason = syncStore.getRejectReason();
      const timedOut = err instanceof Error && err.message === SYNC_JOIN_TIMEOUT;
      if (reason === "BAD_TOKEN") {
        syncStore.destroy();
        return;
      }
      if (!timedOut && reason) {
        syncStore.destroy();
        throw new Error(reason);
      }
      // HTTP join already created the player. Keep the socket and enter the table
      // so a stalled phone websocket cannot block the name form forever.
      pushTrace("enter-without-ready", timedOut ? SYNC_JOIN_TIMEOUT : (reason ?? "unknown"));
      setEnteredOnTimeout(true);
    }
    savePlayerToken(code, token);
    setStore(syncStore);
    const pid = syncStore.getPlayerId() ?? knownPlayerId ?? null;
    const fromLog = pid
      ? syncStore.getComposed().platform.players.find((p) => p.id === pid)?.name
      : undefined;
    const resolvedName = displayName || fromLog || "Player";
    setPlayerName(resolvedName);
    const inLog = pid
      ? syncStore.getComposed().platform.players.find((p) => p.id === pid)
      : undefined;
    const isActive = inLog?.status === "active";
    setPhase(isActive ? "playing" : pending ? "pending" : "playing");
  };

  const clearStoredAndJoin = () => {
    clearPlayerToken(code);
    setStore(null);
    setJoinError("PLAYER_BAD_TOKEN");
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
        setPhase("playing");
      }
    };

    check();
    return store.subscribe(check);
  }, [store, phase]);

  const [, setDiagTick] = useState(0);
  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe(() => {
      setDiagTick((n) => n + 1);
      const reason = store.getRejectReason();
      if (reason === "DECLINED") {
        store.destroy();
        setStore(null);
        setErrorPhase(setPhase, setErrorCode, "DECLINED");
      }
    });
    return unsub;
  }, [store]);

  const trimmedNameLength = name.trim().length;
  const nameValidation = validatePlayerName(name);
  const joinDisabledReason = nameValidation.ok ? "" : nameValidation.error;

  const handleJoin = async () => {
    const validated = validatePlayerName(name);
    if (!validated.ok) {
      setJoinError("INVALID_NAME");
      return;
    }
    setJoinError("");
    setJoining(true);
    const started = Date.now();
    pushTrace("http-join-start", `name=${validated.name}`);
    try {
      const result = await joinTablePlayer(getSyncBaseUrl(), code, {
        name: validated.name,
        color,
      });
      pushTrace(
        "http-join-ok",
        `ms=${Date.now() - started} playerId=${result.playerId} pending=${result.pending}`,
      );
      savePlayerToken(code, result.playerToken);
      setPlayerName(validated.name);
      await connectPlayer(result.playerToken, validated.name, result.pending, result.playerId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Join failed";
      pushTrace("http-join-failed", `ms=${Date.now() - started} ${message}`);
      setJoinError(message);
    } finally {
      setJoining(false);
    }
  };

  const runErrorAction = (action: SyncErrorAction): void => {
    switch (action) {
      case "home":
        route("/");
        return;
      case "display":
        route(`/display/${code}`);
        return;
      case "retry":
        setErrorCode("");
        setPhase("loading");
        setBootstrapKey((n) => n + 1);
        return;
      case "takeover":
        return;
    }
  };

  const renderErrorActions = (actions: SyncErrorAction[]) => (
    <div class="play-page__error-actions">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          class="play-page__error-btn"
          data-testid={`play-error-action-${action}`}
          onClick={() => runErrorAction(action)}
        >
          {ACTION_LABELS[action]}
        </button>
      ))}
    </div>
  );

  if (phase === "loading") {
    return (
      <main class="play-page play-page--loading" data-testid="play-page">
        <p>Loading…</p>
        <JoinDiagnosticsPanel report={diagnosticsReport()} />
      </main>
    );
  }

  if (phase === "error") {
    const copy = describeSyncError(errorCode);
    return (
      <main class="play-page play-page--error" data-testid="play-page">
        <h1 class="play-page__error-title">{copy.title}</h1>
        <p class="play-page__error">{copy.body}</p>
        {errorCode && (
          <p class="play-page__error-code" data-testid="play-error-code">
            {errorCode}
          </p>
        )}
        {renderErrorActions(copy.actions)}
        <JoinDiagnosticsPanel report={diagnosticsReport()} />
      </main>
    );
  }

  if (phase === "join") {
    const joinCopy = joinError ? describeSyncError(joinError) : null;
    return (
      <main class="play-page play-page--join" data-testid="play-page">
        <h1>Join table {code}</h1>
        <p class="play-page__disclaimer">Play chips — no cash value</p>
        <label class="play-page__field">
          <span class="play-page__field-header">
            <span>Display name</span>
            <span class="play-page__name-counter" data-testid="name-counter">
              {trimmedNameLength}/{NAME_MAX_LENGTH}
            </span>
          </span>
          <input
            type="text"
            name="nickname"
            autocomplete="nickname"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            data-testid="player-name-input"
          />
          <span class="play-page__name-helper">{NAME_HELPER}</span>
        </label>
        <fieldset class="play-page__colors">
          <legend>Colour</legend>
          <div class="play-page__swatch-row">
            {PLAYER_COLORS.map((c, i) => {
              const isTaken = takenColors.includes(c);
              return (
                <div key={c} class="play-page__swatch-wrap">
                  <button
                    type="button"
                    class={`play-page__swatch${color === c ? " play-page__swatch--selected" : ""}${isTaken ? " play-page__swatch--taken" : ""}`}
                    style={{ background: c }}
                    aria-label={isTaken ? `${COLOR_LABELS[i] ?? c} taken` : (COLOR_LABELS[i] ?? c)}
                    aria-pressed={color === c}
                    disabled={isTaken}
                    onClick={() => setColor(c)}
                    data-testid={`color-${c}`}
                  />
                  <span class="play-page__swatch-label">
                    {isTaken ? "taken" : (COLOR_LABELS[i] ?? c)}
                  </span>
                </div>
              );
            })}
          </div>
        </fieldset>
        {joinCopy && <p class="play-page__error">{joinCopy.body}</p>}
        {joinError && (
          <p class="play-page__error-code" data-testid="play-join-error-code">
            {joinError}
          </p>
        )}
        <JoinDiagnosticsPanel report={diagnosticsReport()} />
        <div class="play-page__join-wrap">
          {joinDisabledReason && (
            <p class="play-page__join-hint" data-testid="join-disabled-reason">
              {joinDisabledReason}
            </p>
          )}
          <button
            type="button"
            class="play-page__join"
            disabled={!nameValidation.ok || joining}
            onClick={() => void handleJoin()}
            data-testid="join-btn"
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </div>
      </main>
    );
  }

  if (phase === "pending" && store) {
    return (
      <main class="play-page play-page--embedded play-page--pending" data-testid="play-page">
        <p class="play-page__pending-message" data-testid="pending-message">
          Waiting for the dealer to approve
        </p>
        <PlayerShell store={store} playerName={playerName} />
        <div class="play-page__diag-overlay">
          <JoinDiagnosticsPanel report={diagnosticsReport()} defaultOpen={enteredOnTimeout} />
        </div>
      </main>
    );
  }

  if (phase === "playing" && store) {
    return (
      <main class="play-page play-page--embedded" data-testid="play-page">
        {enteredOnTimeout && (
          <p class="play-page__timeout-banner" data-testid="entered-on-timeout">
            Joined — still connecting to the live table
          </p>
        )}
        <PlayerShell store={store} playerName={playerName || "Player"} />
        <div class="play-page__diag-overlay">
          <JoinDiagnosticsPanel report={diagnosticsReport()} defaultOpen={enteredOnTimeout} />
        </div>
      </main>
    );
  }

  return null;
}
