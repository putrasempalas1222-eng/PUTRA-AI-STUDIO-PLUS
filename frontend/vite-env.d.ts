/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_CHAT_URL?: string;
  readonly VITE_PUTRA_AI_V1_API_URL?: string;
  readonly VITE_OLLAMA_TEXT_MODEL?: string;
  readonly VITE_OLLAMA_VISION_MODEL?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
