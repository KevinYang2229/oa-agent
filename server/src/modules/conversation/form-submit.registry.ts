/**
 * formId → 送出 service 的查表式 registry（送出接縫）。
 *
 * 取代原本散在 conversation.service / conversation.agent 兩處的硬編碼三元判斷。
 * 新增一張「會真的送出 OA」的表單 = 在 server/src/modules/<form>/ 寫一個 service，
 * 然後在這裡加一行；編排層（conversation.service / conversation.agent）不需改動。
 *
 * 各 service 的 submit 簽名一致：(userId, values) => Promise<FormSubmission>，
 * 不認識 express，可在 worker 執行。
 */
import type { ApprovalStep } from '@oa-agent/shared';
import { businessTripService } from '@/modules/business-trip/business-trip.service';
import type { FormValues } from '@/modules/form/form.types';
import { leaveService } from '@/modules/leave/leave.service';
import { outingService } from '@/modules/outing/outing.service';
import { AppError } from '@/utils/app-error';

/** 各表單 service.submit 的共同回傳形狀（leave / business-trip / outing 一致） */
export interface FormSubmission {
  oaRequestId: string;
  status: string;
  submittedAt: string;
  approvals: ApprovalStep[];
}

export type FormSubmitFn = (userId: string, values: FormValues) => Promise<FormSubmission>;

/** formId → 送出 service。新增送出型表單時於此註冊一行。 */
const submitRegistry: Record<string, FormSubmitFn> = {
  'leave-request': leaveService.submit,
  'business-trip-domestic': businessTripService.submit,
  'outing-registration': outingService.submit,
};

/**
 * 取得指定表單的送出 service。
 * 找不到代表該 formId 尚未實作領域 service（設定疏漏），丟 500 明確報錯，
 * 而非靜默 fallback 成其他表單。
 */
export function resolveSubmit(formId: string): FormSubmitFn {
  const submit = submitRegistry[formId];
  if (!submit) {
    throw AppError.internal(`No submit service registered for form "${formId}"`);
  }
  return submit;
}
