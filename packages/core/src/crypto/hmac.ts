import { concatBytes, sha256 } from "./sha256.js";

const BLOCK_SIZE = 64;

function padKey(key: Uint8Array): Uint8Array {
  if (key.length > BLOCK_SIZE) {
    return sha256(key);
  }
  if (key.length === BLOCK_SIZE) {
    return key;
  }
  const out = new Uint8Array(BLOCK_SIZE);
  out.set(key);
  return out;
}

/** HMAC-SHA256 (RFC 4231). */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockKey = padKey(key);
  const oKeyPad = new Uint8Array(BLOCK_SIZE);
  const iKeyPad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    oKeyPad[i] = blockKey[i]! ^ 0x5c;
    iKeyPad[i] = blockKey[i]! ^ 0x36;
  }
  return sha256(concatBytes(oKeyPad, sha256(concatBytes(iKeyPad, message))));
}
