/**
 * 管理 API 控制器：建立 / 查詢租戶、簽發 API Key、登記 webhook、查用量。
 * 全部受 requireAdmin 保護（x-admin-key）。
 */
import type { Request, Response } from 'express';
import { tenantStore } from '@/modules/tenant/tenant.store';
import { webhookStore } from '@/modules/webhook/webhook.store';
import { usageStore } from '@/modules/usage/usage.store';
import { AppError } from '@/utils/app-error';
import type { CreateKeyInput, CreateTenantInput, CreateWebhookInput } from './admin.schema';

function ensureTenant(id: string) {
  const tenant = tenantStore.getTenant(id);
  if (!tenant) throw AppError.notFound('租戶不存在');
  return tenant;
}

export const adminController = {
  async createTenant(req: Request, res: Response): Promise<void> {
    const { name, allowedOrigins, ssoSecret } = req.body as CreateTenantInput;
    const tenant = tenantStore.createTenant(name, allowedOrigins ?? [], ssoSecret);
    // 一併發一把公開金鑰，方便立即接入
    const publishable = tenantStore.createApiKey(tenant.id, 'publishable');
    res.status(201).json({ data: { tenant, publishableKey: publishable.key } });
  },

  async listTenants(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ data: tenantStore.listTenants() });
  },

  async createKey(req: Request, res: Response): Promise<void> {
    const tenant = ensureTenant(String(req.params.id));
    const { type } = req.body as CreateKeyInput;
    const apiKey = tenantStore.createApiKey(tenant.id, type);
    res.status(201).json({ data: apiKey });
  },

  async createWebhook(req: Request, res: Response): Promise<void> {
    const tenant = ensureTenant(String(req.params.id));
    const { url, secret, events } = req.body as CreateWebhookInput;
    const endpoint = webhookStore.register({ tenantId: tenant.id, url, secret, events });
    res.status(201).json({ data: endpoint });
  },

  async listWebhooks(req: Request, res: Response): Promise<void> {
    const tenant = ensureTenant(String(req.params.id));
    res.status(200).json({ data: webhookStore.listByTenant(tenant.id) });
  },

  async deleteWebhook(req: Request, res: Response): Promise<void> {
    const tenant = ensureTenant(String(req.params.id));
    const ok = webhookStore.remove(tenant.id, String(req.params.webhookId));
    if (!ok) throw AppError.notFound('Webhook 不存在');
    res.status(200).json({ data: { id: String(req.params.webhookId) } });
  },

  async getUsage(req: Request, res: Response): Promise<void> {
    const tenant = ensureTenant(String(req.params.id));
    res.status(200).json({ data: usageStore.get(tenant.id) });
  },
};
