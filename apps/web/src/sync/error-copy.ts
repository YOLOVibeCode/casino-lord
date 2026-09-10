export interface SyncErrorAction {
  label: string;
  href?: string;
  onRetry?: boolean;
}

export interface SyncErrorCopy {
  title: string;
  body: string;
  actions: SyncErrorAction[];
}

const DEFAULT_ACTIONS: SyncErrorAction[] = [
  { label: "Try again", onRetry: true },
  { label: "Home", href: "/" },
];

function copy(title: string, body: string, actions = DEFAULT_ACTIONS): SyncErrorCopy {
  return { title, body, actions };
}

const EXACT: Record<string, SyncErrorCopy> = {
  NOT_FOUND: copy(
    "Table not found",
    "That table code was not found. It may have expired or been mistyped.",
  ),
  BAD_TOKEN: copy(
    "Invalid link",
    "This join link is invalid or expired. Ask the host for a new link.",
  ),
  SESSION_ENDED: copy(
    "Session ended",
    "This table session has ended. You can still review the final state if you were connected.",
  ),
  DEALER_ACTIVE: copy(
    "Another dealer is active",
    "Another device is already dealing this table.",
    [{ label: "Home", href: "/" }],
  ),
  TABLE_FULL: copy("Table full", "This table has reached its player limit."),
  JOINING_CLOSED: copy("Joining closed", "The dealer has closed joining for this table."),
  INVALID_NAME: copy(
    "Invalid name",
    "Display names must be 2–16 characters. Choose a shorter or longer name.",
  ),
  INVALID_COLOR: copy(
    "Colour taken",
    "That colour is already in use at this table. Pick another colour.",
  ),
  PLAYERS_DISABLED: copy(
    "Players not enabled",
    "Player mode is not enabled on this table.",
  ),
  UNSUPPORTED_GAME: copy(
    "Unsupported game",
    "This table's game is not supported on this device.",
  ),
  NOT_CONFIGURED: copy(
    "Sync not configured",
    "The sync server is not configured. Set VITE_SYNC_URL or use a hosted deployment.",
  ),
  MIXED_SERIES: copy(
    "Virtual table only",
    "Manual results cannot be recorded on a virtual table.",
  ),
  DEALING: copy(
    "Dealing in progress",
    "Wait for the current deal to finish before taking that action.",
  ),
  NOT_VIRTUAL: copy(
    "Not a virtual table",
    "That action is only available on virtual tables.",
  ),
  VIRTUAL_DISABLED: copy(
    "Virtual disabled",
    "Virtual dealing is disabled for this table.",
  ),
  OFFLINE: copy(
    "Offline",
    "You are offline. Reconnect to continue.",
  ),
  DECLINED: copy(
    "Join declined",
    "The dealer declined your join request.",
  ),
  demoted: copy(
    "Dealer disconnected",
    "Another device took over dealing this table.",
    [{ label: "Home", href: "/" }],
  ),
  "not authorized": copy(
    "Not allowed",
    "You are not allowed to perform that action on this table.",
  ),
  "rate limit exceeded": copy(
    "Too many requests",
    "Please wait a moment and try again.",
  ),
  "sync join timeout": copy(
    "Connection timed out",
    "Could not connect to the table in time. Check your network and try again.",
  ),
};

function normalizeCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("join failed:")) {
    const status = trimmed.slice("join failed:".length).trim();
    if (/^5\d\d$/.test(status)) return "join_failed_5xx";
    return trimmed;
  }
  if (trimmed === "Table not found") return "NOT_FOUND";
  if (trimmed === "Sync server not configured") return "NOT_CONFIGURED";
  if (trimmed === "Invalid table code") return "INVALID_CODE";
  if (trimmed === "Player mode is not enabled on this table") return "PLAYERS_DISABLED";
  if (trimmed === "Unsupported game") return "UNSUPPORTED_GAME";
  if (trimmed === "Could not load table") return "LOAD_FAILED";
  if (trimmed.startsWith("name must be")) return "INVALID_NAME";
  return trimmed;
}

export function describeSyncError(rawCode: string): SyncErrorCopy {
  const code = normalizeCode(rawCode);

  if (code === "join_failed_5xx") {
    return copy(
      "Server error",
      "The sync server encountered an error while joining. Try again in a moment.",
    );
  }

  if (code === "INVALID_CODE") {
    return copy("Invalid code", "Enter a valid 6-character table code.");
  }

  if (code === "LOAD_FAILED") {
    return copy("Could not load table", "Could not reach the sync server. Check your connection.");
  }

  const exact = EXACT[code];
  if (exact) return exact;

  if (
    code.startsWith("player cannot emit") ||
    code.startsWith("dealer cannot emit") ||
    code.startsWith("display cannot emit") ||
    code.startsWith("cannot update another player") ||
    code.startsWith("cannot act for another player") ||
    code.startsWith("bet playerId mismatch")
  ) {
    return EXACT["not authorized"]!;
  }

  return copy("Unable to join", "Unable to join this table. Try again or return home.");
}
