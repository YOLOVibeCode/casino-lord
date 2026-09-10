import {
  PLAYER_COLORS,
  isValidTableCode,
  normalizeTableCode,
  validatePlayerName,
} from "@casino-lord/core";
import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { PlayerShell } from "../shells/PlayerShell.js";
import { loadPlayerToken } from "../sync/player-token.js";
import { getGame } from "../table/games.js";
import {
  createSoloPlayerStore,
  isSoloBroadcastChannelAvailable,
  joinSoloPlayer,
  rejoinSoloPlayer,
  waitForSoloSnapshot,
} from "../table/solo-channel.js";
import type { SyncStore } from "../table/sync-store-types.js";
import "./play-page.css";

type Phase = "loading" | "join" | "playing" | "error";

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

export function SoloPlayPage(_props: { path?: string }) {
  const { route } = useLocation();
  const { params, query } = useRoute();
  const gameId = params.game ?? "";
  const rawCode = query.code ?? "";
  const code = normalizeTableCode(rawCode);
  const entry = getGame(gameId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]!);
  const [store, setStore] = useState<SyncStore | null>(null);
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    if (!isSoloBroadcastChannelAvailable()) {
      setPhase("error");
      setError("Local players require a browser with BroadcastChannel support");
      return;
    }

    if (!entry?.enabled || !entry.module) {
      setPhase("error");
      setError("Unknown or disabled game");
      return;
    }

    if (!isValidTableCode(code)) {
      setPhase("error");
      setError("Invalid table code");
      return;
    }

    let cancelled = false;
    const storedToken = loadPlayerToken(code);

    void (async () => {
      if (storedToken) {
        const result = await rejoinSoloPlayer({ code, playerToken: storedToken });
        if (cancelled) return;
        if (result.ok) {
          const playerStore = createSoloPlayerStore({
            code,
            game: entry.id,
            module: entry.module!,
            rules: entry.module!.defaultRules,
            playerId: result.playerId,
            playerToken: result.playerToken,
          });
          try {
            await waitForSoloSnapshot(playerStore);
          } catch {
            playerStore.destroy();
            if (!cancelled) {
              setPhase("join");
            }
            return;
          }
          const composed = playerStore.getComposed();
          const player = composed.platform.players.find((p) => p.id === result.playerId);
          if (!cancelled) {
            setStore(playerStore);
            setPlayerName(player?.name ?? "Player");
            setPhase("playing");
          }
          return;
        }
      }

      if (!cancelled) {
        setPhase("join");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, entry]);

  useEffect(() => {
    return () => {
      store?.destroy();
    };
  }, [store]);

  const handleJoin = async (): Promise<void> => {
    if (!entry?.module) return;

    const validated = validatePlayerName(name);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    setError("");
    const result = await joinSoloPlayer({ code, name: validated.name, color });
    if (!result.ok) {
      setError(result.reason);
      return;
    }

    const playerStore = createSoloPlayerStore({
      code,
      game: entry.id,
      module: entry.module,
      rules: entry.module.defaultRules,
      playerId: result.playerId,
      playerToken: result.playerToken,
    });

    try {
      await waitForSoloSnapshot(playerStore);
    } catch {
      playerStore.destroy();
      setError("Could not connect to dealer tab");
      return;
    }

    setStore(playerStore);
    setPlayerName(validated.name);
    setPhase("playing");
  };

  if (phase === "loading") {
    return (
      <main class="play-page play-page--loading" data-testid="solo-play-page">
        <p>Loading…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main class="play-page play-page--error" data-testid="solo-play-page">
        <p class="play-page__error">{error}</p>
        <button type="button" onClick={() => route("/")}>
          Home
        </button>
      </main>
    );
  }

  if (phase === "join") {
    return (
      <main class="play-page play-page--join" data-testid="solo-play-page">
        <h1>Join table {code}</h1>
        <p class="play-page__disclaimer">Play chips — no cash value</p>
        <label class="play-page__field">
          <span>Display name</span>
          <input
            type="text"
            name="nickname"
            autocomplete="nickname"
            value={name}
            maxLength={16}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            data-testid="player-name-input"
          />
        </label>
        <fieldset class="play-page__colors">
          <legend>Colour</legend>
          <div class="play-page__swatch-row">
            {PLAYER_COLORS.map((c, i) => (
              <div key={c} class="play-page__swatch-wrap">
                <button
                  type="button"
                  class={`play-page__swatch${color === c ? " play-page__swatch--selected" : ""}`}
                  style={{ background: c }}
                  aria-label={COLOR_LABELS[i] ?? c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  data-testid={`color-${c}`}
                />
                <span class="play-page__swatch-label">{COLOR_LABELS[i] ?? c}</span>
              </div>
            ))}
          </div>
        </fieldset>
        {error && <p class="play-page__error">{error}</p>}
        <div class="play-page__join-wrap">
          <button
            type="button"
            class="play-page__join"
            onClick={() => void handleJoin()}
            data-testid="join-btn"
          >
            Join
          </button>
        </div>
      </main>
    );
  }

  if (phase === "playing" && store) {
    return (
      <main class="play-page play-page--embedded" data-testid="solo-play-page">
        <PlayerShell store={store} playerName={playerName || "Player"} />
      </main>
    );
  }

  return null;
}
