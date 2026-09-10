import { describe, expect, it } from "vitest";
import {
  CANONICAL_SYNC_ERROR_CODES,
  describeSyncError,
  isGenericSyncError,
  SYNC_JOIN_TIMEOUT,
} from "./error-copy.js";

describe("describeSyncError", () => {
  it("covers every canonical code with non-generic copy", () => {
    for (const code of CANONICAL_SYNC_ERROR_CODES) {
      const copy = describeSyncError(code);
      expect(isGenericSyncError(copy), `expected mapped copy for ${code}`).toBe(false);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.actions.length).toBeGreaterThan(0);
    }
  });

  it("maps any join failed 5xx status to server-unavailable copy", () => {
    const copy = describeSyncError("join failed: 502");
    expect(copy.title).toBe("Server unavailable");
    expect(isGenericSyncError(copy)).toBe(false);
  });

  it("falls back to generic copy for unknown codes", () => {
    const copy = describeSyncError("TOTALLY_UNKNOWN_XYZ");
    expect(isGenericSyncError(copy)).toBe(true);
  });

  it("exports sync join timeout constant", () => {
    expect(SYNC_JOIN_TIMEOUT).toBe("sync join timeout");
    expect(describeSyncError(SYNC_JOIN_TIMEOUT).title).toBe("Connection timed out");
  });
});
