import type { Request, Response } from 'express';
import { tenantStore } from '@/modules/tenant/tenant.store';
import { getDefinition, listDefinitions } from './form.registry';

// 租戶由 resolveTenant middleware 注入；未帶 key 落到預設租戶（向後相容）
function resolveTenantId(req: Request): string {
  return req.tenant?.id ?? 'default';
}

export const formController = {
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = resolveTenantId(req);
    const tenant = tenantStore.getTenant(tenantId);
    // form 服務被停用 → 無可辦理表單；否則濾掉個別被停用的表單
    const formDisabled = (tenant?.disabledServices ?? []).includes('form');
    const disabledForms = new Set(tenant?.disabledForms ?? []);
    const data = formDisabled
      ? []
      : listDefinitions(tenantId)
          .filter((d) => !disabledForms.has(d.formId))
          .map((d) => ({
            formId: d.formId,
            title: d.data.title ?? d.formId,
            description: d.agent.description,
            examples: d.agent.examples ?? [],
          }));
    res.status(200).json({ data });
  },

  async get(req: Request, res: Response): Promise<void> {
    const def = getDefinition(resolveTenantId(req), String(req.params.formId));
    res.status(200).json({ data: def });
  },
};
