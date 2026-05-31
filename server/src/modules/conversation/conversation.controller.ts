import type { Request, Response } from 'express';
import { conversationService } from './conversation.service';
import type { MessageInput, StartInput, UpdateFieldsInput } from './conversation.schema';

// MVP 未接 JWT：優先用 req.user.sub，否則用 x-user-id header，最後 demo-user
function resolveUserId(req: Request): string {
  return req.user?.sub ?? req.header('x-user-id') ?? 'demo-user';
}

export const conversationController = {
  async start(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const { message } = req.body as StartInput;
    const { session, turn } = await conversationService.start(userId, message);
    res.status(201).json({
      data: {
        id: session.id,
        status: session.status,
        values: session.values,
        reply: turn?.reply ?? null,
      },
    });
  },

  async sendMessage(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const { message } = req.body as MessageInput;
    const turn = await conversationService.sendMessage(userId, String(req.params.id), message);
    res.status(200).json({ data: turn });
  },

  async updateFields(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const { fields } = req.body as UpdateFieldsInput;
    const result = conversationService.updateFields(userId, String(req.params.id), fields);
    res.status(200).json({ data: result });
  },

  async get(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const session = conversationService.get(userId, String(req.params.id));
    res.status(200).json({
      data: {
        id: session.id,
        formId: session.formId,
        status: session.status,
        values: session.values,
        submission: session.submission,
      },
    });
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const session = conversationService.cancel(userId, String(req.params.id));
    res.status(200).json({ data: { id: session.id, status: session.status } });
  },
};
