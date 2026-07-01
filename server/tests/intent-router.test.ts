/**
 * Intent Router + 可插拔服務路由行為。
 *
 * 驗證：關鍵字先行（0 token）、填表點黏、知識旁路插入、Haiku 分類 fallback、低信心退回，
 * 以及 KnowledgeAgentService 旁路回答不觸碰 form 狀態。
 */
jest.mock('@/lib/llm', () => ({
  __esModule: true,
  getLLMProvider: jest.fn(),
}));

import { getLLMProvider } from '@/lib/llm';
import type { Session } from '@/modules/conversation/conversation.types';
import { intentRouter } from '@/modules/conversation/intent-router';
import { knowledgeAgentService } from '@/modules/knowledge/knowledge.agent-service';

function makeSession(partial: Partial<Session> = {}): Session {
  return {
    id: 's1',
    tenantId: 'router-test',
    userId: 'HYW103',
    formId: 'leave-request',
    values: {},
    status: 'collecting',
    activeServiceId: 'form',
    messages: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

let mockCreate: jest.Mock;

beforeEach(() => {
  mockCreate = jest
    .fn()
    .mockResolvedValue({ text: '{"intent":"none","confidence":0}', toolCalls: [], stopReason: 'end_turn' });
  (getLLMProvider as jest.Mock).mockReturnValue({ name: 'mock', createMessage: mockCreate });
});

describe('intentRouter.route', () => {
  it('填表點黏：一般續填訊息續留 form，且不動用分類器（0 token）', async () => {
    const r = await intentRouter.route(makeSession(), '明天下午三點到五點');
    expect(r.serviceId).toBe('form');
    expect(r.viaLLM).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('送出確認一律留在 form，不誤判為知識問答', async () => {
    const r = await intentRouter.route(makeSession({ status: 'confirming' }), '確認送出');
    expect(r.serviceId).toBe('form');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('填表中插入知識問句 → Haiku 判為 kb.query → 指派 knowledge', async () => {
    mockCreate.mockResolvedValue({
      text: '{"intent":"kb.query","confidence":0.9}',
      toolCalls: [],
      stopReason: 'end_turn',
    });
    const r = await intentRouter.route(makeSession(), '特休規定是幾天？');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(r.serviceId).toBe('knowledge');
    expect(r.viaLLM).toBe(true);
  });

  it('填表中疑似語氣但 Haiku 判為表單意圖 → 續留 form', async () => {
    mockCreate.mockResolvedValue({
      text: '{"intent":"leave-request.apply","confidence":0.85}',
      toolCalls: [],
      stopReason: 'end_turn',
    });
    const r = await intentRouter.route(makeSession(), '請問可以幫我請幾天假');
    expect(r.serviceId).toBe('form');
  });

  it('分類信心低於門檻 → 退回目前點黏服務（form）', async () => {
    mockCreate.mockResolvedValue({
      text: '{"intent":"kb.query","confidence":0.3}',
      toolCalls: [],
      stopReason: 'end_turn',
    });
    const r = await intentRouter.route(makeSession(), '這個規定我不太懂');
    expect(r.serviceId).toBe('form');
  });

  it('非點黏流程：關鍵字唯一命中 knowledge → 直接指派、0 token', async () => {
    const r = await intentRouter.route(makeSession({ status: 'submitted' }), '我想看 FAQ');
    expect(r.serviceId).toBe('knowledge');
    expect(r.viaLLM).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('knowledgeAgentService（旁路，不觸碰 form 狀態）', () => {
  it('回答知識問題但不改動 session.values / status', async () => {
    const session = makeSession({ values: { leaveType: 'annual' }, status: 'collecting' });
    const valuesBefore = JSON.stringify(session.values);

    const res = await knowledgeAgentService.handleTurn(
      session,
      '特休規定幾天',
      { name: 'mock', createMessage: mockCreate } as never,
    );

    expect(res.reply).toContain('特休');
    expect(JSON.stringify(session.values)).toBe(valuesBefore);
    expect(session.status).toBe('collecting');
    expect(session.activeServiceId).toBe('form'); // 旁路不奪走點黏擁有權
    expect(session.messages.at(-1)?.role).toBe('assistant');
    expect(mockCreate).not.toHaveBeenCalled(); // stub 不需 LLM
  });

  it('查無相關規章時回退訊息', async () => {
    const session = makeSession();
    const res = await knowledgeAgentService.handleTurn(session, '完全無關的問題xyz', {} as never);
    expect(res.reply).toContain('查無');
  });
});
