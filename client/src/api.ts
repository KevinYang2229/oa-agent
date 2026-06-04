// 對應後端 auth / conversation / form / leave API。型別共用 @oa-agent/shared（單一來源）。
import type {
  Applicant,
  Definition,
  FieldOption,
  FieldSpec,
  LeaveBalance,
  SessionStatus,
  SubmissionInfo,
} from '@oa-agent/shared';

export type {
  Applicant,
  Definition,
  FieldOption,
  FieldSpec,
  LeaveBalance,
  SessionStatus,
  SubmissionInfo,
};

export interface TurnData {
  id?: string;
  status: SessionStatus;
  values: Record<string, unknown>;
  reply: string | null;
  submission?: SubmissionInfo;
  /** 後端動態產生的建議回覆（可一鍵送出）；可能為空陣列 */
  suggestions?: string[];
}

/** PATCH /:id/fields 的回傳（TurnData + 套用/退回明細） */
export interface UpdateFieldsData extends TurnData {
  applied: string[];
  rejected: { field: string; message: string }[];
}

export interface ConversationState {
  id: string;
  formId: string;
  status: SessionStatus;
  values: Record<string, unknown>;
  submission?: SubmissionInfo;
}

interface LoginData {
  accessToken: string;
  refreshToken: string;
  user: Applicant;
}

// API 來源網域：dev 留空 → 走相對路徑由 Vite proxy 代理；
// production 設 VITE_API_BASE=https://<server-domain> 直接打後端（前後端分開部署）。
const API_ORIGIN = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

const BASE = `${API_ORIGIN}/api/v1/conversations`;
const AUTH = `${API_ORIGIN}/api/v1/auth`;

/** 帶 HTTP 狀態與後端錯誤碼的 API 錯誤，讓呼叫端能分辨 404 / 401 等情況 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ---- token 管理（access + refresh，存 localStorage）----
const ACCESS_KEY = 'oa-access-token';
const REFRESH_KEY = 'oa-refresh-token';
let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

function setTokens(a: string, r: string): void {
  accessToken = a;
  refreshToken = r;
  localStorage.setItem(ACCESS_KEY, a);
  localStorage.setItem(REFRESH_KEY, r);
}
function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// refresh 用盡仍 401 時通知 App 導回登入頁
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

function headers(userId: string): HeadersInit {
  return { 'content-type': 'application/json', 'x-user-id': userId || 'demo-user' };
}

function withAuth(init: RequestInit): RequestInit {
  const h = new Headers(init.headers);
  if (accessToken) h.set('authorization', `Bearer ${accessToken}`);
  return { ...init, headers: h };
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      json?.error?.message ?? json?.message ?? `錯誤 ${res.status}`,
      res.status,
      json?.error?.code,
    );
  }
  return json.data as T;
}

/** 用 refresh token 換新 token；成功回 true 並更新 token */
async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${AUTH}/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  const data = json?.data;
  if (!data?.accessToken || !data?.refreshToken) return false;
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

/** 受保護請求：自動帶 access token；遇 401 先嘗試 refresh 重試一次，仍失敗則登出 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await fetch(path, withAuth(init));
  if (res.status === 401 && refreshToken) {
    if (await tryRefresh()) res = await fetch(path, withAuth(init));
  }
  if (res.status === 401) {
    clearTokens();
    onUnauthorized();
  }
  return unwrap<T>(res);
}

export const auth = {
  /** 目前是否已登入（有 access token） */
  isAuthenticated: (): boolean => !!accessToken,

  /** 帳密登入 → 儲存 token、回使用者資料 */
  async login(userId: string, password: string): Promise<Applicant> {
    const res = await fetch(`${AUTH}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    });
    const data = await unwrap<LoginData>(res);
    setTokens(data.accessToken, data.refreshToken);
    return data.user;
  },

  /** 取目前登入者資料（重整時還原登入狀態；401 會經 request 自動登出） */
  me(): Promise<Applicant> {
    return request<Applicant>(`${AUTH}/me`);
  },

  /** 登出（純前端清 token；JWT 無狀態） */
  logout(): void {
    clearTokens();
  },
};

export const api = {
  /**
   * 健康檢查：探測後端 /healthz 是否可達。
   * server 能回應即代表 LLM provider 的 API key 已通過啟動驗證（AI 可正常呼叫）。
   * 公開端點、不需帶 token；任何網路/非 2xx 皆視為離線回 false。
   */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${API_ORIGIN}/healthz`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },

  /** 建立對話並起首輪 */
  start(userId: string, message: string): Promise<TurnData> {
    return request<TurnData>(BASE, {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({ message }),
    });
  },

  /** 在既有對話送一則訊息，跑一輪 */
  sendMessage(userId: string, convId: string, message: string): Promise<TurnData> {
    return request<TurnData>(`${BASE}/${convId}/messages`, {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({ message }),
    });
  },

  /** 確認畫面手動編輯欄位（不經 LLM，直接存回 session） */
  updateFields(
    userId: string,
    convId: string,
    fields: Record<string, unknown>,
  ): Promise<UpdateFieldsData> {
    return request<UpdateFieldsData>(`${BASE}/${convId}/fields`, {
      method: 'PATCH',
      headers: headers(userId),
      body: JSON.stringify({ fields }),
    });
  },

  /** 取消對話（後端把 status 設為 cancelled） */
  cancel(userId: string, convId: string): Promise<{ id: string; status: SessionStatus }> {
    return request<{ id: string; status: SessionStatus }>(`${BASE}/${convId}/cancel`, {
      method: 'POST',
      headers: headers(userId),
    });
  },

  /** 取對話完整狀態（含 formId） */
  getConversation(userId: string, convId: string): Promise<ConversationState> {
    return request<ConversationState>(`${BASE}/${convId}`, { headers: headers(userId) });
  },

  /** 取表單 Definition（schema-driven 渲染表單畫面） */
  getForm(formId: string): Promise<Definition> {
    return request<Definition>(`${API_ORIGIN}/api/v1/forms/${formId}`);
  },

  /** 取各假別剩餘時數（畫面顯示「今年度剩餘 N 小時」） */
  getLeaveBalances(userId: string): Promise<LeaveBalance[]> {
    return request<LeaveBalance[]>(`${API_ORIGIN}/api/v1/leave/balances`, {
      headers: headers(userId),
    });
  },
};
