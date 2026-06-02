import { computeStatus, setField } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import type { FieldIssue } from '@/modules/form/form.types';
import { leaveService } from '@/modules/leave/leave.service';
import { getApplicant } from '@/modules/user/user.directory';
import { AppError } from '@/utils/app-error';
import { runTurn } from './conversation.agent';
import { conversationStore } from './conversation.store';
import type { Session, TurnResult } from './conversation.types';

// MVP 僅請假單；之後 intent routing 在此決定 formId
const MVP_FORM_ID = 'leave-request';

/** 申請人欄位值格式：姓名(工號)，與真實 OA 畫面一致 */
function formatApplicant(userId: string): string {
  const profile = getApplicant(userId);
  return `${profile.name}(${profile.id})`;
}

export interface UpdateFieldsResult extends TurnResult {
  applied: string[];
  rejected: FieldIssue[];
}

export const conversationService = {
  async start(userId: string, message?: string): Promise<{ session: Session; turn?: TurnResult }> {
    const session = conversationStore.create(userId, MVP_FORM_ID);
    // 申請人＝目前登入者，建立 session 時即帶入（代人申請時使用者可再覆寫）
    session.values.applicant = formatApplicant(userId);
    conversationStore.save(session);
    if (message && message.trim()) {
      const turn = await runTurn(session, message);
      return { session, turn };
    }
    return { session };
  },

  async sendMessage(userId: string, id: string, message: string): Promise<TurnResult> {
    const session = conversationStore.get(id, userId);
    if (session.status === 'submitted') throw AppError.conflict('Conversation already submitted');
    if (session.status === 'cancelled') throw AppError.conflict('Conversation cancelled');
    return runTurn(session, message);
  },

  /**
   * 確認畫面手動編輯欄位（不經 LLM）：每欄走 form.engine 的 coerce + 驗證，
   * 重算 slot 狀態並同步 collecting/confirming，確保送出時 session.values 與畫面一致。
   */
  updateFields(userId: string, id: string, fields: Record<string, unknown>): UpdateFieldsResult {
    const session = conversationStore.get(id, userId);
    if (session.status === 'submitted') throw AppError.conflict('Conversation already submitted');
    if (session.status === 'cancelled') throw AppError.conflict('Conversation cancelled');

    const def = getDefinition(session.formId);
    const applied: string[] = [];
    const rejected: FieldIssue[] = [];

    for (const [field, value] of Object.entries(fields)) {
      if (!(field in def.data.properties)) {
        rejected.push({ field, message: `未知欄位：${field}` });
        continue;
      }
      // 空值＝清除該欄（選填欄位允許；必填清空則於 status 反映為 missing）
      if (value === null || value === undefined || value === '') {
        const { [field]: _omit, ...rest } = session.values;
        session.values = rest;
        applied.push(field);
        continue;
      }
      const res = setField(def, session.values, field, value);
      if (res.issue) rejected.push(res.issue);
      else {
        session.values = res.values;
        applied.push(field);
      }
    }

    const status = computeStatus(def, session.values);
    if (status.isComplete && session.status === 'collecting') session.status = 'confirming';
    if (!status.isComplete && session.status === 'confirming') session.status = 'collecting';

    // 在 LLM 逐字稿留下手動修改紀錄，下一輪「確認」時模型可據此對齊摘要
    if (applied.length > 0) {
      session.messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `（使用者於確認畫面手動更新欄位：${JSON.stringify(session.values)}）`,
          },
        ],
      });
    }

    conversationStore.save(session);
    return {
      reply: '',
      status: session.status,
      values: session.values,
      submission: session.submission,
      applied,
      rejected,
    };
  },

  get(userId: string, id: string): Session {
    const session = conversationStore.get(id, userId);
    // 查詢時即時反映目前簽核進度（依送出時間重算關卡狀態）
    if (session.submission?.approvals?.length) {
      session.submission = {
        ...session.submission,
        approvals: leaveService.refreshApprovals(
          session.submission.approvals,
          session.submission.submittedAt,
        ),
      };
    }
    return session;
  },

  cancel(userId: string, id: string): Session {
    const session = conversationStore.get(id, userId);
    if (session.status !== 'submitted') session.status = 'cancelled';
    conversationStore.save(session);
    return session;
  },
};
