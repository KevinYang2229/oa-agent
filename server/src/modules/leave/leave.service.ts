/**
 * 請假領域 service：最終 payload 驗證 → 透過 OA 連接器送出。
 * 不 import express（可在 worker 執行）。
 */
import { getOAConnector } from '@/lib/oa';
import type { OASubmitResult } from '@/lib/oa/types';
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
      leaveType: values.leaveType as string,
      startDate: values.startDate as string,
      endDate: values.endDate as string,
      startTime: values.startTime as string | undefined,
      endTime: values.endTime as string | undefined,
      reason: values.reason as string,
    });
  },
};
