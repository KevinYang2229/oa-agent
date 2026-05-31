/**
 * In-memory session store（MVP）。之後接 Prisma 只要換這層的實作，介面不變。
 */
import { randomUUID } from 'node:crypto';
import { AppError } from '@/utils/app-error';
import type { Session } from './conversation.types';

const sessions = new Map<string, Session>();

export const conversationStore = {
  create(userId: string, formId: string): Session {
    const session: Session = {
      id: randomUUID(),
      userId,
      formId,
      values: {},
      status: 'collecting',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    sessions.set(session.id, session);
    return session;
  },

  get(id: string, userId: string): Session {
    const session = sessions.get(id);
    if (!session) throw AppError.notFound('Conversation not found');
    if (session.userId !== userId) throw AppError.forbidden('Not your conversation');
    return session;
  },
};
