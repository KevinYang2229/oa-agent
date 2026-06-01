import { Router } from 'express';
import { asyncHandler } from '@/utils/async-handler';
import { leaveController } from './leave.controller';

const router = Router();

// 各假別剩餘時數（畫面顯示「今年度剩餘 N 小時」）
router.get('/balances', asyncHandler(leaveController.balances));

export const leaveRouter = router;
