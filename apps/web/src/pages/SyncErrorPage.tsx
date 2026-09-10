import { describeSyncError } from "../sync/error-copy.js";
import "./sync-error.css";

export interface SyncErrorPageProps {
  path?: string;
  code?: string;
}

export function SyncErrorPage({ code = "UNKNOWN" }: SyncErrorPageProps) {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const errorCode = params.get("reason") ?? code;
  const { title, body, actions } = describeSyncError(errorCode);

  return (
    <main class="sync-error" data-testid="sync-error-page">
      <h1>{title}</h1>
      <p>{body}</p>
      <div class="sync-error__actions">
        {actions.map((action) =>
          action.onRetry ? (
            <button
              key={action.label}
              type="button"
              class="sync-error__action"
              onClick={() => {
                if (typeof window !== "undefined") window.history.back();
              }}
            >
              {action.label}
            </button>
          ) : (
            <a key={action.label} class="sync-error__action" href={action.href ?? "/"}>
              {action.label}
            </a>
          ),
        )}
      </div>
    </main>
  );
}
