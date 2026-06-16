/**
 * resolveTenant：從請求解析 API Key → 租戶，掛到 req.tenant。
 *
 * 金鑰來源（依序）：x-api-key header → Authorization: ApiKey <key> → query ?key=（widget iframe 用）。
 * 未帶 key 落到預設租戶（向後相容）；帶了無效 key 則由 tenantService 丟 401。
 *
 * 注意：這與 requireAuth（JWT 使用者登入）是兩個正交維度——
 * tenant=「哪個客戶/整合方」、user=「哪個終端使用者」。可同時存在。
 */
import type { NextFunction, Request, Response } from 'express';
import { tenantService } from '@/modules/tenant/tenant.service';

function extractApiKey(req: Request): string | undefined {
  const headerKey = req.header('x-api-key');
  if (headerKey) return headerKey.trim();

  const auth = req.header('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  if (scheme === 'ApiKey' && token) return token.trim();

  // widget iframe 走 query（瀏覽器載入 iframe 無法帶自訂 header）；只接受 pk_（公開金鑰）
  const queryKey = req.query.key;
  if (typeof queryKey === 'string' && queryKey.startsWith('pk_')) return queryKey;

  return undefined;
}

export function resolveTenant(req: Request, _res: Response, next: NextFunction): void {
  const resolved = tenantService.resolve(extractApiKey(req));
  req.tenant = resolved.tenant;
  req.apiKeyType = resolved.keyType;
  next();
}
