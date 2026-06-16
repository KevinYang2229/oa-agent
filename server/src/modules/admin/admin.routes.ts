import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { requireAdmin } from '@/middlewares/require-admin';
import { asyncHandler } from '@/utils/async-handler';
import { adminController } from './admin.controller';
import {
  createKeySchema,
  createTenantSchema,
  createWebhookSchema,
  tenantParamSchema,
  webhookParamSchema,
} from './admin.schema';

const router = Router();

// 全部管理端點都需 x-admin-key
router.use(requireAdmin);

router.post('/tenants', validate({ body: createTenantSchema }), asyncHandler(adminController.createTenant));
router.get('/tenants', asyncHandler(adminController.listTenants));

router.post(
  '/tenants/:id/keys',
  validate({ params: tenantParamSchema, body: createKeySchema }),
  asyncHandler(adminController.createKey),
);

router.post(
  '/tenants/:id/webhooks',
  validate({ params: tenantParamSchema, body: createWebhookSchema }),
  asyncHandler(adminController.createWebhook),
);
router.get(
  '/tenants/:id/webhooks',
  validate({ params: tenantParamSchema }),
  asyncHandler(adminController.listWebhooks),
);
router.delete(
  '/tenants/:id/webhooks/:webhookId',
  validate({ params: webhookParamSchema }),
  asyncHandler(adminController.deleteWebhook),
);

router.get(
  '/tenants/:id/usage',
  validate({ params: tenantParamSchema }),
  asyncHandler(adminController.getUsage),
);

export const adminRouter = router;
