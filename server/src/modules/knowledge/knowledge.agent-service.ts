/**
 * Knowledge Agent 服務（介面 + stub）。
 *
 * sticky=false：屬「旁路」服務——回答知識問題後不奪走目前填表流程，
 * 且**不動 session 的 values / status**，下一輪 Form 服務可無縫續填。
 * 本輪以 stub 檢索直接組答；真 RAG 內臟（pgvector/embedding + LLM 引用格式化）為後續 iteration。
 */
import type { LLMProvider } from '@/lib/llm/types';
import { logger } from '@/lib/logger';
import type {
  AgentService,
  AgentTurnResult,
  IntentDescriptor,
} from '@/modules/conversation/agent-service.types';
import type { Session } from '@/modules/conversation/conversation.types';
import { stubRetriever } from './retriever.stub';
import type { KnowledgeRetriever } from './retriever.types';

// 之後可換成 pgvectorRetriever（同介面）
const retriever: KnowledgeRetriever = stubRetriever;

const KB_KEYWORDS = [
  '規定',
  '政策',
  '辦法',
  '制度',
  '規章',
  'FAQ',
  '怎麼算',
  '如何申請',
  '資格',
  '條件',
  '說明',
];

export const knowledgeAgentService: AgentService = {
  id: 'knowledge',
  sticky: false,

  intents(): IntentDescriptor[] {
    return [
      {
        id: 'kb.query',
        keywords: KB_KEYWORDS,
        description: '查詢公司規章、制度、假別/報銷規定、額度算法、FAQ 等「知道答案」類問題',
      },
    ];
  },

  async handleTurn(
    session: Session,
    userText: string,
    _llm: LLMProvider,
  ): Promise<AgentTurnResult> {
    const chunks = await retriever.search(session.tenantId, userText);
    const reply =
      chunks.length === 0
        ? '目前知識庫查無相關規章，建議洽詢人資或稍後再試。'
        : ['依公司規章：', ...chunks.map((c) => `・${c.title}：${c.content}`)].join('\n');

    // 旁路回答：只在逐字稿留紀錄，刻意不觸碰 session.values / session.status
    session.messages.push({ role: 'assistant', content: [{ type: 'text', text: reply }] });
    logger.info({ sessionId: session.id, hits: chunks.length }, 'knowledge answer');
    return { reply };
  },
};
