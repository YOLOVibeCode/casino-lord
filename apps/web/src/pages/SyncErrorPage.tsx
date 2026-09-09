import "./sync-error.css";

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "That table code was not found. It may have expired.",
  BAD_TOKEN: "The dealer token is invalid. Ask the host for a new dealer link.",
  SESSION_ENDED: "This table session has ended.",
};

export interface SyncErrorPageProps {
  path?: string;
  code?: string;
}

export function SyncErrorPage({ code = "UNKNOWN" }: SyncErrorPageProps) {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const errorCode = params.get("reason") ?? code;
  const message = MESSAGES[errorCode] ?? "Unable to join this table.";

  return (
    <main class="sync-error" data-testid="sync-error-page">
      <h1>Cannot join table</h1>
      <p>{message}</p>
      <a href="/">Home</a>
    </main>
  );
}
