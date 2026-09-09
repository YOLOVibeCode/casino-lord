import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { isValidTableCode, normalizeTableCode, type Participation } from "@casino-lord/core";
import { createTable, getTableMeta } from "../sync/api.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import { loadDealerToken } from "../sync/dealer-token.js";
import { GAMES } from "../table/games.js";
import "./landing.css";

type SheetMode = "create" | "join" | null;

export function LandingPage(_props: { path?: string }) {
  const { route } = useLocation();
  const syncConfigured = isSyncConfigured();
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [selectedGame, setSelectedGame] = useState("baccarat");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [dealerTokenInput, setDealerTokenInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [lookup, setLookup] = useState<{ code: string; game: string } | null>(null);
  const [withPlayers, setWithPlayers] = useState(false);
  const [houseBank, setHouseBank] = useState(true);

  const closeSheet = () => {
    setSheet(null);
    setJoinError("");
    setLookup(null);
    setDealerTokenInput("");
  };

  const handleCreate = async () => {
    if (!syncConfigured) return;
    setCreating(true);
    try {
      const participation: Participation = withPlayers
        ? {
            playerMode: "on",
            bank: houseBank ? "house" : "none",
            outcomeSource: "physical",
          }
        : { playerMode: "off", bank: "none", outcomeSource: "physical" };
      const result = await createTable(getSyncBaseUrl(), {
        game: selectedGame as "baccarat" | "roulette" | "craps" | "blackjack",
        participation,
      });
      route(`/created/${result.code}?t=${encodeURIComponent(result.dealerToken)}`);
    } catch {
      setJoinError("Could not create table. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinLookup = async () => {
    setJoinError("");
    const code = normalizeTableCode(joinCode);
    if (!isValidTableCode(code)) {
      setJoinError("Enter a valid 6-character table code.");
      return;
    }
    try {
      const meta = await getTableMeta(getSyncBaseUrl(), code);
      if (!meta.exists) {
        setJoinError("Table not found.");
        return;
      }
      setLookup({ code, game: meta.game ?? "baccarat" });
    } catch {
      setJoinError("Could not look up table.");
    }
  };

  const joinAsDisplay = () => {
    if (!lookup) return;
    route(`/display/${lookup.code}`);
  };

  const joinAsDealer = () => {
    if (!lookup) return;
    const stored = loadDealerToken(lookup.code);
    const token = dealerTokenInput.trim() || stored;
    if (!token) {
      setJoinError("Enter the dealer token.");
      return;
    }
    route(`/dealer/${lookup.code}?t=${encodeURIComponent(token)}`);
  };

  return (
    <main class="landing">
      <h1 class="landing__title">Casino Lord</h1>
      <p class="landing__subtitle">Play chips only — no real money, ever.</p>

      <div class="landing__games">
        {GAMES.map((game) => (
          <article key={game.id} class="landing__card">
            <h2>{game.name}</h2>
            {game.enabled ? (
              <a href={`/solo/${game.id}`} class="landing__solo-link">
                Solo
              </a>
            ) : (
              <span class="landing__soon">Coming soon</span>
            )}
          </article>
        ))}
      </div>

      <div class="landing__host-actions">
        <button
          type="button"
          disabled={!syncConfigured}
          title={syncConfigured ? undefined : "Sync server not configured"}
          onClick={() => setSheet("create")}
        >
          Create Table
        </button>
        <button
          type="button"
          disabled={!syncConfigured}
          title={syncConfigured ? undefined : "Sync server not configured"}
          onClick={() => setSheet("join")}
        >
          Join
        </button>
        {!syncConfigured && (
          <p class="landing__sync-note" data-testid="sync-note">
            Sync server not configured
          </p>
        )}
      </div>

      {sheet && (
        <div class="landing__sheet-backdrop" onClick={closeSheet}>
          <div
            class="landing__sheet"
            onClick={(e) => e.stopPropagation()}
            data-testid="landing-sheet"
          >
            {sheet === "create" && (
              <>
                <h2>Create table</h2>
                <fieldset>
                  <legend>Game</legend>
                  {GAMES.map((game) => (
                    <label key={game.id} class="landing__option">
                      <input
                        type="radio"
                        name="game"
                        value={game.id}
                        checked={selectedGame === game.id}
                        disabled={!game.enabled}
                        onChange={() => setSelectedGame(game.id)}
                      />
                      {game.name}
                      {!game.enabled && " (coming soon)"}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Participation</legend>
                  <label class="landing__option">
                    <input
                      type="radio"
                      name="participation"
                      checked={!withPlayers}
                      onChange={() => setWithPlayers(false)}
                    />
                    Dealer only
                  </label>
                  <label class="landing__option">
                    <input
                      type="radio"
                      name="participation"
                      checked={withPlayers}
                      onChange={() => setWithPlayers(true)}
                    />
                    With players
                  </label>
                  {withPlayers && (
                    <label class="landing__option landing__option--nested">
                      <input
                        type="checkbox"
                        data-testid="house-bank-checkbox"
                        checked={houseBank}
                        onChange={(e) => setHouseBank((e.target as HTMLInputElement).checked)}
                      />
                      House bank (issue play chips)
                    </label>
                  )}
                </fieldset>
                {joinError && <p class="landing__error">{joinError}</p>}
                <button type="button" disabled={creating} onClick={() => void handleCreate()}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </>
            )}

            {sheet === "join" && (
              <>
                <h2>Join table</h2>
                {!lookup ? (
                  <>
                    <label>
                      Table code
                      <input
                        type="text"
                        value={joinCode}
                        onInput={(e) => setJoinCode((e.target as HTMLInputElement).value)}
                        placeholder="K7X2PQ"
                        data-testid="join-code-input"
                      />
                    </label>
                    {joinError && <p class="landing__error">{joinError}</p>}
                    <button type="button" onClick={() => void handleJoinLookup()}>
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Table <strong>{lookup.code}</strong> ({lookup.game})
                    </p>
                    <button type="button" onClick={joinAsDisplay} data-testid="join-display">
                      Join as Display
                    </button>
                    <div class="landing__dealer-join">
                      <label>
                        Dealer token (if needed)
                        <input
                          type="text"
                          value={dealerTokenInput}
                          onInput={(e) => setDealerTokenInput((e.target as HTMLInputElement).value)}
                          placeholder={
                            loadDealerToken(lookup.code) ? "Using saved token" : "Paste token"
                          }
                        />
                      </label>
                      <button type="button" onClick={joinAsDealer} data-testid="join-dealer">
                        Join as Dealer
                      </button>
                    </div>
                    {joinError && <p class="landing__error">{joinError}</p>}
                  </>
                )}
              </>
            )}

            <button type="button" class="landing__sheet-close" onClick={closeSheet}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
