/**
 * 國內出差報銷領域 service：最終 payload 驗證 → 透過 OA 連接器送出 + 簽核流程（workflow）。
 * 結構比照 outing.service；不 import express（可在 worker 執行）。
 */
import type { ApprovalStep, Attachment } from '@oa-agent/shared';
import { getOAConnector } from '@/lib/oa';
import { computeApprovals, stepDefs } from '@/modules/form/approvals';
import { validateAll } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import type { FormValues } from '@/modules/form/form.types';
import { AppError } from '@/utils/app-error';

const FORM_ID = 'business-trip-domestic';

export interface BusinessTripSubmission {
  oaRequestId: string;
  status: string;
  submittedAt: string;
  approvals: ApprovalStep[];
}

export const businessTripService = {
  async submit(userId: string, values: FormValues): Promise<BusinessTripSubmission> {
    const def = getDefinition(FORM_ID);
    const issues = validateAll(def, values);
    if (issues.length > 0) {
      throw AppError.unprocessable('Business trip reimbursement validation failed', issues);
    }

    const connector = getOAConnector();
    const result = await connector.submitBusinessTripDomestic({
      userId,
      onBehalf: values.onBehalf as boolean | undefined,
      applicant: values.applicant as string,
      company: values.company as string,
      purpose: values.purpose as string,
      tripDate: values.tripDate as string,
      routeFrom: values.routeFrom as string,
      routeTo: values.routeTo as string,
      taxiFee: values.taxiFee as number | undefined,
      hsrFee: values.hsrFee as number | undefined,
      transitFee: values.transitFee as number | undefined,
      privateCarKm: values.privateCarKm as number | undefined,
      privateCarFee: values.privateCarFee as number | undefined,
      lodgingFee: values.lodgingFee as number | undefined,
      mealFee: values.mealFee as number | undefined,
      parkingFee: values.parkingFee as number | undefined,
      carpoolFee: values.carpoolFee as number | undefined,
      carpoolMembers: values.carpoolMembers as string | undefined,
      subtotal: values.subtotal as number | undefined,
      hsrCarbon: values.hsrCarbon as number,
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
};
