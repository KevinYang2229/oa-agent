import type { SessionStatus, SubmissionInfo } from '@oa-agent/shared';
import type { LLMMessage } from '@/lib/llm/types';
import type { FormValues } from '@/modules/form/form.types';

export type { SessionStatus, SubmissionInfo };

export interface Session {
  id: string;
  userId: string;
  formId: string;
  values: FormValues;
  status: SessionStatus;
  /** 給 LLM 的逐字稿（含 tool_use / tool_result 區塊） */
  messages: LLMMessage[];
  submission?: SubmissionInfo;
  createdAt: string;
}

export interface TurnResult {
  reply: string;
  status: SessionStatus;
  values: FormValues;
  submission?: SubmissionInfo;
  /** 給前端 UI 的建議回覆（使用者最可能的接續回應），best-effort，可能為空 */
  suggestions: string[];
}
