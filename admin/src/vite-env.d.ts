/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** production 設為後端絕對網址（如 https://api.example.com）；dev 留空走相對 /api（vite proxy） */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
