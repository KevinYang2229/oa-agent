/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** production 設為後端絕對網址（如 https://api.example.com）；dev 留空走相對 /api（vite proxy） */
  readonly VITE_API_BASE?: string;
  /** production 設為 widget client（聊天前端）絕對網址（如 https://widget.example.com），供外觀預覽 iframe 使用；dev 留空走 localhost:5173 */
  readonly VITE_WIDGET_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
