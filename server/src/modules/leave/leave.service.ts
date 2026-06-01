/**
 * 請假領域 service：最終 payload 驗證 → 透過 OA 連接器送出。
 * 不 import express（可在 worker 執行）。
 */
import { getOAConnector } from '@/lib/oa';
import type { LeaveBalance, OASubmitResult } from '@/lib/oa/types';
import { validateAll } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import type { FormValues } from '@/modules/form/form.types';
import { AppError } from '@/utils/app-error';

const FORM_ID = 'leave-request';

export const leaveService = {
  async submit(userId: string, values: FormValues): Promise<OASubmitResult> {
    const def = getDefinition(FORM_ID);
    const issues = validateAll(def, values);
    if (issues.length > 0) {
      throw AppError.unprocessable('Leave request validation failed', issues);
    }

    const connector = getOAConnector();
    return connector.submitLeaveRequest({
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
    });
  },

  /** 取得各假別剩餘時數（供畫面顯示「今年度剩餘 N 小時」） */
  async getBalances(userId: string): Promise<LeaveBalance[]> {
    const connector = getOAConnector();
    return connector.getLeaveBalance ? connector.getLeaveBalance(userId) : [];
  },
};
