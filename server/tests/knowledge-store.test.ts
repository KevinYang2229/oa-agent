import { knowledgeStore } from '@/modules/knowledge/knowledge.store';

// 每個案例用唯一租戶 id，確保不受磁碟持久化的前次結果污染（idempotent）
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe('knowledgeStore', () => {
  it('未設定時回預設來源', () => {
    const s = knowledgeStore.getSource(uid('store-src'));
    expect(s.maxPages).toBeGreaterThan(0);
    expect(s.chunkChars).toBeGreaterThan(0);
    expect(s.rerank).toBe(true);
  });
  it('saveSource 後可讀回', () => {
    const t = uid('store-save');
    knowledgeStore.saveSource(t, {
      startUrl: 'https://x.com', maxPages: 50, chunkChars: 600,
      embeddingModel: 'text-embedding-3-large', rerank: false,
    });
    expect(knowledgeStore.getSource(t).startUrl).toBe('https://x.com');
    expect(knowledgeStore.getSource(t).rerank).toBe(false);
  });
  it('meta 預設 none、可更新', () => {
    const t = uid('store-meta');
    expect(knowledgeStore.getMeta(t).status).toBe('none');
    knowledgeStore.setMeta(t, { status: 'ready', chunkCount: 12, model: 'm', source: 's', generatedAt: 't' });
    expect(knowledgeStore.getMeta(t)).toMatchObject({ status: 'ready', chunkCount: 12 });
  });
});
