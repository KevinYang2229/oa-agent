import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().trim().min(1),
  allowedOrigins: z.array(z.string().trim().min(1)).optional(),
  ssoSecret: z.string().min(16).optional(),
});

export const createKeySchema = z.object({
  type: z.enum(['publishable', 'secret']),
});

export const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8).optional(),
  events: z.array(z.literal('form.submitted')).optional(),
});

export const tenantParamSchema = z.object({
  id: z.string().min(1),
});

export const webhookParamSchema = z.object({
  id: z.string().min(1),
  webhookId: z.string().min(1),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateKeyInput = z.infer<typeof createKeySchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
