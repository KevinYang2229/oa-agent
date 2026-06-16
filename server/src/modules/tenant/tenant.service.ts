/**
 * 租戶解析服務：把外部傳入的 API Key 對應到租戶，並提供來源網域驗證。
 *
 * 向後相容：未帶 key（或帶到不存在的 key）一律回預設租戶，舊 widget 照常運作。
 * 待新機制穩定後，可改成「未帶 key 即 401」收緊。
 */
import { AppError } from '@/utils/app-error';
import { DEFAULT_TENANT_ID, tenantStore } from './tenant.store';
import type { ApiKeyType, Tenant } from './tenant.types';

export interface ResolvedTenant {
  tenant: Tenant;
  /** 帶入的金鑰種類；未帶 key 落到預設租戶時為 undefined */
  keyType?: ApiKeyType;
}

export const tenantService = {
  /**
   * 依金鑰字串解析租戶。
   * - 未帶 key → 預設租戶（向後相容）
   * - 帶了 key 但無效 / 已撤銷 → 401（明確錯誤，避免悄悄落到預設租戶造成混淆）
   */
  resolve(rawKey?: string): ResolvedTenant {
    if (!rawKey) {
      const tenant = tenantStore.getTenant(DEFAULT_TENANT_ID);
      if (!tenant) throw AppError.internal('Default tenant missing');
      return { tenant };
    }
    const apiKey = tenantStore.getApiKey(rawKey);
    if (!apiKey || apiKey.revokedAt) {
      throw AppError.unauthorized('Invalid or revoked API key');
    }
    const tenant = tenantStore.getTenant(apiKey.tenantId);
    if (!tenant) throw AppError.unauthorized('API key has no tenant');
    return { tenant, keyType: apiKey.type };
  },

  /** 來源網域是否被該租戶允許（['*'] 代表全放行） */
  isOriginAllowed(tenant: Tenant, origin?: string): boolean {
    if (tenant.allowedOrigins.includes('*')) return true;
    if (!origin) return false;
    const normalized = origin.replace(/\/+$/, '');
    return tenant.allowedOrigins.some((o) => o.replace(/\/+$/, '') === normalized);
  },

  /**
   * 來源網域是否被「任一」租戶允許——動態 CORS 用。
   * 預設租戶為 ['*'] 時恆為 true，維持改造前的全放行行為（向後相容）。
   * 真正的資料隔離由路由層的 API Key（resolveTenant）把關，CORS 只是瀏覽器層的閘門。
   */
  isOriginAllowedByAnyTenant(origin: string): boolean {
    return tenantStore.listTenants().some((t) => this.isOriginAllowed(t, origin));
  },
};
