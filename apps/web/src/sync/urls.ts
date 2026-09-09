import { getSyncBaseUrl } from "./config.js";

export function tableUrl(path: string): string {
  const base = getSyncBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
