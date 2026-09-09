import { useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { getSyncBaseUrl } from "../sync/config.js";
import { getGame } from "../table/games.js";
import {
  parseExportHeader,
  replayVirtualSeries,
  verifyFromFairnessApi,
} from "../verify/replay-fairness.js";

export function VerifyPage(_props: { path?: string }) {
  const route = useRoute();
  const initialCode = typeof route.query?.code === "string" ? route.query.code : "";

  const [mode, setMode] = useState<"paste" | "fetch">(initialCode ? "fetch" : "paste");
  const [exportText, setExportText] = useState("");
  const [tableCode, setTableCode] = useState(initialCode);
  const [seriesNumber, setSeriesNumber] = useState("1");
  const [seedHex, setSeedHex] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [commit, setCommit] = useState("");
  const [result, setResult] = useState<{
    commitValid: boolean;
    replays: Array<{ index: number; match: boolean }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerify = async (): Promise<void> => {
    setError(null);
    setResult(null);

    if (mode === "fetch") {
      const baseUrl = getSyncBaseUrl();
      if (!baseUrl) {
        setError("Sync server not configured");
        return;
      }
      const code = tableCode.trim().toUpperCase();
      const series = Number(seriesNumber);
      const response = await fetch(`${baseUrl}/tables/${code}/fairness?series=${series}`);
      if (!response.ok) {
        setError(`Fairness fetch failed: ${response.status}`);
        return;
      }
      const body = (await response.json()) as {
        commit: string | null;
        seed?: string;
        draws: unknown[];
      };
      if (!body.commit || !body.seed) {
        setError("Seed not yet revealed for this series");
        return;
      }
      const meta = await fetch(`${baseUrl}/tables/${code}`).then(
        (r) => r.json() as Promise<{ game?: string }>,
      );
      const game = meta.game ?? "baccarat";
      const entry = getGame(game);
      if (!entry?.module) {
        setError("Unknown game");
        return;
      }
      const rules = entry.module.defaultRules;
      if (!seriesId) {
        setError("Series ID required (from SERIES_STARTED in the log)");
        return;
      }
      const verified = verifyFromFairnessApi({
        code,
        seriesId,
        commit: body.commit,
        seedHex: body.seed,
        game: game as "baccarat",
        rules,
        expectedDraws: body.draws as Array<{ from: number; to: number }>,
      });
      setCommit(body.commit);
      setSeedHex(body.seed);
      setResult(verified);
      return;
    }

    const parsed = parseExportHeader(exportText);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    if (parsed.source !== "virtual") {
      setError("Only virtual series can be fairness-verified");
      return;
    }
    if (!seedHex || !seriesId || !commit) {
      setError("Paste mode requires commit, seriesId, and seed (hex) for virtual exports");
      return;
    }
    const entry = getGame(parsed.game);
    if (!entry?.module?.virtual) {
      setError("Game module has no virtual handler");
      return;
    }
    const bodyLines = exportText.trim().split("\n").slice(1).join("\n");
    const imported = entry.module.importSeries(bodyLines, parsed.rules);
    if ("error" in imported) {
      setError(imported.error);
      return;
    }
    const commitValid = await import("@casino-lord/core").then(({ verifyCommit, hexToBytes }) =>
      verifyCommit(hexToBytes(seedHex), parsed.code, seriesId, commit),
    );
    const replayed = replayVirtualSeries({
      module: entry.module,
      rules: parsed.rules,
      code: parsed.code,
      seriesId,
      seedHex,
      expectedData: imported.results,
    });
    setResult({ commitValid, replays: replayed.replays });
  };

  return (
    <main class="verify-page" data-testid="verify-page">
      <h1>Fairness Verifier</h1>
      <p>Verify commit–reveal fairness for virtual table series (Appendix C).</p>

      <div class="verify-page__modes">
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "paste"}
            onChange={() => setMode("paste")}
          />
          Paste export
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "fetch"}
            onChange={() => setMode("fetch")}
          />
          Fetch by table code
        </label>
      </div>

      {mode === "paste" ? (
        <>
          <textarea
            data-testid="verify-export"
            value={exportText}
            onInput={(e) => setExportText((e.target as HTMLTextAreaElement).value)}
            rows={8}
            placeholder="Paste #casino-lord export…"
          />
          <label>
            Series ID
            <input
              value={seriesId}
              onInput={(e) => setSeriesId((e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Commit (hex)
            <input
              value={commit}
              onInput={(e) => setCommit((e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Seed (hex)
            <input
              value={seedHex}
              onInput={(e) => setSeedHex((e.target as HTMLInputElement).value)}
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Table code
            <input
              data-testid="verify-code"
              value={tableCode}
              onInput={(e) => setTableCode((e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Series number
            <input
              data-testid="verify-series"
              value={seriesNumber}
              onInput={(e) => setSeriesNumber((e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Series ID (from SERIES_STARTED)
            <input
              value={seriesId}
              onInput={(e) => setSeriesId((e.target as HTMLInputElement).value)}
            />
          </label>
        </>
      )}

      <button type="button" data-testid="verify-run" onClick={() => void runVerify()}>
        Verify
      </button>

      {error && (
        <p class="verify-page__error" data-testid="verify-error">
          {error}
        </p>
      )}

      {result && (
        <div data-testid="verify-results">
          <p data-testid="verify-commit-status">
            Commit: {result.commitValid ? "valid" : "invalid"}
          </p>
          <ul>
            {result.replays.map((row) => (
              <li key={row.index} data-testid={`verify-row-${row.index}`} data-match={row.match}>
                Result {row.index + 1}: {row.match ? "match" : "mismatch"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
