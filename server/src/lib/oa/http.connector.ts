/**
 * HttpOAConnector：把表單送進真 OA 系統的 HTTP 連接器（骨架）。
 *
 * 與 stub 共用同一份 OAConnector 介面，靠 OA_CONNECTOR=http 切換、
 * OA_BASE_URL / OA_API_KEY 設定。送出守門、驗證、簽核計算等上層邏輯一律不動。
 *
 * 真 OA 規格到位後，只需調整三處（皆集中在本檔，標示為「⟶ 對接點」）：
 *   1. ENDPOINTS：各表單的實際路徑
 *   2. toOABody：本系統 payload → OA 期望的 request body 欄位映射
 *   3. fromOAResponse：OA 回應 → OASubmitResult（id / status 欄位名）
 */
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { AppError } from '@/utils/app-error';
import type {
  BusinessTripDomesticPayload,
  LeaveBalance,
  LeaveRequestPayload,
  OAConnector,
  OASubmitResult,
  OutingRegistrationPayload,
} from './types';

const REQUEST_TIMEOUT_MS = 15_000;

/** ⟶ 對接點 1：各表單在真 OA 的端點路徑（規格到位後修正） */
const ENDPOINTS = {
  leave: '/api/leave-requests',
  outing: '/api/outing-registrations',
  businessTrip: '/api/business-trips',
  leaveBalance: '/api/leave-balances',
} as const;

/** 真 OA 回應形狀未定；先以寬鬆型別承接，於 fromOAResponse 收斂 */
interface OARawResponse {
  id?: string;
  requestId?: string;
  status?: string;
  [k: string]: unknown;
}

/** OA_BASE_URL 必填（由 env superRefine 在 boot 時保證），此處去尾斜線 */
function baseUrl(): string {
  if (!env.OA_BASE_URL) {
    throw AppError.internal('OA_BASE_URL is required when OA_CONNECTOR=http');
  }
  return env.OA_BASE_URL.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
  return env.OA_API_KEY ? { authorization: `Bearer ${env.OA_API_KEY}` } : {};
}

/**
 * ⟶ 對接點 2：本系統 payload → OA request body。
 * 真 OA 欄位名稱／結構未定，先原樣帶過；規格到位後在此做欄位映射與轉換。
 */
function toOABody(payload: unknown): unknown {
  return payload;
}

/**
 * ⟶ 對接點 3：OA 回應 → 上層用的 OASubmitResult。
 * 規格到位後對應真實的 id / status 欄位名與值。
 */
function fromOAResponse(raw: OARawResponse): OASubmitResult {
  const oaRequestId = raw.requestId ?? raw.id;
  if (!oaRequestId) {
    throw AppError.internal('OA response missing request id');
  }
  return { oaRequestId: String(oaRequestId), status: normalizeStatus(raw.status), raw };
}

function normalizeStatus(s: unknown): OASubmitResult['status'] {
  const v = String(s).toLowerCase();
  if (v === 'accepted' || v === 'pending' || v === 'rejected') return v;
  return 'pending'; // 未知狀態先當 pending，待真規格收斂
}

/** 共用送出：POST 表單 payload 到指定端點，含逾時與錯誤處理 */
async function postForm(path: string, payload: unknown): Promise<OASubmitResult> {
  const url = `${baseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(toOABody(payload)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ err, url }, '[oa:http] request failed (network/timeout)');
    throw AppError.internal('OA system request failed');
  }

  const raw = (await res.json().catch(() => ({}))) as OARawResponse;
  if (!res.ok) {
    logger.error({ url, status: res.status, raw }, '[oa:http] non-2xx from OA');
    throw AppError.internal(`OA system rejected request (HTTP ${res.status})`);
  }
  logger.info({ url, oaRequestId: raw.requestId ?? raw.id }, '[oa:http] form submitted');
  return fromOAResponse(raw);
}

export const httpOAConnector: OAConnector = {
  name: 'http',

  submitLeaveRequest(payload: LeaveRequestPayload): Promise<OASubmitResult> {
    return postForm(ENDPOINTS.leave, payload);
  },

  submitOutingRegistration(payload: OutingRegistrationPayload): Promise<OASubmitResult> {
    return postForm(ENDPOINTS.outing, payload);
  },

  submitBusinessTripDomestic(payload: BusinessTripDomesticPayload): Promise<OASubmitResult> {
    return postForm(ENDPOINTS.businessTrip, payload);
  },

  async getLeaveBalance(userId: string): Promise<LeaveBalance[]> {
    const url = `${baseUrl()}${ENDPOINTS.leaveBalance}?userId=${encodeURIComponent(userId)}`;
    try {
      const res = await fetch(url, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as LeaveBalance[];
    } catch (err) {
      // 降級：查不到額度不應阻斷對話，回空陣列（畫面則不顯示剩餘時數）
      logger.error({ err, url }, '[oa:http] getLeaveBalance failed; degrading to empty');
      return [];
    }
  },
};
