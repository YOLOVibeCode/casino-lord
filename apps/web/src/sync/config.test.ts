import { describe, expect, it } from "vitest";
import { resolveSyncUrl } from "./config.js";

describe("resolveSyncUrl", () => {
  it("returns null when unset or empty", () => {
    expect(resolveSyncUrl(undefined)).toBeNull();
    expect(resolveSyncUrl("")).toBeNull();
    expect(resolveSyncUrl("   ")).toBeNull();
  });

  it("resolves relative / to origin", () => {
    expect(resolveSyncUrl("/", "http://example.com")).toBe("http://example.com");
  });

  it("passes through absolute URLs", () => {
    expect(resolveSyncUrl("https://sync.example.com/")).toBe("https://sync.example.com");
  });
});
