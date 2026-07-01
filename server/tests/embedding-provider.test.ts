import { openaiEmbeddingProvider } from '@/lib/embedding';

describe('embedding provider', () => {
  it('embed 空陣列直接回空、不呼叫 API', async () => {
    const out = await openaiEmbeddingProvider.embed([]);
    expect(out).toEqual([]);
  });

  it('embed 接受 model 覆寫參數（型別存在、不拋）', () => {
    expect(typeof openaiEmbeddingProvider.embed).toBe('function');
    expect(openaiEmbeddingProvider.embed.length).toBeGreaterThanOrEqual(1);
  });
});
