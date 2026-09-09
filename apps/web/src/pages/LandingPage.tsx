import { GAMES } from "../table/games.js";
import "./landing.css";

const syncConfigured = Boolean(import.meta.env.VITE_SYNC_URL);

export function LandingPage(_props: { path?: string }) {
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
        >
          Create Table
        </button>
        <button
          type="button"
          disabled={!syncConfigured}
          title={syncConfigured ? undefined : "Sync server not configured"}
        >
          Join
        </button>
        {!syncConfigured && (
          <p class="landing__sync-note" data-testid="sync-note">
            Sync server not configured
          </p>
        )}
      </div>
    </main>
  );
}
