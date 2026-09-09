const PREFIX = "casino-lord:player-token:";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

export function savePlayerToken(code: string, token: string): void {
  storage()?.setItem(`${PREFIX}${code}`, token);
}

export function loadPlayerToken(code: string): string | null {
  return storage()?.getItem(`${PREFIX}${code}`) ?? null;
}

export function clearPlayerToken(code: string): void {
  storage()?.removeItem(`${PREFIX}${code}`);
}
