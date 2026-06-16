import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { requireAdmin } from '@/middlewares/require-admin';
import { asyncHandler } from '@/utils/async-handler';
import { adminController } from './admin.controller';
import { adminAuthController } from './admin.auth.controller';
import {
  adminLoginSchema,
  createKeySchema,
  createTenantSchema,
  createWebhookSchema,
  patchTenantSchema,
  tenantParamSchema,
  toggleWebhookSchema,
  webhookParamSchema,
} from './admin.schema';

const router = Router();

// 公開：後台登入（在 requireAdmin 之前註冊，故不受其保護）
router.post('/auth/login', validate({ body: adminLoginSchema }), asyncHandler(adminAuthController.login));

// 以下全部管理端點都需 x-admin-key 或 admin JWT
router.use(requireAdmin);

router.post('/tenants', validate({ body: createTenantSchema }), asyncHandler(adminController.createTenant));
router.get('/tenants', asyncHandler(adminController.listTenants));

router.patch(
  '/tenants/:id',
  validate({ params: tenantParamSchema, body: patchTenantSchema }),
  asyncHandler(adminController.updateTenant),
);

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
router.patch(
  '/tenants/:id/webhooks/:webhookId',
  validate({ params: webhookParamSchema, body: toggleWebhookSchema }),
  asyncHandler(adminController.setWebhookEnabled),
);

router.get(
  '/tenants/:id/usage',
  validate({ params: tenantParamSchema }),
  asyncHandler(adminController.getUsage),
);

export const adminRouter = router;
