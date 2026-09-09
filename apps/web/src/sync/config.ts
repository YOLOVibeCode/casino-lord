const RAW = import.meta.env.VITE_SYNC_URL;

export function resolveSyncUrl(raw: string | undefined = RAW, origin?: string): string | null {
  if (raw === undefined || raw === null || raw.trim() === "") {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed === "/" || trimmed === "./") {
    if (origin !== undefined) {
      return origin.replace(/\/$/, "");
    }
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return "http://127.0.0.1:3000";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }

  if (trimmed.startsWith("/")) {
    const base =
      origin ?? (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");
    return `${base.replace(/\/$/, "")}${trimmed}`.replace(/\/$/, "");
  }

  return trimmed.replace(/\/$/, "");
}

export function isSyncConfigured(): boolean {
  return resolveSyncUrl() !== null;
}

export function getSyncBaseUrl(origin?: string): string {
  const url = resolveSyncUrl(RAW, origin);
  if (!url) {
    throw new Error("Sync server not configured");
  }
  return url;
}
