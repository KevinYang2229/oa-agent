import { knowledgeStore } from '@/modules/knowledge/knowledge.store';

describe('knowledgeStore', () => {
  it('未設定時回預設來源', () => {
    const s = knowledgeStore.getSource('store-test-1');
    expect(s.maxPages).toBeGreaterThan(0);
    expect(s.chunkChars).toBeGreaterThan(0);
    expect(s.rerank).toBe(true);
  });
  it('saveSource 後可讀回', () => {
    knowledgeStore.saveSource('store-test-2', {
      startUrl: 'https://x.com', maxPages: 50, chunkChars: 600,
      embeddingModel: 'text-embedding-3-large', rerank: false,
    });
    expect(knowledgeStore.getSource('store-test-2').startUrl).toBe('https://x.com');
    expect(knowledgeStore.getSource('store-test-2').rerank).toBe(false);
  });
  it('meta 預設 none、可更新', () => {
    expect(knowledgeStore.getMeta('store-test-3').status).toBe('none');
    knowledgeStore.setMeta('store-test-3', { status: 'ready', chunkCount: 12, model: 'm', source: 's', generatedAt: 't' });
    expect(knowledgeStore.getMeta('store-test-3')).toMatchObject({ status: 'ready', chunkCount: 12 });
  });
});
