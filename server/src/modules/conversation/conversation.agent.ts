/**
 * 對話 turn loop（slot-filling 編排）。
 *
 * 一則使用者訊息 → 可能多次 LLM/tool 往返 → 一則回覆。
 * 完整性與送出守門由伺服器決定，LLM 只負責擷取與對話。
 */
import { getLLMProvider } from '@/lib/llm';
import type { LLMContentBlock, LLMProvider } from '@/lib/llm/types';
import { logger } from '@/lib/logger';
import { computeStatus, setField, validateAll } from '@/modules/form/form.engine';
import { getDefinition, listDefinitions } from '@/modules/form/form.registry';
import { buildTools } from '@/modules/form/form.tools';
import type { Definition, FieldIssue } from '@/modules/form/form.types';
import { leaveService } from '@/modules/leave/leave.service';
import { tenantStore } from '@/modules/tenant/tenant.store';
import { listDeputyCandidates } from '@/modules/user/user.directory';
import { AppError } from '@/utils/app-error';
import { attachmentStore } from './attachment.store';
import { conversationStore } from './conversation.store';
import { resolveSubmit } from './form-submit.registry';
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

function buildSystemPrompt(tenantId: string, def: Definition): string {
  const today = new Date().toISOString().slice(0, 10);
  const hasLeaveType = 'leaveType' in def.data.properties;
  const hasDeputy = 'deputy' in def.data.properties;
  const hasHours = !!def.policy;

  // 工作方式步驟依表單能力動態組裝：只在對應工具存在時才指示模型呼叫，避免要求外出登記等
  // 表單呼叫不存在的工具（compute_leave_hours / get_leave_balances / find_deputy_candidates）。
  const steps: string[] = [
    '1. 從使用者訊息擷取可得欄位值，呼叫 fill_fields 一次填入。',
    '2. 依工具回傳的 missing/invalid，用友善的繁中逐一詢問還缺的必填欄位。',
  ];
  if (hasHours) {
    steps.push(
      '3. 必填齊全後，先呼叫 compute_leave_hours 取得本次請假時數，再用繁中摘要整張表單',
      '   （假別用中文、列出日期時間、事由，並附上「本次請假時數：N 小時」），請使用者回覆「確認」。',
    );
  } else {
    steps.push(
      '3. 必填齊全後，用繁中摘要整張表單（逐項列出已填欄位，可參考確認語句範本），請使用者回覆「確認」。',
    );
  }
  steps.push('4. 只有使用者明確回覆「確認」後才呼叫 submit；切勿自行送出，也不要捏造任何值。');
  if (hasLeaveType) {
    steps.push(
      '5. 使用者詢問假別剩餘／可用時數（例如「特休還有幾小時」「所有假別剩多少」）時，',
      '   呼叫 get_leave_balances 取得真實數字後再回答；以中文假別名稱呈現；',
      '   查無資料的假別請如實說明（例如「系統查無此假別額度」），切勿捏造時數。',
    );
  }
  if (hasDeputy) {
    steps.push(
      '6. 挑選職務代理人時，呼叫 find_deputy_candidates 取得候選清單（可帶 department 依部門篩選）。',
      '   你只能推薦或填入清單（即使用者「我的最愛」）中的人員，切勿捏造或推薦清單外的人；',
      '   候選人以「姓名(工號)」格式呈現。若使用者堅持指定清單外的人，可如實照填但不要主動推薦。',
    );
  }

  // 全系統可申請的表單清單：讓助理在被問到「有哪些表單可以申請」時能完整回答，
  // 而非只知道自己這場對話的表單。
  const currentTitle = def.data.title ?? def.agent.description;
  const allForms = listDefinitions(tenantId)
    .map((d) => `- ${d.data.title ?? d.agent.intent}：${d.agent.description}`)
    .join('\n');

  // 租戶自訂的 AI 名稱（admin 後台外觀設定）；未設則不自稱名字，維持既有行為
  const assistantName = tenantStore.getTenant(tenantId)?.appearance?.assistantName?.trim();

  const lines = [
    `你是公司 OA 系統的「${def.agent.description}」助理，全程使用繁體中文。`,
    ...(assistantName ? [`你的名字是「${assistantName}」，使用者稱呼你時即指你。`] : []),
    `今天日期是 ${today}；請把相對日期（明天、下週一等）換算成 YYYY-MM-DD。`,
    '',
    '本系統目前可申請的表單（使用者詢問「有哪些表單可以申請」時，請完整列出以下全部，',
    `勿只回答目前這張表單）：`,
    allForms,
    `這場對話正在協助你填寫「${currentTitle}」。若使用者想改申請其他表單，請告知對方可直接`,
    '說出該表單名稱或需求（例如「我要外出登記」）即可另開申請。',
    '',
    '表單欄位（填入 fill_fields 時請用機器值，例如假別 annual/sick、是否需報銷 yes/no）：',
    describeFields(def),
  ];
  if (def.agent.confirmationTemplate) {
    lines.push('', `確認語句範本：${def.agent.confirmationTemplate}`);
  }
  lines.push('', '工作方式：', ...steps);
  return lines.join('\n');
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
      // 依表單類型查表選送出 service（外出登記 / 出差報銷 / 請假…）
      const submit = resolveSubmit(session.formId);
      const result = await submit(session.tenantId, session.userId, session.values);
      session.status = 'submitted';
      session.submission = {
        oaRequestId: result.oaRequestId,
        status: result.status,
        submittedAt: result.submittedAt,
        approvals: result.approvals,
      };
      // 已送出：附件 metadata 已隨 payload 交付，清掉本地暫存的檔案內容
      attachmentStore.clearSession(session.id);
      return JSON.stringify({ ok: true, oaRequestId: result.oaRequestId, status: result.status });
    } catch (err) {
      session.status = 'failed';
      return JSON.stringify({ ok: false, error: (err as Error).message });
    }
  }

  if (name === 'get_leave_balances') {
    try {
      const balances = await leaveService.getBalances(session.userId);
      return JSON.stringify({ ok: true, balances });
    } catch (err) {
      return JSON.stringify({ ok: false, error: (err as Error).message });
    }
  }

  if (name === 'find_deputy_candidates') {
    const department = typeof input.department === 'string' ? input.department : undefined;
    const candidates = listDeputyCandidates({ requesterId: session.userId, department });
    return JSON.stringify({ ok: true, candidates });
  }

  if (name === 'compute_leave_hours') {
    const estimate = leaveService.estimateHours(session.tenantId, session.userId, session.values);
    if (!estimate) {
      return JSON.stringify({ ok: false, error: '尚無法計算（缺起訖日期或此表單未設定工時政策）' });
    }
    return JSON.stringify({ ok: true, ...estimate });
  }

  return JSON.stringify({ error: `unknown tool: ${name}` });
}

// 建議回覆產生器：站在「使用者」立場，針對助理最後一則訊息給 2-3 個可一鍵送出的短回覆。
const SUGGEST_SYSTEM = [
  '你是 OA 對話介面的「建議回覆」產生器，全程使用繁體中文。',
  '根據「助理最後一則訊息」與表單狀態，產生使用者最可能、最有幫助的接續回覆。',
  '規則：',
  '- 輸出 2-3 個選項；每個是簡短的祈使／回答短語（不超過 14 個字）。',
  '- 站在「使用者」立場回答助理，而非複述助理的話；選項之間語意不重複。',
  '- 確認階段可包含「確認送出」「修改內容」「取消」之類；收集階段則貼合助理正在詢問的欄位。',
  '只輸出 JSON 字串陣列，例如 ["確認送出","修改日期"]，不要任何額外文字或說明。',
].join('\n');

/** 從模型輸出中寬鬆解析出建議字串陣列；任何異常都回空陣列（best-effort） */
function parseSuggestions(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** 以一次獨立、輕量的 LLM 呼叫產生建議回覆；失敗不影響主流程 */
async function generateSuggestions(
  llm: LLMProvider,
  session: Session,
  reply: string,
): Promise<string[]> {
  // 對話已結束（送出／取消／失敗）不需要建議；無回覆內容也略過
  if (!reply || ['submitted', 'cancelled', 'failed'].includes(session.status)) return [];
  try {
    const userMsg = `助理最後一則訊息：\n「${reply}」\n\n目前表單狀態：${session.status}。\n請給建議回覆。`;
    const result = await llm.createMessage({
      system: SUGGEST_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: userMsg }] }],
      maxTokens: 256,
    });
    return parseSuggestions(result.text);
  } catch (err) {
    logger.warn({ err, sessionId: session.id }, 'generate suggestions failed');
    return [];
  }
}

export async function runTurn(session: Session, userText: string): Promise<TurnResult> {
  const def = getDefinition(session.tenantId, session.formId);
  const llm = getLLMProvider();
  const tools = buildTools(def);
  const system = buildSystemPrompt(session.tenantId, def);

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
  const suggestions = await generateSuggestions(llm, session, reply);

  conversationStore.save(session); // flush 本輪變更（values/status/messages/submission）
  return {
    reply,
    status: session.status,
    values: session.values,
    submission: session.submission,
    suggestions,
  };
}
