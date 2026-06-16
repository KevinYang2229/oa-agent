import { Router } from 'express';
import { asyncHandler } from '@/utils/async-handler';
import { widgetController } from './widget.controller';

const router = Router();

// 公開（不需登入）；租戶由上游 resolveTenant 以 ?key=pk_ 解析
router.get('/config', asyncHandler(widgetController.getConfig));

export const widgetRouter = router;
