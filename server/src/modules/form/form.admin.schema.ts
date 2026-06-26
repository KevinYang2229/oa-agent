/**
 * Form Designer 管理 API 的 zod schema：路由參數與 Definition body 的「淺層」形狀檢查。
 * 深層自洽性（欄位 key 對齊、Select options 等）由 form.validator.validateDefinition 把關。
 */
import { z } from 'zod';

export const tenantFormParamSchema = z.object({
  id: z.string().min(1),
  formId: z.string().min(1),
});

/** Definition body 淺層檢查：必備四層存在且型別大致正確；其餘交給 validateDefinition */
export const definitionBodySchema = z
  .object({
    formId: z.string().min(1),
    data: z
      .object({ type: z.literal('object'), properties: z.record(z.unknown()) })
      .passthrough(),
    field: z.record(z.unknown()),
    validation: z.object({ required: z.array(z.string()) }).passthrough(),
    agent: z.object({ intent: z.string().min(1), description: z.string().min(1) }).passthrough(),
    layout: z.unknown().optional(),
    workflow: z.unknown().optional(),
    policy: z.unknown().optional(),
    oa: z.unknown().optional(),
  })
  .passthrough();

export type DefinitionBody = z.infer<typeof definitionBodySchema>;
