/// <reference types="vite/client" />

declare const __BUILD_HASH__: string;

interface ImportMetaEnv {
  readonly VITE_SYNC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
