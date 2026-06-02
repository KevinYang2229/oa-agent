/**
 * 請假領域 service：最終 payload 驗證 → 透過 OA 連接器送出 + 簽核流程（workflow）。
 * 不 import express（可在 worker 執行）。
 */
import type { ApprovalStep } from '@oa-agent/shared';
import { getOAConnector } from '@/lib/oa';
import type { LeaveBalance } from '@/lib/oa/types';
import { validateAll } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import type { Definition, FormValues } from '@/modules/form/form.types';
import { getApplicant } from '@/modules/user/user.directory';
import { AppError } from '@/utils/app-error';
import { computeLeaveHours } from './leave.hours';

const FORM_ID = 'leave-request';

// Demo 模擬：送出後每經過此時間就自動核准一關（真實串接時改由 OA 連接器查詢狀態）
const DEMO_STEP_MS = 15_000;

export interface LeaveSubmission {
  oaRequestId: string;
  status: string;
  submittedAt: string;
  approvals: ApprovalStep[];
}

/** 取 workflow 關卡定義（名稱／類型）；無 workflow 回空陣列 */
function stepDefs(def: Definition): Array<Pick<ApprovalStep, 'name' | 'type'>> {
  return (def.workflow?.steps ?? []).map((s) => ({ name: s.name ?? s.type, type: s.type }));
}

/**
 * 依送出時間計算各關卡狀態（Demo：時間到自動核准）。
 * 已過 N 關為 approved，下一關為 current，其餘 pending；全部過則無 current（流程完成）。
 */
function computeApprovals(
  steps: Array<Pick<ApprovalStep, 'name' | 'type'>>,
  submittedAt: string,
): ApprovalStep[] {
  const elapsed = Date.now() - Date.parse(submittedAt);
  const approved = Math.max(0, Math.min(steps.length, Math.floor(elapsed / DEMO_STEP_MS)));
  return steps.map((s, i) => ({
    ...s,
    status: i < approved ? 'approved' : i === approved ? 'current' : 'pending',
  }));
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
    });

    const submittedAt = new Date().toISOString();
    return {
      oaRequestId: result.oaRequestId,
      status: result.status,
      submittedAt,
      approvals: computeApprovals(stepDefs(def), submittedAt),
    };
  },

  /**
   * 查詢目前簽核進度：依既有關卡（名稱/類型）與送出時間重新計算狀態。
   * 供 GET 對話時即時反映目前流程審核狀態。
   */
  refreshApprovals(approvals: ApprovalStep[], submittedAt?: string): ApprovalStep[] {
    if (!submittedAt || approvals.length === 0) return approvals;
    return computeApprovals(
      approvals.map((a) => ({ name: a.name, type: a.type })),
      submittedAt,
    );
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
