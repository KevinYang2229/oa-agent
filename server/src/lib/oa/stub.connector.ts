/**
 * StubOAConnector：不接真 OA，記錄送出並回合成 oaRequestId，
 * 讓整條 chat→submit 流程零外部依賴即可 demo。
 */
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import type {
  LeaveBalance,
  LeaveRequestPayload,
  OAConnector,
  OASubmitResult,
  OutingRegistrationPayload,
} from './types';

// MVP 以記憶體保存送出紀錄，方便 demo 後檢視
export const stubSubmissions: Array<LeaveRequestPayload & { oaRequestId: string }> = [];
export const stubOutingSubmissions: Array<OutingRegistrationPayload & { oaRequestId: string }> = [];

export const stubOAConnector: OAConnector = {
  name: 'stub',

  async submitLeaveRequest(payload: LeaveRequestPayload): Promise<OASubmitResult> {
    const oaRequestId = `STUB-${randomUUID().slice(0, 8).toUpperCase()}`;
    stubSubmissions.push({ ...payload, oaRequestId });
    logger.info({ oaRequestId, payload }, '[oa:stub] leave request submitted');
    return { oaRequestId, status: 'accepted', raw: { echo: payload } };
  },

  async submitOutingRegistration(payload: OutingRegistrationPayload): Promise<OASubmitResult> {
    const oaRequestId = `STUB-${randomUUID().slice(0, 8).toUpperCase()}`;
    stubOutingSubmissions.push({ ...payload, oaRequestId });
    logger.info({ oaRequestId, payload }, '[oa:stub] outing registration submitted');
    return { oaRequestId, status: 'accepted', raw: { echo: payload } };
  },

  async getLeaveBalance(_userId: string): Promise<LeaveBalance[]> {
    // demo 用：涵蓋表單支援的 6 種假別（特休/事假/病假/公假/喪假/婚假）
    return [
      { leaveType: 'annual', remainingHours: 80 },
      { leaveType: 'personal', remainingHours: 56 },
      { leaveType: 'sick', remainingHours: 240 },
      { leaveType: 'official', remainingHours: 40 },
      { leaveType: 'funeral', remainingHours: 64 },
      { leaveType: 'marriage', remainingHours: 64 },
    ];
  },
};
