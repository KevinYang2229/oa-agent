import { getJob, startIngestJob } from '@/modules/knowledge/knowledge.job';
import type { KnowledgeIndexFile } from '@/modules/knowledge/knowledge-index.types';

const params = { tenantId: 'job-t1', startUrl: 'https://x.com', maxPages: 5, chunkChars: 800, embeddingModel: 'm' };
const idx: KnowledgeIndexFile = { generatedAt: 't', model: 'm', source: 's', chunks: [{ id: 'a', url: 'u', title: 't', text: 'x', vector: [1] }] };

function fakeRun(index: KnowledgeIndexFile) {
  return async (_p: unknown, onProgress?: (p: { phase: string; pagesCrawled: number; chunks: number; embedded: number }) => void) => {
    onProgress?.({ phase: 'crawling', pagesCrawled: 1, chunks: 0, embedded: 0 });
    onProgress?.({ phase: 'done', pagesCrawled: 1, chunks: index.chunks.length, embedded: index.chunks.length });
    return index;
  };
}

it('job 跑到 done 並記錄進度', async () => {
  const job = startIngestJob(params, fakeRun(idx) as never);
  await new Promise((r) => setTimeout(r, 20));
  expect(getJob(job.id)?.status).toBe('done');
  expect(getJob(job.id)?.embedded).toBe(1);
});

it('同租戶已有進行中 job 則丟錯', () => {
  const slow = async () => { await new Promise((r) => setTimeout(r, 50)); return idx; };
  startIngestJob({ ...params, tenantId: 'job-t2' }, slow as never);
  expect(() => startIngestJob({ ...params, tenantId: 'job-t2' }, slow as never)).toThrow();
});
