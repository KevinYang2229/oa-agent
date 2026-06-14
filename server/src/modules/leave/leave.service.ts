/**
 * 請假領域 service：最終 payload 驗證 → 透過 OA 連接器送出 + 簽核流程（workflow）。
 * 不 import express（可在 worker 執行）。
 */
import type { ApprovalStep, Attachment } from '@oa-agent/shared';
import { getOAConnector } from '@/lib/oa';
import type { LeaveBalance } from '@/lib/oa/types';
import { computeApprovals, stepDefs } from '@/modules/form/approvals';
import { validateAll } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import type { FormValues } from '@/modules/form/form.types';
import { getApplicant } from '@/modules/user/user.directory';
import { AppError } from '@/utils/app-error';
import { computeLeaveHours } from './leave.hours';

const FORM_ID = 'leave-request';

export interface LeaveSubmission {
  oaRequestId: string;
  status: string;
  submittedAt: string;
  approvals: ApprovalStep[];
}

export const leaveService = {
  async submit(userId: string, values: FormValues): Promise<LeaveSubmission> {
    const def = getDefinition(FORM_ID);
    const issues = validateAll(def, values);
    if (issues.length > 0) {
      throw AppError.unprocessable('Leave request validation failed', issues);
    }

    // 依申請人所屬地區的工時政策換算請假時數（排除午休等）
    const region = getApplicant(userId).region;
    const hours = def.policy
      ? computeLeaveHours(values, def.policy, region).hours
      : undefined;

    const connector = getOAConnector();
    const result = await connector.submitLeaveRequest({
      userId,
      onBehalf: values.onBehalf as boolean | undefined,
      applicant: values.applicant as string,
      deputy: values.deputy as string,
      deputyAllForms: values.deputyAllForms as boolean | undefined,
      leaveType: values.leaveType as string,
      startDate: values.startDate as string,
      endDate: values.endDate as string,
      startTime: values.startTime as string | undefined,
      endTime: values.endTime as string | undefined,
      reason: values.reason as string,
      hours,
      region,
      attachments: values.attachments as Attachment[] | undefined,
    });

    const submittedAt = new Date().toISOString();
    return {
      oaRequestId: result.oaRequestId,
      status: result.status,
      submittedAt,
      approvals: computeApprovals(stepDefs(def), submittedAt),
    };
  },

  /** 取得各假別剩餘時數（供畫面顯示「今年度剩餘 N 小時」） */
  async getBalances(userId: string): Promise<LeaveBalance[]> {
    const connector = getOAConnector();
    return connector.getLeaveBalance ? connector.getLeaveBalance(userId) : [];
  },

  /**
   * 依申請人地區工時政策估算目前表單值的請假時數（供對話中送出前告知）。
   * 表單無 policy 或缺起訖日期時回 null。
   */
  estimateHours(userId: string, values: FormValues): { hours: number; region?: string } | null {
    const def = getDefinition(FORM_ID);
    if (!def.policy) return null;
    const region = getApplicant(userId).region;
    const { hours } = computeLeaveHours(values, def.policy, region);
    return { hours, region };
  },
};
