// 對應後端 conversation / form API。schema 與型別共用 @oa-agent/shared（單一來源）。
import type {
  Definition,
  FieldOption,
  FieldSpec,
  SessionStatus,
  SubmissionInfo,
} from '@oa-agent/shared';

export type { Definition, FieldOption, FieldSpec, SessionStatus, SubmissionInfo };

export interface TurnData {
  id?: string;
  status: SessionStatus;
  values: Record<string, unknown>;
  reply: string | null;
  submission?: SubmissionInfo;
}

/** PATCH /:id/fields 的回傳（TurnData + 套用/退回明細） */
export interface UpdateFieldsData extends TurnData {
  applied: string[];
  rejected: { field: string; message: string }[];
}

export interface ConversationState {
  id: string;
  formId: string;
  status: SessionStatus;
  values: Record<string, unknown>;
  submission?: SubmissionInfo;
}

const BASE = '/api/v1/conversations';

function headers(userId: string): HeadersInit {
  return { 'content-type': 'application/json', 'x-user-id': userId || 'demo-user' };
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? json?.message ?? `錯誤 ${res.status}`);
  }
  return json.data as T;
}

export const api = {
  /** 建立對話並起首輪 */
  start(userId: string, message: string): Promise<TurnData> {
    return fetch(BASE, {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({ message }),
    }).then((r) => unwrap<TurnData>(r));
  },

  /** 在既有對話送一則訊息，跑一輪 */
  sendMessage(userId: string, convId: string, message: string): Promise<TurnData> {
    return fetch(`${BASE}/${convId}/messages`, {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({ message }),
    }).then((r) => unwrap<TurnData>(r));
  },

  /** 確認畫面手動編輯欄位（不經 LLM，直接存回 session） */
  updateFields(
    userId: string,
    convId: string,
    fields: Record<string, unknown>,
  ): Promise<UpdateFieldsData> {
    return fetch(`${BASE}/${convId}/fields`, {
      method: 'PATCH',
      headers: headers(userId),
      body: JSON.stringify({ fields }),
    }).then((r) => unwrap<UpdateFieldsData>(r));
  },

  /** 取消對話（後端把 status 設為 cancelled） */
  cancel(userId: string, convId: string): Promise<{ id: string; status: SessionStatus }> {
    return fetch(`${BASE}/${convId}/cancel`, {
      method: 'POST',
      headers: headers(userId),
    }).then((r) => unwrap<{ id: string; status: SessionStatus }>(r));
  },

  /** 取對話完整狀態（含 formId） */
  getConversation(userId: string, convId: string): Promise<ConversationState> {
    return fetch(`${BASE}/${convId}`, { headers: headers(userId) }).then((r) =>
      unwrap<ConversationState>(r),
    );
  },

  /** 取表單 Definition（schema-driven 渲染表單畫面） */
  getForm(formId: string): Promise<Definition> {
    return fetch(`/api/v1/forms/${formId}`).then((r) => unwrap<Definition>(r));
  },
};
