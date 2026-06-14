/**
 * 外出登記領域 service：最終 payload 驗證 → 透過 OA 連接器送出 + 簽核流程（workflow）。
 * 結構比照 leave.service；不 import express（可在 worker 執行）。
 */
import type { ApprovalStep } from '@oa-agent/shared';
import { getOAConnector } from '@/lib/oa';
import { computeApprovals, stepDefs } from '@/modules/form/approvals';
import { validateAll } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import type { FormValues } from '@/modules/form/form.types';
import { AppError } from '@/utils/app-error';

const FORM_ID = 'outing-registration';

export interface OutingSubmission {
  oaRequestId: string;
  status: string;
  submittedAt: string;
  approvals: ApprovalStep[];
}

export const outingService = {
  async submit(userId: string, values: FormValues): Promise<OutingSubmission> {
    const def = getDefinition(FORM_ID);
    const issues = validateAll(def, values);
    if (issues.length > 0) {
      throw AppError.unprocessable('Outing registration validation failed', issues);
    }

    const connector = getOAConnector();
    const result = await connector.submitOutingRegistration({
      userId,
      onBehalf: values.onBehalf as boolean | undefined,
      applicant: values.applicant as string,
      subject: values.subject as string,
      fromLocation: values.fromLocation as string,
      toLocation: values.toLocation as string,
      departDate: values.departDate as string,
      departTime: values.departTime as string,
      returnDate: values.returnDate as string,
      returnTime: values.returnTime as string,
      needReimbursement: values.needReimbursement as string,
      notifyPersons: values.notifyPersons as string | undefined,
      remark: values.remark as string | undefined,
    });

    const submittedAt = new Date().toISOString();
    return {
      oaRequestId: result.oaRequestId,
      status: result.status,
      submittedAt,
      approvals: computeApprovals(stepDefs(def), submittedAt),
    };
  },
};
