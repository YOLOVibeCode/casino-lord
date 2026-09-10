import { useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { resolveSyncUrl } from "../sync/config.js";
import { getGame } from "../table/games.js";
import {
  parseExportForImport,
  replayVirtualSeries,
  verifyFromFairnessApi,
} from "../verify/replay-fairness.js";

interface FairnessSeriesOption {
  number: number;
  seriesId: string;
  commit: string | null;
  seedRevealed: boolean;
}

export function VerifyPage(_props: { path?: string }) {
  const route = useRoute();
  const initialCode = typeof route.query?.code === "string" ? route.query.code : "";

  const [mode, setMode] = useState<"paste" | "fetch">(initialCode ? "fetch" : "paste");
  const [exportText, setExportText] = useState("");
  const [tableCode, setTableCode] = useState(initialCode);
  const [seriesOptions, setSeriesOptions] = useState<FairnessSeriesOption[]>([]);
  const [selectedSeriesNumber, setSelectedSeriesNumber] = useState("1");
  const [result, setResult] = useState<{
    commitValid: boolean;
    replays: Array<{ index: number; match: boolean }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "fetch") return;
    const code = tableCode.trim().toUpperCase();
    if (!code) {
      setSeriesOptions([]);
      return;
    }
    const baseUrl = resolveSyncUrl(undefined, window.location.origin);
    if (!baseUrl) return;

    void fetch(`${baseUrl}/tables/${code}/fairness?list=1`)
      .then(async (response) => {
        if (!response.ok) {
          setSeriesOptions([]);
          return;
        }
        const body = (await response.json()) as { series: FairnessSeriesOption[] };
        setSeriesOptions(body.series);
        if (
          body.series.length > 0 &&
          !body.series.some((s) => String(s.number) === selectedSeriesNumber)
        ) {
          setSelectedSeriesNumber(String(body.series[0]!.number));
        }
      })
      .catch(() => {
        setSeriesOptions([]);
      });
  }, [mode, tableCode, selectedSeriesNumber]);

  const runVerify = async (): Promise<void> => {
    setError(null);
    setResult(null);

    if (mode === "fetch") {
      const baseUrl = resolveSyncUrl(undefined, window.location.origin);
      if (!baseUrl) {
        setError("Sync server not configured");
        return;
      }
      const code = tableCode.trim().toUpperCase();
      const series = Number(selectedSeriesNumber);
      const response = await fetch(`${baseUrl}/tables/${code}/fairness?series=${series}`);
      if (!response.ok) {
        setError(`Fairness fetch failed: ${response.status}`);
        return;
      }
      const body = (await response.json()) as {
        seriesId: string;
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
      const verified = verifyFromFairnessApi({
        code,
        seriesId: body.seriesId,
        commit: body.commit,
        seedHex: body.seed,
        game: game as "baccarat",
        rules,
        expectedDraws: body.draws as Array<{ from: number; to: number }>,
      });
      setResult(verified);
      return;
    }

    const parsed = parseExportForImport(exportText);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    if (parsed.header.source !== "virtual") {
      setError("Only virtual series can be fairness-verified");
      return;
    }
    if (!parsed.header.seed || !parsed.header.seriesId || !parsed.header.commit) {
      setError("Virtual export must include commit, seriesId, and seed in the header");
      return;
    }
    const entry = getGame(parsed.header.game);
    if (!entry?.module?.virtual) {
      setError("Game module has no virtual handler");
      return;
    }
    const imported = entry.module.importSeries(parsed.body, parsed.header.rules);
    if ("error" in imported) {
      setError(imported.error);
      return;
    }
    const commitValid = await import("@casino-lord/core").then(({ verifyCommit, hexToBytes }) =>
      verifyCommit(
        hexToBytes(parsed.header.seed!),
        parsed.header.code,
        parsed.header.seriesId!,
        parsed.header.commit!,
      ),
    );
    const replayed = replayVirtualSeries({
      module: entry.module,
      rules: parsed.header.rules,
      code: parsed.header.code,
      seriesId: parsed.header.seriesId!,
      seedHex: parsed.header.seed!,
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
        <textarea
          data-testid="verify-export"
          value={exportText}
          onInput={(e) => setExportText((e.target as HTMLTextAreaElement).value)}
          rows={8}
          placeholder="Paste #casino-lord export…"
        />
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
            Series
            <select
              data-testid="verify-series-select"
              value={selectedSeriesNumber}
              onChange={(e) => setSelectedSeriesNumber((e.target as HTMLSelectElement).value)}
            >
              {seriesOptions.length === 0 ? (
                <option value={selectedSeriesNumber}>Series {selectedSeriesNumber}</option>
              ) : (
                seriesOptions.map((option) => (
                  <option key={option.number} value={String(option.number)}>
                    Series {option.number}
                    {option.seedRevealed ? " (revealed)" : ""}
                  </option>
                ))
              )}
            </select>
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
