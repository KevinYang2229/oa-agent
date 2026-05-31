/**
 * StubOAConnector：不接真 OA，記錄送出並回合成 oaRequestId，
 * 讓整條 chat→submit 流程零外部依賴即可 demo。
 */
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import type { LeaveBalance, LeaveRequestPayload, OAConnector, OASubmitResult } from './types';

// MVP 以記憶體保存送出紀錄，方便 demo 後檢視
export const stubSubmissions: Array<LeaveRequestPayload & { oaRequestId: string }> = [];

export const stubOAConnector: OAConnector = {
  name: 'stub',

  async submitLeaveRequest(payload: LeaveRequestPayload): Promise<OASubmitResult> {
    const oaRequestId = `STUB-${randomUUID().slice(0, 8).toUpperCase()}`;
    stubSubmissions.push({ ...payload, oaRequestId });
    logger.info({ oaRequestId, payload }, '[oa:stub] leave request submitted');
    return { oaRequestId, status: 'accepted', raw: { echo: payload } };
  },

  async getLeaveBalance(_userId: string): Promise<LeaveBalance[]> {
    return [
      { leaveType: 'annual', remainingHours: 80 },
      { leaveType: 'sick', remainingHours: 240 },
    ];
  },
};
