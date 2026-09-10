import { useLocation } from "preact-iso";
import { loadDealerToken } from "../sync/dealer-token.js";
import { describeSyncError, type SyncErrorAction } from "../sync/error-copy.js";
import "./sync-error.css";

export interface SyncErrorPageProps {
  path?: string;
  code?: string;
}

const ACTION_LABELS: Record<SyncErrorAction, string> = {
  retry: "Try again",
  home: "Home",
  display: "Open as Display",
  takeover: "Take over",
};

export function SyncErrorPage({ code: defaultCode = "UNKNOWN" }: SyncErrorPageProps) {
  const { route } = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const reason = params.get("reason") ?? defaultCode;
  const tableCode = params.get("code") ?? "";
  const role = params.get("role") ?? "";
  const copy = describeSyncError(reason);

  const runAction = (action: SyncErrorAction): void => {
    switch (action) {
      case "home":
        route("/");
        return;
      case "display":
        if (tableCode) {
          route(`/display/${tableCode}`);
        }
        return;
      case "takeover":
        if (tableCode) {
          const token = loadDealerToken(tableCode);
          route(token ? `/dealer/${tableCode}?t=${encodeURIComponent(token)}` : `/dealer/${tableCode}`);
        }
        return;
      case "retry":
        if (tableCode && role === "dealer") {
          const token = loadDealerToken(tableCode);
          route(
            token ? `/dealer/${tableCode}?t=${encodeURIComponent(token)}` : `/dealer/${tableCode}`,
          );
          return;
        }
        if (tableCode && role === "display") {
          route(`/display/${tableCode}`);
          return;
        }
        if (tableCode && role === "player") {
          route(`/play/${tableCode}`);
          return;
        }
        if (typeof window !== "undefined") {
          window.location.reload();
        }
        return;
    }
  };

  return (
    <main class="sync-error" data-testid="sync-error-page">
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <div class="sync-error__actions">
        {copy.actions.map((action) => (
          <button
            key={action}
            type="button"
            class="sync-error__btn"
            data-testid={`sync-error-action-${action}`}
            onClick={() => runAction(action)}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </main>
  );
}
