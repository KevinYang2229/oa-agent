/**
 * 每租戶 rate limit：以 tenantId 為計數 key（沿用 env 的 RATE_LIMIT_* 設定）。
 *
 * 須掛在 resolveTenant 之後（才有 req.tenant）。各租戶獨立計數、互不影響；
 * 預設租戶（向後相容流量）共用一個 bucket——已知取捨：同預設租戶的不同來源會互相分享配額，
 * 之後可改 key 為 `${tenantId}:${user}` 或接每租戶自訂上限收斂。
 */
import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';

export const tenantRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.tenant?.id ?? 'default',
});
