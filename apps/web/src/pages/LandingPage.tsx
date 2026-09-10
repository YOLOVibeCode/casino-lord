import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import {
  isValidTableCode,
  normalizeTableCode,
  DEFAULT_TABLE_SETTINGS,
  type Participation,
} from "@casino-lord/core";
import { createTable, fetchServerFeatures, getTableMeta } from "../sync/api.js";
import { isSyncConfigured, getSyncBaseUrl } from "../sync/config.js";
import {
  clearDealerToken,
  listRecentDealerTables,
  loadDealerToken,
  type DealerTokenRecord,
} from "../sync/dealer-token.js";
import { GAMES, getGame } from "../table/games.js";
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
  const [lookup, setLookup] = useState<{
    code: string;
    game: string;
    participation: Participation;
  } | null>(null);
  const [withPlayers, setWithPlayers] = useState(false);
  const [houseBank, setHouseBank] = useState(true);
  const [defaultBuyIn, setDefaultBuyIn] = useState(DEFAULT_TABLE_SETTINGS.bank.defaultBuyIn);
  const [outcomeVirtual, setOutcomeVirtual] = useState(false);
  const [enableVirtual, setEnableVirtual] = useState(false);
  const [recentTables, setRecentTables] = useState<DealerTokenRecord[]>([]);

  const refreshRecentTables = () => {
    setRecentTables(listRecentDealerTables());
  };

  useEffect(() => {
    refreshRecentTables();
  }, []);

  useEffect(() => {
    if (!syncConfigured) return;
    void fetchServerFeatures(getSyncBaseUrl()).then((features) => {
      setEnableVirtual(features.enableVirtual);
    });
  }, [syncConfigured]);

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
      const outcomeSource = outcomeVirtual && enableVirtual ? "virtual" : "physical";
      const participation: Participation = withPlayers
        ? {
            playerMode: "on",
            bank: houseBank ? "house" : "none",
            outcomeSource,
          }
        : { playerMode: "off", bank: "none", outcomeSource };
      const result = await createTable(getSyncBaseUrl(), {
        game: selectedGame as "baccarat" | "roulette" | "craps" | "blackjack",
        participation,
        ...(withPlayers && houseBank ? { settings: { bank: { defaultBuyIn } } } : {}),
      });
      route(
        `/created/${result.code}?t=${encodeURIComponent(result.dealerToken)}&game=${encodeURIComponent(selectedGame)}`,
      );
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
      setLookup({
        code,
        game: meta.game ?? "baccarat",
        participation: meta.participation ?? {
          playerMode: "off",
          bank: "none",
          outcomeSource: "physical",
        },
      });
    } catch {
      setJoinError("Could not look up table.");
    }
  };

  const joinAsPlayer = () => {
    if (!lookup || lookup.participation.playerMode !== "on") return;
    route(`/play/${lookup.code}`);
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

  const reopenTable = (table: DealerTokenRecord) => {
    route(`/dealer/${table.code}?t=${encodeURIComponent(table.token)}`);
  };

  const forgetTable = (tableCode: string) => {
    clearDealerToken(tableCode);
    refreshRecentTables();
  };

  const formatLastOpened = (timestamp: number): string => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  return (
    <main class="landing">
      <h1 class="landing__title">Casino Lord</h1>
      <p class="landing__subtitle">Play chips only — no real money, ever.</p>

      <div class="landing__games">
        {GAMES.map((game) => (
          <article key={game.id} class="landing__card">
            <h2>{game.name}</h2>
            <a href={`/solo/${game.id}`} class="landing__solo-link">
              Solo
            </a>
            <p class="landing__action-hint">Solo — one device, you record results</p>
          </article>
        ))}
      </div>

      <div class="landing__host-actions">
        <div class="landing__host-action">
          <button
            type="button"
            disabled={!syncConfigured}
            title={syncConfigured ? undefined : "Sync server not configured"}
            onClick={() => setSheet("create")}
          >
            Create Table
          </button>
          <p class="landing__action-hint">
            Create table — a code your TV and players&apos; phones join
          </p>
        </div>
        <div class="landing__host-action">
          <button
            type="button"
            disabled={!syncConfigured}
            title={syncConfigured ? undefined : "Sync server not configured"}
            onClick={() => setSheet("join")}
          >
            Join
          </button>
          <p class="landing__action-hint">Join — enter a code someone gave you</p>
        </div>
        {!syncConfigured && (
          <p class="landing__sync-note" data-testid="sync-note">
            Sync server not configured
          </p>
        )}
      </div>

      {recentTables.length > 0 && (
        <section class="landing__your-tables" data-testid="your-tables">
          <h2 class="landing__your-tables-title">Your tables</h2>
          <ul class="landing__your-tables-list">
            {recentTables.map((table) => (
              <li
                key={table.code}
                class="landing__your-tables-row"
                data-testid={`your-table-${table.code}`}
              >
                <div class="landing__your-tables-info">
                  <strong>{table.code}</strong>
                  <span>{getGame(table.game ?? "")?.name ?? table.game ?? "Unknown game"}</span>
                  <span class="landing__your-tables-opened">
                    {formatLastOpened(table.lastOpenedAt)}
                  </span>
                </div>
                <div class="landing__your-tables-actions">
                  <button
                    type="button"
                    data-testid={`reopen-${table.code}`}
                    onClick={() => reopenTable(table)}
                  >
                    Reopen
                  </button>
                  <button
                    type="button"
                    data-testid={`forget-${table.code}`}
                    onClick={() => forgetTable(table.code)}
                  >
                    Forget
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details class="landing__how-it-works" data-testid="how-it-works">
        <summary>How it works</summary>
        <ol>
          <li>
            <strong>Dealer</strong> (your phone): record or trigger results, manage the table.
          </li>
          <li>
            <strong>Display</strong> (TV): read-only scoreboard with live animations.
          </li>
          <li>
            <strong>Player</strong> (guest phones): join with a code, bet with play chips.
          </li>
        </ol>
        <p>Play chips only — no real money, ever.</p>
      </details>

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
                  <p class="landing__field-help" data-testid="participation-help">
                    Dealer only: a scoreboard — you record results, no phones join. With players:
                    phones may join as players to bet from their phones.
                  </p>
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
                    <>
                      <label class="landing__option landing__option--nested">
                        <input
                          type="checkbox"
                          data-testid="house-bank-checkbox"
                          checked={houseBank}
                          onChange={(e) => setHouseBank((e.target as HTMLInputElement).checked)}
                        />
                        House bank (issue play chips)
                      </label>
                      <p class="landing__field-help" data-testid="house-bank-help">
                        {houseBank
                          ? "House bank: you issue play chips; the app tracks bankrolls and settles automatically."
                          : "No house bank: players track chips themselves; bets are declared for display and the app shows what each bet would pay."}
                      </p>
                      {houseBank && (
                        <label class="landing__option landing__option--nested">
                          Buy-in chips
                          <input
                            type="number"
                            min={1}
                            data-testid="buy-in-input"
                            value={defaultBuyIn}
                            onInput={(e) =>
                              setDefaultBuyIn(Number((e.target as HTMLInputElement).value))
                            }
                          />
                        </label>
                      )}
                    </>
                  )}
                </fieldset>
                <fieldset>
                  <legend>Outcome</legend>
                  <p class="landing__field-help" data-testid="outcome-help">
                    Physical: you enter real-world results. Virtual: the Virtual Dealer generates
                    results; players may be the shooter or play their own hands.
                  </p>
                  <label class="landing__option">
                    <input
                      type="radio"
                      name="outcome"
                      data-testid="outcome-physical"
                      checked={!outcomeVirtual}
                      onChange={() => setOutcomeVirtual(false)}
                    />
                    Physical
                  </label>
                  <label class="landing__option">
                    <input
                      type="radio"
                      name="outcome"
                      data-testid="outcome-virtual"
                      checked={outcomeVirtual}
                      disabled={!enableVirtual}
                      onChange={() => setOutcomeVirtual(true)}
                    />
                    Virtual
                  </label>
                  {!enableVirtual && (
                    <p class="landing__sync-note" data-testid="virtual-disabled-note">
                      Virtual outcomes are disabled on this server.
                    </p>
                  )}
                </fieldset>
                <p class="landing__field-help landing__field-help--sheet-note">
                  Play chips only — no real money, ever.
                </p>
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
                      Table <strong>{lookup.code}</strong> (
                      {getGame(lookup.game)?.name ?? lookup.game})
                    </p>
                    {lookup.participation.playerMode === "on" ? (
                      <button type="button" onClick={joinAsPlayer} data-testid="join-player">
                        Join as Player
                      </button>
                    ) : (
                      <p class="landing__field-help" data-testid="no-player-mode">
                        This table has no player mode
                      </p>
                    )}
                    <details class="landing__staff" data-testid="join-staff">
                      <summary>Staff</summary>
                      <button type="button" onClick={joinAsDisplay} data-testid="join-display">
                        Join as Display
                      </button>
                      <div class="landing__dealer-join">
                        <label>
                          Dealer token (if needed)
                          <input
                            type="text"
                            value={dealerTokenInput}
                            onInput={(e) =>
                              setDealerTokenInput((e.target as HTMLInputElement).value)
                            }
                            placeholder={
                              loadDealerToken(lookup.code) ? "Using saved token" : "Paste token"
                            }
                          />
                        </label>
                        <button type="button" onClick={joinAsDealer} data-testid="join-dealer">
                          Join as Dealer
                        </button>
                      </div>
                    </details>
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

      <footer class="landing__footer">
        <a href="/verify" data-testid="landing-verify-link">
          Verify a virtual series
        </a>
      </footer>
    </main>
  );
}
