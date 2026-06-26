/**
 * StubOAConnector：不接真 OA，記錄送出並回合成 oaRequestId，
 * 讓整條 chat→submit 流程零外部依賴即可 demo。
 *
 * body 仍依各表單 oa.schema.json 經 oa.mapper 組出（與 http 路徑一致），方便 demo 後檢視。
 */
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { buildOABody } from './oa.mapper';
import type { LeaveBalance, OAConnector, OASubmitInput, OASubmitResult } from './types';

/** MVP 以記憶體保存送出紀錄，方便 demo 後檢視（依 oa.schema 映射後的 body） */
export const stubSubmissions: Array<{
  formId: string;
  oaRequestId: string;
  body: Record<string, unknown>;
}> = [];

export const stubOAConnector: OAConnector = {
  name: 'stub',

  async submitForm({ formId, oa, source }: OASubmitInput): Promise<OASubmitResult> {
    const body = buildOABody(oa.request, source);
    const oaRequestId = `STUB-${randomUUID().slice(0, 8).toUpperCase()}`;
    stubSubmissions.push({ formId, oaRequestId, body });
    logger.info({ oaRequestId, formId, body }, '[oa:stub] form submitted');
    return { oaRequestId, status: 'accepted', raw: { echo: body } };
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
