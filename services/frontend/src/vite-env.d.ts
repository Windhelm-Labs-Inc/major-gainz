/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_HEDERA_NETWORK: string;
  readonly VITE_RAG_MCP_URL: string;
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}