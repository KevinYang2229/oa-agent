import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '@/config/env';
import { requestLogger } from '@/middlewares/request-logger';
import { errorHandler, notFoundHandler } from '@/middlewares/error-handler';
import { requireAuth } from '@/middlewares/require-auth';
import { authRouter } from '@/modules/auth/auth.routes';
import { conversationRouter } from '@/modules/conversation/conversation.routes';
import { formRouter } from '@/modules/form/form.routes';
import { leaveRouter } from '@/modules/leave/leave.routes';

/**
 * MVP app：只掛對話與表單路由，不連 DB / Redis / Socket。
 * 之後接 Prisma/Redis 時，把對應 router 與 infra 加回即可。
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // 健康檢查：server 能啟動即代表 LLM provider 的 API key 通過 env 驗證（見 config/env fail-fast），
  // 故回報 provider/model 供前端顯示「AI 已連線」。此處不實際呼叫 LLM，避免額外費用與延遲。
  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      llm: { provider: env.LLM_PROVIDER, model: env.LLM_MODEL },
    });
  });

  // 公開：登入 / 換發 token
  app.use('/api/v1/auth', authRouter);

  // 受保護：需帶有效 access token 才能操作
  app.use('/api/v1/conversations', requireAuth, conversationRouter);
  app.use('/api/v1/forms', requireAuth, formRouter);
  app.use('/api/v1/leave', requireAuth, leaveRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
