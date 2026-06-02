/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 後端 API 來源網域（前後端分開部署時設定，例：https://oa-agent-server.zeabur.app）。
   *  dev 留空 → 走相對路徑由 Vite proxy 代理到 localhost:3000。 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
