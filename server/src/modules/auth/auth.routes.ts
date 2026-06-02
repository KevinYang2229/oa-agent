import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { requireAuth } from '@/middlewares/require-auth';
import { asyncHandler } from '@/utils/async-handler';
import { authController } from './auth.controller';
import { loginSchema, refreshSchema } from './auth.schema';

const router = Router();

// 公開端點
router.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));

// 受保護端點
router.get('/me', requireAuth, asyncHandler(authController.me));

export const authRouter = router;
