/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_PROXY_URL?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
