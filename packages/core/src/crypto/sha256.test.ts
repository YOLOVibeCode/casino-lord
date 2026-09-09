import { describe, expect, it } from "vitest";
import { hexToBytes, sha256Hex, utf8Bytes } from "./sha256.js";

describe("sha256", () => {
  it("matches FIPS 180-4 empty string vector", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches FIPS 180-4 abc vector", () => {
    expect(sha256Hex(utf8Bytes("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches FIPS 180-4 long message vector", () => {
    const msg = utf8Bytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq");
    expect(sha256Hex(msg)).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("matches one-shot binary vector", () => {
    const input = hexToBytes("0102030405");
    expect(sha256Hex(input)).toBe(
      "74f81fe167d99b4cb41d6d0ccda82278caee9f3e2f25d5e5a3936ff3dcec60d0",
    );
  });
});
