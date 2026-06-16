import type { TenantAppearance } from '@oa-agent/shared';

const TOKEN_KEY = 'oa-admin-token';

export const tokenStore = {
  get: (): string | null => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export interface Tenant {
  id: string;
  name: string;
  allowedOrigins: string[];
  ssoSecret?: string;
  appearance?: TenantAppearance;
  createdAt: string;
}
export interface ApiKey {
  key: string;
  tenantId: string;
  type: 'publishable' | 'secret';
  createdAt: string;
  revokedAt?: string;
}
export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events?: string[];
  createdAt: string;
  disabledAt?: string;
}
export interface Usage {
  conversations: number;
  messages: number;
  submissions: number;
}

/** 401 時拋出，UI 攔截導回登入 */
export class UnauthorizedError extends Error {}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    tokenStore.clear();
    throw new UnauthorizedError('未授權');
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

export const api = {
  login: (password: string) => req<{ token: string }>('POST', '/admin/auth/login', { password }),

  listTenants: () => req<Tenant[]>('GET', '/admin/tenants'),
  createTenant: (input: { name: string; allowedOrigins?: string[]; ssoSecret?: string }) =>
    req<{ tenant: Tenant; publishableKey: string }>('POST', '/admin/tenants', input),
  updateTenant: (id: string, patch: Partial<Pick<Tenant, 'name' | 'allowedOrigins' | 'ssoSecret' | 'appearance'>>) =>
    req<Tenant>('PATCH', `/admin/tenants/${id}`, patch),

  createKey: (id: string, type: 'publishable' | 'secret') =>
    req<ApiKey>('POST', `/admin/tenants/${id}/keys`, { type }),

  listWebhooks: (id: string) => req<WebhookEndpoint[]>('GET', `/admin/tenants/${id}/webhooks`),
  createWebhook: (id: string, input: { url: string; secret?: string }) =>
    req<WebhookEndpoint>('POST', `/admin/tenants/${id}/webhooks`, input),
  toggleWebhook: (id: string, webhookId: string, disabled: boolean) =>
    req<WebhookEndpoint>('PATCH', `/admin/tenants/${id}/webhooks/${webhookId}`, { disabled }),
  deleteWebhook: (id: string, webhookId: string) =>
    req<{ id: string }>('DELETE', `/admin/tenants/${id}/webhooks/${webhookId}`),

  getUsage: (id: string) => req<Usage>('GET', `/admin/tenants/${id}/usage`),
};
