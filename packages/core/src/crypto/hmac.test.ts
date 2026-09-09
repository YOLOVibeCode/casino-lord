import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes, utf8Bytes } from "./sha256.js";
import { hmacSha256 } from "./hmac.js";

describe("hmacSha256", () => {
  it("matches RFC 4231 test case 1", () => {
    const key = new Uint8Array(20).fill(0x0b);
    const data = utf8Bytes("Hi There");
    expect(bytesToHex(hmacSha256(key, data))).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );
  });

  it("matches RFC 4231 test case 2", () => {
    const key = utf8Bytes("Jefe");
    const data = utf8Bytes("what do ya want for nothing?");
    expect(bytesToHex(hmacSha256(key, data))).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("matches RFC 4231 test case 3 with long key", () => {
    const key = new Uint8Array(20).fill(0xaa);
    const data = new Uint8Array(50).fill(0xdd);
    expect(bytesToHex(hmacSha256(key, data))).toBe(
      "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe",
    );
  });

  it("hashes keys longer than block size", () => {
    const key = hexToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20");
    const data = utf8Bytes("test");
    expect(bytesToHex(hmacSha256(key, data))).toHaveLength(64);
  });
});
