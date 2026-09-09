const PREFIX = "casino-lord:dealer-token:";

function storage(): Storage | null {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

export function saveDealerToken(code: string, token: string): void {
  storage()?.setItem(`${PREFIX}${code}`, token);
}

export function loadDealerToken(code: string): string | null {
  return storage()?.getItem(`${PREFIX}${code}`) ?? null;
}

export function clearDealerToken(code: string): void {
  storage()?.removeItem(`${PREFIX}${code}`);
}
