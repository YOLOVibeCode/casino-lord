const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(time: number): string {
  let out = "";
  for (let i = 9; i >= 0; i--) {
    out = ENCODING[(time >> (i * 5)) & 31]! + out;
  }
  return out;
}

function encodeRandom(): string {
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += ENCODING[Math.floor(Math.random() * 32)]!;
  }
  return out;
}

export function newClientId(now = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}
