/**
 * 嵌入模式設定：解析 widget iframe URL 上的查詢參數。
 *
 * widget.js 會把宿主頁的 data-* 設定轉成 query：
 *   /?embed=1&key=pk_xxx&form=leave-request&locale=zh-Hant&theme=dark&userToken=<jwt>
 *
 * 全部選填——未帶任何參數時等同改造前的純 ?embed=1 行為（向後相容）。
 */
import type { TenantAppearance } from '@oa-agent/shared';

type Theme = 'light' | 'dark';

const params = new URLSearchParams(window.location.search);

function pick(name: string): string | null {
  const v = params.get(name);
  return v && v.trim() ? v.trim() : null;
}

export const embedConfig = {
  /** 是否為嵌入模式（widget iframe 載入） */
  embed: params.get('embed') === '1',
  /** 租戶公開金鑰（pk_…）；帶上後所有 API 請求附 x-api-key 供後端解析租戶 */
  apiKey: pick('key'),
  /** 預選表單類型 */
  formId: pick('form'),
  /** 介面語言（zh-Hant / en…） */
  locale: pick('locale'),
  /** 外觀模式 */
  theme: (pick('theme') as Theme | null) ?? null,
  /** SSO handoff：宿主簽發的終端使用者 token，換發本系統 token（免內部帳密登入） */
  userToken: pick('userToken'),
};

/**
 * 讀後端外觀（依 apiKey 對應租戶）。失敗或未帶 key 回 {}。
 * 與 data-* 合併由呼叫端處理：data-* 優先。
 */
export async function fetchAppearance(): Promise<TenantAppearance> {
  if (!embedConfig.apiKey) return {};
  try {
    const url = `/api/v1/widget/config?key=${encodeURIComponent(embedConfig.apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = (await res.json()) as { data?: { appearance?: TenantAppearance } };
    return json.data?.appearance ?? {};
  } catch {
    return {};
  }
}
