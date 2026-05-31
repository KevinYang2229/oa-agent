import { Router } from 'express';
import { asyncHandler } from '@/utils/async-handler';
import { formController } from './form.controller';

const router = Router();

// 展示 schema-driven：列出所有表單 Definition / 取得單一 Definition（六層）
router.get('/', asyncHandler(formController.list));
router.get('/:formId', asyncHandler(formController.get));

export const formRouter = router;
