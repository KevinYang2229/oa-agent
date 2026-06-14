import { z } from 'zod';

export const startSchema = z.object({
  message: z.string().trim().min(1).optional(),
});

export const messageSchema = z.object({
  message: z.string().trim().min(1),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

// 刪除附件：對話 id + 附件 id（附件 id 亦為 uuid）
export const attachmentParamSchema = z.object({
  id: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

// 確認畫面手動編輯：直接設定一批欄位值（不經 LLM）
export const updateFieldsSchema = z.object({
  fields: z.record(z.string(), z.unknown()).refine((f) => Object.keys(f).length > 0, {
    message: 'fields 不可為空',
  }),
});

export type StartInput = z.infer<typeof startSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type UpdateFieldsInput = z.infer<typeof updateFieldsSchema>;
