export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserStorage(): StorageLike | null {
  const candidate = globalThis.localStorage;
  if (
    candidate !== null &&
    typeof candidate === "object" &&
    typeof candidate.getItem === "function"
  ) {
    return candidate;
  }
  return null;
}
