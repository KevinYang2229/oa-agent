import type { Request, Response } from 'express';
import { AppError } from '@/utils/app-error';
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
        suggestions: turn?.suggestions ?? [],
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

  /** 上傳附件（multipart，欄位名 file）；回傳附件 metadata 供前端加入表單值 */
  async uploadAttachment(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    const file = req.file;
    if (!file) throw AppError.unprocessable('缺少上傳檔案（欄位名須為 file）');
    const meta = conversationService.addAttachment(userId, String(req.params.id), {
      name: file.originalname,
      mime: file.mimetype,
      buffer: file.buffer,
    });
    res.status(201).json({ data: meta });
  },

  /** 刪除附件 */
  async deleteAttachment(req: Request, res: Response): Promise<void> {
    const userId = resolveUserId(req);
    conversationService.removeAttachment(
      userId,
      String(req.params.id),
      String(req.params.attachmentId),
    );
    res.status(200).json({ data: { id: String(req.params.attachmentId) } });
  },
};
