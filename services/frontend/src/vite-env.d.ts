/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_RAG_BASE: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_HEDERA_NETWORK: string;
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}