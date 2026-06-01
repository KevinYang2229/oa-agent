/**
 * 對話 turn loop（slot-filling 編排）。
 *
 * 一則使用者訊息 → 可能多次 LLM/tool 往返 → 一則回覆。
 * 完整性與送出守門由伺服器決定，LLM 只負責擷取與對話。
 */
import { getLLMProvider } from '@/lib/llm';
import type { LLMContentBlock } from '@/lib/llm/types';
import { logger } from '@/lib/logger';
import { computeStatus, setField, validateAll } from '@/modules/form/form.engine';
import { getDefinition } from '@/modules/form/form.registry';
import { buildTools } from '@/modules/form/form.tools';
import type { Definition, FieldIssue } from '@/modules/form/form.types';
import { leaveService } from '@/modules/leave/leave.service';
import { AppError } from '@/utils/app-error';
import { conversationStore } from './conversation.store';
import type { Session, TurnResult } from './conversation.types';

const MAX_ITERATIONS = 6;

function describeFields(def: Definition): string {
  const order = def.agent.askOrder ?? Object.keys(def.data.properties);
  return order
    .map((name) => {
      const f = def.field[name];
      const required = def.validation.required.includes(name) ? '必填' : '選填';
      const opts = f?.options
        ? `；可選值：${f.options.map((o) => `${o.label}=${o.value}`).join('、')}`
        : '';
      const guide = def.agent.fieldGuidance?.[name] ? `；${def.agent.fieldGuidance[name]}` : '';
      return `- ${name}（${f?.label ?? name}，${required}）${opts}${guide}`;
    })
    .join('\n');
}

function buildSystemPrompt(def: Definition): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `你是公司 OA 系統的「${def.agent.description}」助理，全程使用繁體中文。`,
    `今天日期是 ${today}；請把相對日期（明天、下週一等）換算成 YYYY-MM-DD。`,
    '',
    '表單欄位（填入 fill_fields 時請用機器值，例如假別 annual/sick）：',
    describeFields(def),
    '',
    '工作方式：',
    '1. 從使用者訊息擷取可得欄位值，呼叫 fill_fields 一次填入。',
    '2. 依工具回傳的 missing/invalid，用友善的繁中逐一詢問還缺的必填欄位。',
    '3. 必填齊全後，用繁中摘要整張表單（假別用中文、列出日期與事由），請使用者回覆「確認」。',
    '4. 只有使用者明確回覆「確認」後才呼叫 submit；切勿自行送出，也不要捏造任何值。',
  ].join('\n');
}

interface DispatchCtx {
  def: Definition;
  session: Session;
  /** 本輪使用者訊息抵達時是否已處於 confirming（確認需在獨立一輪，防同輪自動送出） */
  canSubmit: boolean;
}

async function dispatchTool(
  ctx: DispatchCtx,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { def, session } = ctx;

  if (name === 'fill_fields') {
    const fields = (input.fields ?? {}) as Record<string, unknown>;
    const applied: string[] = [];
    const rejected: FieldIssue[] = [];
    for (const [field, value] of Object.entries(fields)) {
      if (value === null || value === undefined || value === '') continue;
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
    return JSON.stringify({
      applied,
      rejected,
      missing: status.missing,
      invalid: status.invalid,
      isComplete: status.isComplete,
      currentValues: session.values,
    });
  }

  if (name === 'submit') {
    const issues = validateAll(def, session.values);
    if (issues.length > 0) {
      return JSON.stringify({ ok: false, error: '尚有欄位未完成，無法送出', issues });
    }
    if (!ctx.canSubmit || session.status !== 'confirming') {
      return JSON.stringify({
        ok: false,
        error: '請先向使用者出示摘要並取得「確認」，於下一輪再呼叫 submit',
      });
    }
    session.status = 'submitting';
    try {
      const result = await leaveService.submit(session.userId, session.values);
      session.status = 'submitted';
      session.submission = { oaRequestId: result.oaRequestId, status: result.status };
      return JSON.stringify({ ok: true, oaRequestId: result.oaRequestId, status: result.status });
    } catch (err) {
      session.status = 'failed';
      return JSON.stringify({ ok: false, error: (err as Error).message });
    }
  }

  return JSON.stringify({ error: `unknown tool: ${name}` });
}

export async function runTurn(session: Session, userText: string): Promise<TurnResult> {
  const def = getDefinition(session.formId);
  const llm = getLLMProvider();
  const tools = buildTools(def);
  const system = buildSystemPrompt(def);

  // 守門快照：只有「使用者本輪訊息抵達時已是 confirming」才允許 submit
  const canSubmit = session.status === 'confirming';

  session.messages.push({ role: 'user', content: [{ type: 'text', text: userText }] });

  let reply = '';
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let result;
    try {
      result = await llm.createMessage({ system, messages: session.messages, tools, cache: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LLM request failed';
      throw new AppError(502, 'LLM_ERROR', `LLM 呼叫失敗：${message}`);
    }

    // 重建 assistant 訊息（text + tool_use），維持對話結構合法
    const assistantContent: LLMContentBlock[] = [];
    if (result.text) assistantContent.push({ type: 'text', text: result.text });
    for (const call of result.toolCalls) {
      assistantContent.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
    }
    session.messages.push({ role: 'assistant', content: assistantContent });

    if (result.toolCalls.length === 0) {
      reply = result.text;
      break;
    }

    const toolResults: LLMContentBlock[] = [];
    for (const call of result.toolCalls) {
      const out = await dispatchTool({ def, session, canSubmit }, call.name, call.input);
      toolResults.push({ type: 'tool_result', toolUseId: call.id, content: out });
    }
    session.messages.push({ role: 'user', content: toolResults });

    if (i === MAX_ITERATIONS - 1) {
      reply = result.text || '（已收到，請再補充或確認一次）';
    }
  }

  logger.info(
    { sessionId: session.id, status: session.status, filled: Object.keys(session.values) },
    'conversation turn complete',
  );
  conversationStore.save(session); // flush 本輪變更（values/status/messages/submission）
  return { reply, status: session.status, values: session.values, submission: session.submission };
}
