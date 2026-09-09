import { concatBytes, sha256Hex, utf8Bytes } from "./crypto/sha256.js";

/** SHA256(seed ∥ tableCode ∥ seriesId) as lowercase hex (SPEC.md §14.3). */
export function commitFor(seed: Uint8Array, tableCode: string, seriesId: string): string {
  return sha256Hex(concatBytes(seed, utf8Bytes(tableCode), utf8Bytes(seriesId)));
}

export function verifyCommit(
  seed: Uint8Array,
  tableCode: string,
  seriesId: string,
  commit: string,
): boolean {
  return commitFor(seed, tableCode, seriesId) === commit.toLowerCase();
}
