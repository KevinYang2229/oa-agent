/**
 * Intent Router：每輪判斷該把對話指派給哪個 AgentService。
 *
 * 混合式路由（token 最省）：
 *  1. 關鍵字先行 → 命中明確就回（0 額外 token）。
 *  2. 填表點黏中：僅在「疑似知識語氣」時才花一次 Haiku 二次確認；否則續留表單（0 token）。
 *  3. 模糊時才落到 Haiku 的 canonical-intent 分類器（服務目錄快取、強制精簡輸出）。
 */
import { env } from '@/config/env';
import { getLLMProvider } from '@/lib/llm';
import { logger } from '@/lib/logger';
import { listDefinitions } from '@/modules/form/form.registry';
import type { RouteResult } from './agent-service.types';
import type { Session } from './conversation.types';
import { isSubmitConfirmation } from './form.agent-service';
import { serviceRegistry } from './service.registry';

// 未指定 formId 且無法路由時的預設表單（沿用原 routeIntent 行為）
const DEFAULT_FORM_ID = 'leave-request';

// 疑似「知識查詢」的語氣詞：命中才考慮把填表中途插入知識問答（觸發一次 Haiku 二次確認）
const KNOWLEDGE_HINT_RE =
  /(規定|政策|辦法|制度|規章|可以嗎|可不可以|如何|怎麼|多久|幾天|幾小時|是否|說明|什麼是|定義|標準|條件|資格|請問)/;

const CLASSIFY_THRESHOLD = 0.6;

/**
 * 開場表單選擇（沿用原 conversation.service.routeIntent）：
 * 以各表單 agent.keywords 命中數挑最高分表單；無命中或無訊息則回預設請假單。
 */
export function pickFormId(tenantId: string, message?: string): string {
  const text = message?.trim();
  if (!text) return DEFAULT_FORM_ID;
  let best = DEFAULT_FORM_ID;
  let bestScore = 0;
  for (const def of listDefinitions(tenantId)) {
    const score = (def.agent.keywords ?? []).reduce(
      (n, kw) => (kw && text.includes(kw) ? n + 1 : n),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = def.formId;
    }
  }
  return best;
}

/** 關鍵字先行：掃描每個服務註冊的 intents.keywords，取最高分；唯一贏家才算 confident。 */
function keywordRoute(session: Session, text: string): { serviceId: string; confident: boolean } {
  const scores = serviceRegistry.all().map((svc) => {
    const score = svc.intents(session).reduce(
      (acc, intent) =>
        acc + intent.keywords.reduce((n, kw) => (kw && text.includes(kw) ? n + 1 : n), 0),
      0,
    );
    return { serviceId: svc.id, score };
  });
  scores.sort((a, b) => b.score - a.score);
  const [top, second] = scores;
  const confident = !!top && top.score > 0 && (!second || top.score > second.score);
  return { serviceId: top?.serviceId ?? 'form', confident };
}

/** Haiku canonical-intent 分類器：服務目錄 → 選一個 intent id → 對應 serviceId。低信心回 null。 */
async function classify(session: Session, text: string): Promise<string | null> {
  const services = serviceRegistry.all();
  const catalog = services
    .flatMap((svc) => svc.intents(session).map((i) => `- ${i.id}（服務=${svc.id}）：${i.description}`))
    .join('\n');
  const system = [
    '你是 OA 對話的意圖分類器，全程只輸出 JSON。',
    '根據使用者訊息，從下列意圖清單挑最貼近的一個：',
    catalog,
    '規則：要「填寫／申請／送出」表單 → 對應表單意圖；詢問規章、制度、額度算法、FAQ 等「想知道答案」→ kb.query。',
    '只輸出 {"intent":"<id 或 none>","confidence":0~1}，不要任何其他文字。',
  ].join('\n');
  try {
    const result = await getLLMProvider().createMessage({
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text }] }],
      model: env.LLM_ROUTER_MODEL,
      maxTokens: 64,
    });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { intent?: string; confidence?: number };
    if (!parsed.intent || parsed.intent === 'none') return null;
    if ((parsed.confidence ?? 0) < CLASSIFY_THRESHOLD) return null;
    const svc = services.find((s) => s.intents(session).some((i) => i.id === parsed.intent));
    return svc?.id ?? null;
  } catch (err) {
    logger.warn({ err, sessionId: session.id }, 'intent classify failed');
    return null;
  }
}

export const intentRouter = {
  async route(session: Session, text: string): Promise<RouteResult> {
    const activeId = session.activeServiceId ?? 'form';
    const active = serviceRegistry.tryGet(activeId);
    const inStickyFlow =
      !!active?.sticky && (session.status === 'collecting' || session.status === 'confirming');

    if (inStickyFlow) {
      // 送出確認一律留在點黏服務，避免把「可以送嗎」誤判成知識問答
      if (isSubmitConfirmation(text)) return { serviceId: activeId, viaLLM: false };
      // 無知識語氣 → 0 token 續留；有語氣才花一次 Haiku 二次確認（gate 過度觸發也由分類器把關）
      if (!KNOWLEDGE_HINT_RE.test(text)) return { serviceId: activeId, viaLLM: false };
      const classified = await classify(session, text);
      return { serviceId: classified ?? activeId, viaLLM: true };
    }

    // 非點黏流程：關鍵字先行，模糊才 Haiku
    const kw = keywordRoute(session, text);
    if (kw.confident) return { serviceId: kw.serviceId, viaLLM: false };
    const classified = await classify(session, text);
    return { serviceId: classified ?? kw.serviceId, viaLLM: true };
  },
};
