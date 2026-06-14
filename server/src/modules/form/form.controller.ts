import type { Request, Response } from 'express';
import { getDefinition, listDefinitions } from './form.registry';

export const formController = {
  async list(_req: Request, res: Response): Promise<void> {
    const data = listDefinitions().map((d) => ({
      formId: d.formId,
      title: d.data.title ?? d.formId,
      description: d.agent.description,
      examples: d.agent.examples ?? [],
    }));
    res.status(200).json({ data });
  },

  async get(req: Request, res: Response): Promise<void> {
    const def = getDefinition(String(req.params.formId));
    res.status(200).json({ data: def });
  },
};
