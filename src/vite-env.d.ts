/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAKE_SUBMIT_WEBHOOK_URL?: string;
  readonly VITE_MAKE_DRESSES_WEBHOOK_URL?: string;
  readonly VITE_MAKE_DRESS_RESERVATIONS_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
