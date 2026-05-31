import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '@/config/env';
import { requestLogger } from '@/middlewares/request-logger';
import { errorHandler, notFoundHandler } from '@/middlewares/error-handler';
import { conversationRouter } from '@/modules/conversation/conversation.routes';
import { formRouter } from '@/modules/form/form.routes';

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

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/conversations', conversationRouter);
  app.use('/api/v1/forms', formRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
