import { describe, expect, it } from "vitest";
import { describeSyncError } from "./error-copy.js";

const LISTED_CODES = [
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
  "sync join timeout",
  "MIXED_SERIES",
  "DEALING",
  "NOT_VIRTUAL",
  "VIRTUAL_DISABLED",
  "not authorized",
  "player cannot emit BET_PLACED",
];

describe("describeSyncError", () => {
  it.each(LISTED_CODES)("returns copy for %s", (code) => {
    const result = describeSyncError(code);
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it("maps legacy PlayPage strings", () => {
    expect(describeSyncError("Table not found").title).toBe("Table not found");
    expect(describeSyncError("Sync server not configured").title).toBe("Sync not configured");
  });
});
