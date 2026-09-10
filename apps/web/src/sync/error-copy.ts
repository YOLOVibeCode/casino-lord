export const SYNC_JOIN_TIMEOUT = "sync join timeout";

export type SyncErrorAction = "retry" | "home" | "display" | "takeover";

export interface SyncErrorCopy {
  title: string;
  body: string;
  actions: SyncErrorAction[];
}

const GENERIC: SyncErrorCopy = {
  title: "Unable to join this table",
  body: "Something went wrong while connecting. Check your link and try again.",
  actions: ["retry", "home"],
};

const JOIN_FAILED_5XX: SyncErrorCopy = {
  title: "Server unavailable",
  body: "The sync server could not complete your request. Wait a moment and try again.",
  actions: ["retry", "home"],
};

const COPY: Record<string, SyncErrorCopy> = {
  NOT_FOUND: {
    title: "Table not found",
    body: "That table code was not found. It may have expired or been mistyped.",
    actions: ["home"],
  },
  BAD_TOKEN: {
    title: "Invalid dealer link",
    body: "The dealer token in this link is invalid or expired. Ask the host for a fresh dealer link.",
    actions: ["home"],
  },
  PLAYER_BAD_TOKEN: {
    title: "Invalid join link",
    body: "This join link is no longer valid. Enter your name to join as a new player.",
    actions: [],
  },
  SESSION_ENDED: {
    title: "Session ended",
    body: "This table session has ended. You can still review history, but no new results can be recorded.",
    actions: ["home"],
  },
  DEALER_ACTIVE: {
    title: "Another device is dealing this table",
    body: "A dealer is already connected on another phone or tablet. You can take over dealing or open this table as a display.",
    actions: ["takeover", "display", "home"],
  },
  TABLE_FULL: {
    title: "Table is full",
    body: "This table has reached the maximum number of players. Ask the dealer to remove someone or try again later.",
    actions: ["retry", "home"],
  },
  JOINING_CLOSED: {
    title: "Joining closed",
    body: "The dealer has closed joining for this table. Ask them to reopen it if you still want to play.",
    actions: ["home"],
  },
  INVALID_NAME: {
    title: "Invalid name",
    body: "Enter a display name between 2 and 16 characters.",
    actions: ["retry"],
  },
  INVALID_COLOR: {
    title: "Invalid colour",
    body: "Pick one of the available player colours and try again.",
    actions: ["retry"],
  },
  PLAYERS_DISABLED: {
    title: "Players not enabled",
    body: "This table is not accepting players. Use display mode or ask the dealer to enable player mode.",
    actions: ["display", "home"],
  },
  UNSUPPORTED_GAME: {
    title: "Unsupported game",
    body: "This table uses a game that is not available in your app version.",
    actions: ["home"],
  },
  NOT_CONFIGURED: {
    title: "Sync server not configured",
    body: "This app is not connected to a sync server. Set VITE_SYNC_URL or deploy with the bundled sync service.",
    actions: ["home"],
  },
  "rate limit exceeded": {
    title: "Too many requests",
    body: "You have sent too many requests in a short time. Wait a few seconds and try again.",
    actions: ["retry", "home"],
  },
  [SYNC_JOIN_TIMEOUT]: {
    title: "Connection timed out",
    body: "Could not reach the sync server in time. Check your network and try again.",
    actions: ["retry", "home"],
  },
  MIXED_SERIES: {
    title: "Series mismatch",
    body: "This action does not match the current series. Refresh or start a new series from the dealer menu.",
    actions: ["retry", "home"],
  },
  DEALING: {
    title: "Deal in progress",
    body: "Wait for the current virtual deal or roll to finish before trying again.",
    actions: ["retry"],
  },
  NOT_VIRTUAL: {
    title: "Not a virtual table",
    body: "This action is only available on tables with virtual outcomes enabled.",
    actions: ["home"],
  },
  VIRTUAL_DISABLED: {
    title: "Virtual outcomes disabled",
    body: "The server has virtual outcomes turned off. Record physical results instead.",
    actions: ["home"],
  },
  "not authorized": {
    title: "Not allowed",
    body: "You do not have permission to perform that action on this table.",
    actions: ["home"],
  },
  "client commit not allowed": {
    title: "Commit not allowed",
    body: "Fairness commitments must come from the server on this table.",
    actions: ["home"],
  },
  DECLINED: {
    title: "Join declined",
    body: "The dealer declined your request to join. Choose another table or ask the dealer to approve you.",
    actions: ["retry", "home"],
  },
  demoted: {
    title: "Another device took over",
    body: "Another dealer device is now active. You can take back control or open display mode.",
    actions: ["takeover", "display", "home"],
  },
  "no virtual dealer": {
    title: "Virtual dealer unavailable",
    body: "The virtual dealer is not running for this table. Ask the host to restart the sync service.",
    actions: ["retry", "home"],
  },
  "awaiting action": {
    title: "Waiting for action",
    body: "A player or the virtual dealer must act before you can continue.",
    actions: ["retry"],
  },
  "virtual step failed": {
    title: "Virtual step failed",
    body: "The virtual dealer could not complete that step. Try again or record the result manually.",
    actions: ["retry", "home"],
  },
  "invalid request body": {
    title: "Invalid request",
    body: "The server rejected the request. Refresh the page and try again.",
    actions: ["retry", "home"],
  },
  "invalid series": {
    title: "Series not found",
    body: "That series number does not exist on this table.",
    actions: ["home"],
  },
  "series not found": {
    title: "Series not found",
    body: "That series is not available for export or verification.",
    actions: ["home"],
  },
  "module missing": {
    title: "Server misconfigured",
    body: "The sync server is missing a game module. Contact the host.",
    actions: ["home"],
  },
  NOT_PENDING: {
    title: "Player not pending",
    body: "That player is no longer waiting for approval.",
    actions: ["retry"],
  },
  INVALID_TABLE_CODE: {
    title: "Invalid table code",
    body: "Enter a valid table code from the host.",
    actions: ["home"],
  },
  TABLE_LOOKUP_FAILED: {
    title: "Could not load table",
    body: "Could not reach the sync server to look up this table. Check your connection and try again.",
    actions: ["retry", "home"],
  },
};

export const CANONICAL_SYNC_ERROR_CODES = [
  "NOT_FOUND",
  "BAD_TOKEN",
  "SESSION_ENDED",
  "DEALER_ACTIVE",
  "TABLE_FULL",
  "JOINING_CLOSED",
  "INVALID_NAME",
  "INVALID_COLOR",
  "PLAYERS_DISABLED",
  "UNSUPPORTED_GAME",
  "NOT_CONFIGURED",
  "rate limit exceeded",
  "join failed: 500",
  "join failed: 503",
  SYNC_JOIN_TIMEOUT,
  "MIXED_SERIES",
  "DEALING",
  "NOT_VIRTUAL",
  "VIRTUAL_DISABLED",
  "not authorized",
  "client commit not allowed",
  "DECLINED",
  "demoted",
  "no virtual dealer",
  "awaiting action",
  "virtual step failed",
  "invalid request body",
  "invalid series",
  "series not found",
  "module missing",
  "NOT_PENDING",
  "INVALID_TABLE_CODE",
  "TABLE_LOOKUP_FAILED",
] as const;

function normalizeCode(code: string): string {
  const trimmed = code.trim();
  if (/^join failed: 5\d{2}$/.test(trimmed)) {
    return "join failed: 5xx";
  }
  return trimmed;
}

export function describeSyncError(code: string): SyncErrorCopy {
  const normalized = normalizeCode(code);
  if (normalized === "join failed: 5xx") {
    return JOIN_FAILED_5XX;
  }
  return COPY[normalized] ?? GENERIC;
}

export function isDefinitiveJoinError(code: string): boolean {
  if (code === "DEALER_ACTIVE" || code === SYNC_JOIN_TIMEOUT) {
    return false;
  }
  return true;
}

export function isGenericSyncError(copy: SyncErrorCopy): boolean {
  return copy.title === GENERIC.title && copy.body === GENERIC.body;
}
