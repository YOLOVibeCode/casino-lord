/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDealerToken,
  listRecentDealerTables,
  loadDealerToken,
  saveDealerToken,
} from "./dealer-token.js";

describe("dealer-token", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("saves and loads token with metadata", () => {
    saveDealerToken("K7X2PQ", "secret", { game: "baccarat" });
    expect(loadDealerToken("K7X2PQ")).toBe("secret");

    const rows = listRecentDealerTables();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe("K7X2PQ");
    expect(rows[0]?.game).toBe("baccarat");
    expect(rows[0]?.lastOpenedAt).toBeGreaterThan(0);
  });

  it("reads legacy plain-string tokens", () => {
    localStorage.setItem("casino-lord:dealer-token:LEGACY1", "plain-token");
    expect(loadDealerToken("LEGACY1")).toBe("plain-token");
  });

  it("lists tables by most recently opened", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);

    saveDealerToken("AAAAAA", "t1", { game: "craps" });
    saveDealerToken("BBBBBB", "t2", { game: "roulette" });

    const rows = listRecentDealerTables();
    expect(rows.map((r) => r.code)).toEqual(["BBBBBB", "AAAAAA"]);
    expect(rows[1]?.lastOpenedAt).toBe(1_000);

    nowSpy.mockRestore();
  });

  it("forget removes a table entry", () => {
    saveDealerToken("FORGET1", "tok");
    clearDealerToken("FORGET1");
    expect(loadDealerToken("FORGET1")).toBeNull();
    expect(listRecentDealerTables()).toHaveLength(0);
  });
});
