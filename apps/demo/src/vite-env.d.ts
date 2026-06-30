/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FA_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
