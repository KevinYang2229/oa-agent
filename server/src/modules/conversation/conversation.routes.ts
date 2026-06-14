import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { singleFileUpload } from '@/middlewares/upload';
import { asyncHandler } from '@/utils/async-handler';
import { conversationController } from './conversation.controller';
import {
  attachmentParamSchema,
  idParamSchema,
  messageSchema,
  startSchema,
  updateFieldsSchema,
} from './conversation.schema';

const router = Router();

// MVP：未掛 requireAuth，userId 取自 x-user-id header（方便 curl demo）
router.post('/', validate({ body: startSchema }), asyncHandler(conversationController.start));

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(conversationController.get),
);

router.post(
  '/:id/messages',
  validate({ params: idParamSchema, body: messageSchema }),
  asyncHandler(conversationController.sendMessage),
);

router.patch(
  '/:id/fields',
  validate({ params: idParamSchema, body: updateFieldsSchema }),
  asyncHandler(conversationController.updateFields),
);

// 確認送出（不經 LLM）：確認畫面按「送出」用
router.post(
  '/:id/submit',
  validate({ params: idParamSchema }),
  asyncHandler(conversationController.submit),
);

router.post(
  '/:id/cancel',
  validate({ params: idParamSchema }),
  asyncHandler(conversationController.cancel),
);

// 附件：上傳（multipart，欄位名 file）／刪除
router.post(
  '/:id/attachments',
  validate({ params: idParamSchema }),
  singleFileUpload('file'),
  asyncHandler(conversationController.uploadAttachment),
);

router.delete(
  '/:id/attachments/:attachmentId',
  validate({ params: attachmentParamSchema }),
  asyncHandler(conversationController.deleteAttachment),
);

export const conversationRouter = router;
