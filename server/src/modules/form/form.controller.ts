import type { Request, Response } from 'express';
import { getDefinition, listDefinitions } from './form.registry';

// 租戶由 resolveTenant middleware 注入；未帶 key 落到預設租戶（向後相容）
function resolveTenantId(req: Request): string {
  return req.tenant?.id ?? 'default';
}

export const formController = {
  async list(req: Request, res: Response): Promise<void> {
    const data = listDefinitions(resolveTenantId(req)).map((d) => ({
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
