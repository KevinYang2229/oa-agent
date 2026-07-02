/**
 * 知識庫 admin API 整合測試（supertest）：來源設定存取 + 未設來源時觸發解析被擋。
 * 用 x-admin-key（setup-env 設 ADMIN_API_KEY=test-admin-key）。不觸發真實爬取/embedding。
 */
import request from 'supertest';
import { createApp } from '@/app';

const app = createApp();
const auth = { 'x-admin-key': 'test-admin-key' };

describe('admin knowledge API', () => {
  it('PUT source 後 GET 讀回', async () => {
    await request(app)
      .put('/api/v1/admin/tenants/default/knowledge/source')
      .set(auth)
      .send({
        startUrl: 'https://x.com',
        maxPages: 30,
        chunkChars: 600,
        embeddingModel: 'text-embedding-3-large',
        rerank: true,
      })
      .expect(200);

    const res = await request(app).get('/api/v1/admin/tenants/default/knowledge').set(auth).expect(200);
    expect(res.body.data.source.startUrl).toBe('https://x.com');
    expect(res.body.data.meta.status).toBeDefined();
  });

  it('缺 startUrl 觸發 ingest → 422', async () => {
    await request(app)
      .post('/api/v1/admin/tenants/no-src-tenant-xyz/knowledge/ingest')
      .set(auth)
      .send({})
      .expect(422);
  });

  it('未帶 admin key → 401/403', async () => {
    const res = await request(app).get('/api/v1/admin/tenants/default/knowledge');
    expect([401, 403]).toContain(res.status);
  });
});
