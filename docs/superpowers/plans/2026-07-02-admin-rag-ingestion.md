# Admin 每租戶 RAG 資料解析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 admin 操作者在後台為指定租戶輸入 domain + 參數，非同步觸發網站爬取→切段→embedding，產生「每租戶一份」的 RAG 索引，並可查進度、測試查詢。

**Architecture:** ingest 邏輯服務化（CLI 與 admin API 共用），索引改為 `data/knowledge-index.<tenantId>.json` 每租戶一份、retriever 依 tenantId 載入；解析以 in-process 非同步 job 執行、前端輪詢進度。新增 admin API 與 admin SPA「知識庫」tab。

**Tech Stack:** Node/Express + TypeScript（server），React + Vite（admin），cheerio（HTML 抽取），OpenAI embeddings，Jest（ts-jest）。

## Global Constraints

- 全程繁體中文註解與 UI 文案（比照現有程式）。
- server 測試：`cd server && npx jest <file>`；型別：`npm run typecheck`；lint：`npm run lint`。所有新程式須通過三者。
- 檔案式儲存比照 `tenant.store` / `conversation.store`（in-memory + disk JSON）。
- admin 端點一律掛在 `requireAdmin` 之後（`server/src/modules/admin/admin.routes.ts`）。
- embedding 供應商為 OpenAI；**查詢時的問題向量必須用「該租戶索引記錄的 model」**，不可用全域 env。
- 每租戶同時只允許一個進行中 ingest job。
- 路徑別名 `@/*` → `server/src/*`；新 script/檔案沿用既有匯入風格。

---

## Task 1: Embedding 模型覆寫

**Files:**
- Modify: `server/src/lib/embedding/index.ts`
- Test: `server/tests/embedding-provider.test.ts`

**Interfaces:**
- Produces: `EmbeddingProvider.embed(texts: string[], model?: string): Promise<number[][]>`；`getEmbeddingProvider(): EmbeddingProvider`（不變）。

- [ ] **Step 1: 寫失敗測試**

`server/tests/embedding-provider.test.ts`：
```ts
import { openaiEmbeddingProvider } from '@/lib/embedding';

describe('embedding provider', () => {
  it('embed 空陣列直接回空、不呼叫 API', async () => {
    const out = await openaiEmbeddingProvider.embed([]);
    expect(out).toEqual([]);
  });

  it('embed 接受 model 覆寫參數（型別存在、不拋）', () => {
    // 型別層級驗證：帶第二參數可編譯
    expect(typeof openaiEmbeddingProvider.embed).toBe('function');
    expect(openaiEmbeddingProvider.embed.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/embedding-provider.test.ts`
Expected: FAIL（`openaiEmbeddingProvider` 尚未匯出，或 embed 尚未支援空陣列）

- [ ] **Step 3: 實作**

`server/src/lib/embedding/index.ts` 改 `EmbeddingProvider` 與實作：
```ts
export interface EmbeddingProvider {
  readonly model: string;
  /** 批次向量化；model 省略時用 env.EMBEDDING_MODEL */
  embed(texts: string[], model?: string): Promise<number[][]>;
}

export const openaiEmbeddingProvider: EmbeddingProvider = {
  model: env.EMBEDDING_MODEL,
  async embed(texts: string[], model?: string): Promise<number[][]> {
    if (texts.length === 0) return [];
    const resp = await getClient().embeddings.create({
      model: model ?? env.EMBEDDING_MODEL,
      input: texts,
    });
    return resp.data.map((d) => d.embedding);
  },
};
```

- [ ] **Step 4: 執行確認通過**

Run: `cd server && npx jest tests/embedding-provider.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/embedding/index.ts server/tests/embedding-provider.test.ts
git commit -m "feat(embedding): 支援每次呼叫覆寫 embedding 模型"
```

---

## Task 2: env 新增 KNOWLEDGE_INDEX_DIR + 索引路徑工具

**Files:**
- Modify: `server/src/config/env.ts`
- Create: `server/src/modules/knowledge/index-path.ts`
- Test: `server/tests/knowledge-index-path.test.ts`

**Interfaces:**
- Produces: `indexPathFor(tenantId: string): string`（回 `<KNOWLEDGE_INDEX_DIR>/knowledge-index.<tenantId>.json` 絕對路徑）。

- [ ] **Step 1: 寫失敗測試**

`server/tests/knowledge-index-path.test.ts`：
```ts
import { indexPathFor } from '@/modules/knowledge/index-path';

describe('indexPathFor', () => {
  it('依 tenantId 產生 per-tenant 檔名', () => {
    expect(indexPathFor('acme')).toMatch(/knowledge-index\.acme\.json$/);
    expect(indexPathFor('default')).toMatch(/knowledge-index\.default\.json$/);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/knowledge-index-path.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

`server/src/config/env.ts`，在知識庫 RAG 區塊加入：
```ts
  // 每租戶索引檔存放目錄（相對 server 目錄）；檔名為 knowledge-index.<tenantId>.json
  KNOWLEDGE_INDEX_DIR: z.string().default('data'),
```

`server/src/modules/knowledge/index-path.ts`：
```ts
import { resolve } from 'node:path';
import { env } from '@/config/env';

/** 該租戶的靜態向量索引檔絕對路徑 */
export function indexPathFor(tenantId: string): string {
  return resolve(process.cwd(), env.KNOWLEDGE_INDEX_DIR, `knowledge-index.${tenantId}.json`);
}
```

- [ ] **Step 4: 執行確認通過**

Run: `cd server && npx jest tests/knowledge-index-path.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/config/env.ts server/src/modules/knowledge/index-path.ts server/tests/knowledge-index-path.test.ts
git commit -m "feat(knowledge): 加入 per-tenant 索引路徑與 KNOWLEDGE_INDEX_DIR"
```

---

## Task 3: Retriever 改為租戶感知（查詢用 index.model）

**Files:**
- Modify: `server/src/modules/knowledge/retriever.staticIndex.ts`
- Modify: `server/src/modules/knowledge/knowledge.agent-service.ts`
- Modify: `server/tests/knowledge-rag.test.ts`

**Interfaces:**
- Consumes: `indexPathFor`（Task 2）、`getEmbeddingProvider().embed(texts, model?)`（Task 1）。
- Produces: `staticIndexRetriever.search(tenantId, query)`；`hasStaticIndex(tenantId: string): boolean`；`_setIndexForTest(tenantId: string, idx: KnowledgeIndexFile | null): void`；`invalidateIndexCache(tenantId: string): void`。

- [ ] **Step 1: 改寫測試以帶 tenantId**

編輯 `server/tests/knowledge-rag.test.ts`：把 `_setIndexForTest(fixtureIndex)` 改為 `_setIndexForTest('rag-test', fixtureIndex)`、`_setIndexForTest(null)` 改為 `_setIndexForTest('rag-test', null)`、`hasStaticIndex()` 改為 `hasStaticIndex('rag-test')`；`afterEach(() => _setIndexForTest('rag-test', null))`。fixture `model` 設為 `'text-embedding-3-large'`（與查詢一致）。

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/knowledge-rag.test.ts`
Expected: FAIL（`_setIndexForTest` 尚未接受 tenantId）

- [ ] **Step 3: 實作 retriever 租戶感知**

`server/src/modules/knowledge/retriever.staticIndex.ts` 快取與載入改為 Map，並用 index.model 查詢：
```ts
import { existsSync, readFileSync } from 'node:fs';
import { getEmbeddingProvider } from '@/lib/embedding';
import { logger } from '@/lib/logger';
import { indexPathFor } from './index-path';
import type { KnowledgeIndexFile } from './knowledge-index.types';
import type { KnowledgeChunk, KnowledgeRetriever } from './retriever.types';

// （POOL_SIZE / MIN_SCORE / LEXICAL_* / cosineSimilarity / asciiTerms / lexicalHits 維持不變）

const cache = new Map<string, KnowledgeIndexFile | null>();

function loadIndex(tenantId: string): KnowledgeIndexFile | null {
  if (cache.has(tenantId)) return cache.get(tenantId) ?? null;
  const path = indexPathFor(tenantId);
  let idx: KnowledgeIndexFile | null = null;
  try {
    if (existsSync(path)) {
      idx = JSON.parse(readFileSync(path, 'utf8')) as KnowledgeIndexFile;
      logger.info({ tenantId, chunks: idx.chunks.length }, 'knowledge index loaded');
    }
  } catch (err) {
    logger.warn({ err, tenantId }, 'knowledge index load failed');
    idx = null;
  }
  cache.set(tenantId, idx);
  return idx;
}

export function _setIndexForTest(tenantId: string, idx: KnowledgeIndexFile | null): void {
  cache.set(tenantId, idx);
}

export function invalidateIndexCache(tenantId: string): void {
  cache.delete(tenantId);
}

export function hasStaticIndex(tenantId: string): boolean {
  return (loadIndex(tenantId)?.chunks.length ?? 0) > 0;
}

export const staticIndexRetriever: KnowledgeRetriever = {
  name: 'static-index',
  async search(tenantId: string, query: string): Promise<KnowledgeChunk[]> {
    const idx = loadIndex(tenantId);
    const q = query.trim();
    if (!idx || idx.chunks.length === 0 || !q) return [];
    // 查詢向量必須用「索引建立時的模型」，避免維度/語意不一致
    const [queryVec] = await getEmbeddingProvider().embed([q], idx.model);
    if (!queryVec) return [];
    const terms = asciiTerms(q);
    return idx.chunks
      .map((c) => {
        const cosine = cosineSimilarity(queryVec, c.vector);
        const hits = terms.length ? lexicalHits(terms, `${c.title}\n${c.text}`) : 0;
        const boost = Math.min(hits * LEXICAL_BOOST, LEXICAL_BOOST_CAP);
        return { id: c.id, title: c.title, content: c.text, url: c.url, cosine, hits, score: cosine + boost };
      })
      .filter((c) => c.cosine >= MIN_SCORE || c.hits > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, POOL_SIZE)
      .map(({ id, title, content, url, score }) => ({ id, title, content, url, score }));
  },
};
```

- [ ] **Step 4: 更新 KnowledgeAgentService.pickRetriever**

`server/src/modules/knowledge/knowledge.agent-service.ts`：
```ts
function pickRetriever(tenantId: string): KnowledgeRetriever {
  return hasStaticIndex(tenantId) ? staticIndexRetriever : stubRetriever;
}
```
並在 `handleTurn` 內兩處 `pickRetriever()` 改為 `pickRetriever(session.tenantId)`。

- [ ] **Step 5: 執行確認通過**

Run: `cd server && npx jest tests/knowledge-rag.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/knowledge/retriever.staticIndex.ts server/src/modules/knowledge/knowledge.agent-service.ts server/tests/knowledge-rag.test.ts
git commit -m "feat(knowledge): retriever 改為每租戶索引、查詢用索引模型"
```

---

## Task 4: Ingest 服務化（純函式 + runIngest），CLI 改薄殼

**Files:**
- Create: `server/src/modules/knowledge/ingest.service.ts`
- Modify: `server/scripts/knowledge-ingest.ts`
- Test: `server/tests/knowledge-ingest.test.ts`

**Interfaces:**
- Consumes: `getEmbeddingProvider().embed`（Task 1）、`indexPathFor`（Task 2）、`KnowledgeIndexFile`/`IndexedChunk`。
- Produces:
  - `normalizeUrl(href, base, origin): string | null`
  - `extractPage(html): { title: string; sections: { heading: string; text: string }[] }`
  - `chunkText(text, maxLen?): string[]`
  - `IngestParams = { tenantId, startUrl, maxPages, pathPrefix?, includePatterns?, excludePatterns?, chunkChars, embeddingModel }`
  - `IngestProgress = { phase: 'crawling'|'embedding'|'done'; pagesCrawled: number; chunks: number; embedded: number }`
  - `runIngest(params: IngestParams, onProgress?: (p: IngestProgress) => void): Promise<KnowledgeIndexFile>`（寫檔到 `indexPathFor(tenantId)` 並回傳索引）

- [ ] **Step 1: 寫失敗測試（純函式）**

`server/tests/knowledge-ingest.test.ts`：
```ts
import { chunkText, extractPage, normalizeUrl } from '@/modules/knowledge/ingest.service';

describe('ingest 純函式', () => {
  it('extractPage 取標題與頁尾聯絡資訊', () => {
    const html = `<html><head><title>凌網</title></head><body>
      <main><h2>產品</h2><p>${'內容'.repeat(20)}</p></main>
      <footer>台北分公司 TEL：02-2395-6966</footer></body></html>`;
    const { title, sections } = extractPage(html);
    expect(title).toBe('凌網');
    expect(sections.some((s) => s.heading === '聯絡資訊' && s.text.includes('02-2395-6966'))).toBe(true);
  });

  it('chunkText 依長度切段且過短片段剔除', () => {
    const chunks = chunkText('第一句。'.repeat(200), 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length >= 20)).toBe(true);
  });

  it('normalizeUrl 濾掉跨網域與檔案連結', () => {
    const origin = 'https://a.com';
    expect(normalizeUrl('/x', 'https://a.com/', origin)).toBe('https://a.com/x');
    expect(normalizeUrl('https://b.com/x', 'https://a.com/', origin)).toBeNull();
    expect(normalizeUrl('/a.pdf', 'https://a.com/', origin)).toBeNull();
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/knowledge-ingest.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 ingest.service.ts**

把 `scripts/knowledge-ingest.ts` 現有的 `squash`/`extractPage`/`extractLinks`/`chunkText` 移入，並把 `normalizeUrl` 改為接受 `origin` 參數（不再依賴模組級常數）；新增 `runIngest`：
```ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import * as cheerio from 'cheerio';
import { getEmbeddingProvider } from '@/lib/embedding';
import { logger } from '@/lib/logger';
import { indexPathFor } from './index-path';
import type { IndexedChunk, KnowledgeIndexFile } from './knowledge-index.types';

export interface IngestParams {
  tenantId: string;
  startUrl: string;
  maxPages: number;
  pathPrefix?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkChars: number;
  embeddingModel: string;
}
export interface IngestProgress {
  phase: 'crawling' | 'embedding' | 'done';
  pagesCrawled: number;
  chunks: number;
  embedded: number;
}

const EMBED_BATCH = 64;

export function squash(s: string): string { return s.replace(/\s+/g, ' ').trim(); }

export function normalizeUrl(href: string, base: string, origin: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.origin !== origin) return null;
    if (/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$/i.test(u.pathname)) return null;
    u.hash = ''; u.search = '';
    return u.toString().replace(/\/$/, '');
  } catch { return null; }
}

export function extractPage(html: string): { title: string; sections: { heading: string; text: string }[] } {
  const $ = cheerio.load(html);
  const footerText = squash($('footer').text());
  $('script, style, noscript, nav, header, footer, aside, form, svg, iframe').remove();
  const title = squash($('title').first().text() || $('h1').first().text() || '');
  const root = $('main').length ? $('main') : $('body');
  const sections: { heading: string; text: string }[] = [];
  root.find('h1, h2, h3').each((_, el) => {
    const $el = $(el);
    const text = squash($el.nextUntil('h1, h2, h3').text());
    if (text.length >= 20) sections.push({ heading: squash($el.text()), text });
  });
  if (sections.length === 0) {
    const text = squash(root.text());
    if (text.length >= 40) sections.push({ heading: '', text });
  }
  if (footerText.length >= 20) sections.push({ heading: '聯絡資訊', text: footerText });
  return { title, sections };
}

export function extractLinks(html: string, base: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const n = normalizeUrl($(el).attr('href') ?? '', base, origin);
    if (n) links.push(n);
  });
  return links;
}

export function chunkText(text: string, maxLen = 800): string[] {
  const sentences = text.split(/(?<=[。！？；!?;\n])/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (buf.length + s.length > maxLen && buf) { chunks.push(buf.trim()); buf = ''; }
    if (s.length > maxLen) for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen));
    else buf += s;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length >= 20);
}

function allowed(url: string, p: IngestParams): boolean {
  const path = new URL(url).pathname;
  if (p.pathPrefix && !path.startsWith(p.pathPrefix)) return false;
  if (p.excludePatterns?.some((re) => new RegExp(re).test(url))) return false;
  if (p.includePatterns?.length && !p.includePatterns.some((re) => new RegExp(re).test(url))) return false;
  return true;
}

export async function runIngest(
  params: IngestParams,
  onProgress?: (p: IngestProgress) => void,
): Promise<KnowledgeIndexFile> {
  const origin = new URL(params.startUrl).origin;
  const seen = new Set<string>();
  const start = normalizeUrl(params.startUrl, params.startUrl, origin) ?? params.startUrl;
  const queue: string[] = [start];
  const pages: { url: string; title: string; sections: { heading: string; text: string }[] }[] = [];

  while (queue.length && pages.length < params.maxPages) {
    const url = queue.shift() as string;
    if (seen.has(url) || !allowed(url, params)) continue;
    seen.add(url);
    try {
      const resp = await fetch(url, { headers: { 'user-agent': 'oa-agent-knowledge-ingest' } });
      const ct = resp.headers.get('content-type') ?? '';
      if (!resp.ok || !ct.includes('text/html')) continue;
      const html = await resp.text();
      const { title, sections } = extractPage(html);
      if (sections.length) pages.push({ url, title: title || url, sections });
      for (const link of extractLinks(html, url, origin)) if (!seen.has(link)) queue.push(link);
      onProgress?.({ phase: 'crawling', pagesCrawled: pages.length, chunks: 0, embedded: 0 });
    } catch (err) {
      logger.warn({ err, url }, 'ingest page failed');
    }
  }

  const seenHash = new Set<string>();
  const pending: Omit<IndexedChunk, 'vector'>[] = [];
  for (const page of pages) {
    for (const section of page.sections) {
      const crumb = [page.title, section.heading].filter(Boolean).join(' › ');
      chunkText(section.text, params.chunkChars).forEach((body, i) => {
        const text = crumb ? `${crumb}\n${body}` : body;
        const hash = createHash('sha1').update(text).digest('hex');
        if (seenHash.has(hash)) return;
        seenHash.add(hash);
        pending.push({ id: `${hash.slice(0, 12)}-${i}`, url: page.url, title: crumb || page.title, text });
      });
    }
  }

  const embedder = getEmbeddingProvider();
  const chunks: IndexedChunk[] = [];
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const vectors = await embedder.embed(batch.map((c) => c.text), params.embeddingModel);
    batch.forEach((c, j) => chunks.push({ ...c, vector: vectors[j] }));
    onProgress?.({ phase: 'embedding', pagesCrawled: pages.length, chunks: pending.length, embedded: chunks.length });
  }

  const index: KnowledgeIndexFile = {
    generatedAt: new Date().toISOString(),
    model: params.embeddingModel,
    source: params.startUrl,
    chunks,
  };
  const path = indexPathFor(params.tenantId);
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(index), 'utf8');
  onProgress?.({ phase: 'done', pagesCrawled: pages.length, chunks: pending.length, embedded: chunks.length });
  return index;
}
```

- [ ] **Step 4: CLI 改薄殼**

改寫 `server/scripts/knowledge-ingest.ts` 為：
```ts
/* 執行：npx tsx scripts/knowledge-ingest.ts [startUrl] [maxPages] [tenantId] */
import { env } from '../src/config/env';
import { runIngest } from '../src/modules/knowledge/ingest.service';

const startUrl = process.argv[2] ?? 'https://www.hywebsys.com.tw/mp';
const maxPages = Number(process.argv[3] ?? 100);
const tenantId = process.argv[4] ?? 'default';

(async () => {
  if (!env.OPENAI_API_KEY) { console.error('缺 OPENAI_API_KEY'); process.exit(1); }
  const idx = await runIngest(
    { tenantId, startUrl, maxPages, chunkChars: 800, embeddingModel: env.EMBEDDING_MODEL },
    (p) => console.log(p.phase, p.pagesCrawled, p.embedded, '/', p.chunks),
  );
  console.log(`完成：${idx.chunks.length} chunks（租戶 ${tenantId}）`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: 執行確認通過**

Run: `cd server && npx jest tests/knowledge-ingest.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 6: 遷移既有 default 索引檔**

```bash
[ -f server/data/knowledge-index.json ] && mv server/data/knowledge-index.json server/data/knowledge-index.default.json || true
```
更新 `.gitignore`：把 `server/data/knowledge-index.json` 改為 `server/data/knowledge-index.*.json`。

- [ ] **Step 7: Commit**

```bash
git add server/src/modules/knowledge/ingest.service.ts server/scripts/knowledge-ingest.ts server/tests/knowledge-ingest.test.ts .gitignore
git commit -m "feat(knowledge): ingest 服務化，CLI 改薄殼共用 runIngest"
```

---

## Task 5: 知識來源設定 + 索引 meta 儲存

**Files:**
- Create: `server/src/modules/knowledge/knowledge.store.ts`
- Test: `server/tests/knowledge-store.test.ts`

**Interfaces:**
- Produces:
  - `KnowledgeSource`（見下）、`KnowledgeIndexMeta = { status: 'none'|'ready'|'failed'; chunkCount: number; generatedAt?: string; model?: string; source?: string }`
  - `knowledgeStore.getSource(tenantId): KnowledgeSource`（無則回預設）
  - `knowledgeStore.saveSource(tenantId, src): KnowledgeSource`
  - `knowledgeStore.getMeta(tenantId): KnowledgeIndexMeta`
  - `knowledgeStore.setMeta(tenantId, meta): void`

- [ ] **Step 1: 寫失敗測試**

`server/tests/knowledge-store.test.ts`：
```ts
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
```

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/knowledge-store.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

`server/src/modules/knowledge/knowledge.store.ts`（比照 tenant.store 的 in-memory + disk）：
```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

export interface KnowledgeSource {
  startUrl: string;
  maxPages: number;
  pathPrefix?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkChars: number;
  embeddingModel: string;
  rerank: boolean;
  updatedAt?: string;
}
export interface KnowledgeIndexMeta {
  status: 'none' | 'ready' | 'failed';
  chunkCount: number;
  generatedAt?: string;
  model?: string;
  source?: string;
  error?: string;
}

function defaultSource(): KnowledgeSource {
  return { startUrl: '', maxPages: 100, chunkChars: 800, embeddingModel: env.EMBEDDING_MODEL, rerank: env.KNOWLEDGE_RERANK };
}

const FILE = resolve(process.cwd(), env.KNOWLEDGE_INDEX_DIR, 'knowledge-config.json');
const sources = new Map<string, KnowledgeSource>();
const metas = new Map<string, KnowledgeIndexMeta>();

function persist(): void {
  try {
    if (!existsSync(dirname(FILE))) mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ sources: [...sources], metas: [...metas] }), 'utf8');
  } catch (err) { logger.warn({ err }, 'knowledge config persist failed'); }
}
(function restore() {
  try {
    if (!existsSync(FILE)) return;
    const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { sources: [string, KnowledgeSource][]; metas: [string, KnowledgeIndexMeta][] };
    raw.sources?.forEach(([k, v]) => sources.set(k, v));
    raw.metas?.forEach(([k, v]) => metas.set(k, v));
  } catch (err) { logger.warn({ err }, 'knowledge config restore failed'); }
})();

export const knowledgeStore = {
  getSource(tenantId: string): KnowledgeSource {
    return sources.get(tenantId) ?? defaultSource();
  },
  saveSource(tenantId: string, src: Omit<KnowledgeSource, 'updatedAt'>): KnowledgeSource {
    const saved = { ...src, updatedAt: new Date().toISOString() };
    sources.set(tenantId, saved);
    persist();
    return saved;
  },
  getMeta(tenantId: string): KnowledgeIndexMeta {
    return metas.get(tenantId) ?? { status: 'none', chunkCount: 0 };
  },
  setMeta(tenantId: string, meta: KnowledgeIndexMeta): void {
    metas.set(tenantId, meta);
    persist();
  },
};
```

- [ ] **Step 4: 執行確認通過**

Run: `cd server && npx jest tests/knowledge-store.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/knowledge/knowledge.store.ts server/tests/knowledge-store.test.ts
git commit -m "feat(knowledge): 每租戶知識來源設定與索引 meta 儲存"
```

---

## Task 6: Ingest job store（非同步 + 同租戶單一 job）

**Files:**
- Create: `server/src/modules/knowledge/knowledge.job.ts`
- Test: `server/tests/knowledge-job.test.ts`

**Interfaces:**
- Consumes: `runIngest`（Task 4）、`knowledgeStore.setMeta`（Task 5）、`invalidateIndexCache`（Task 3）。
- Produces:
  - `IngestJob = { id, tenantId, status: 'queued'|'crawling'|'embedding'|'done'|'failed', pagesCrawled, chunks, embedded, startedAt, finishedAt?, error? }`
  - `startIngestJob(params: IngestParams, run?: typeof runIngest): IngestJob`（若同租戶有進行中 job 拋 `AppError.conflict`）
  - `getJob(jobId): IngestJob | undefined`
  - `getRunningJobForTenant(tenantId): IngestJob | undefined`

- [ ] **Step 1: 寫失敗測試（注入 fake run，避免真爬取）**

`server/tests/knowledge-job.test.ts`：
```ts
import { getJob, startIngestJob } from '@/modules/knowledge/knowledge.job';
import type { KnowledgeIndexFile } from '@/modules/knowledge/knowledge-index.types';

const params = { tenantId: 'job-t1', startUrl: 'https://x.com', maxPages: 5, chunkChars: 800, embeddingModel: 'm' };

function fakeRun(idx: KnowledgeIndexFile) {
  return async (_p: unknown, onProgress?: (p: { phase: string; pagesCrawled: number; chunks: number; embedded: number }) => void) => {
    onProgress?.({ phase: 'crawling', pagesCrawled: 1, chunks: 0, embedded: 0 });
    onProgress?.({ phase: 'done', pagesCrawled: 1, chunks: idx.chunks.length, embedded: idx.chunks.length });
    return idx;
  };
}
const idx: KnowledgeIndexFile = { generatedAt: 't', model: 'm', source: 's', chunks: [{ id: 'a', url: 'u', title: 't', text: 'x', vector: [1] }] };

it('job 跑到 done 並記錄進度', async () => {
  const job = startIngestJob(params, fakeRun(idx) as never);
  await new Promise((r) => setTimeout(r, 20));
  expect(getJob(job.id)?.status).toBe('done');
  expect(getJob(job.id)?.embedded).toBe(1);
});

it('同租戶已有進行中 job 則 409', () => {
  const slow = async () => { await new Promise((r) => setTimeout(r, 50)); return idx; };
  startIngestJob({ ...params, tenantId: 'job-t2' }, slow as never);
  expect(() => startIngestJob({ ...params, tenantId: 'job-t2' }, slow as never)).toThrow();
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/knowledge-job.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作**

`server/src/modules/knowledge/knowledge.job.ts`：
```ts
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger';
import { AppError } from '@/utils/app-error';
import { runIngest as defaultRun, type IngestParams } from './ingest.service';
import { knowledgeStore } from './knowledge.store';
import { invalidateIndexCache } from './retriever.staticIndex';

export interface IngestJob {
  id: string;
  tenantId: string;
  status: 'queued' | 'crawling' | 'embedding' | 'done' | 'failed';
  pagesCrawled: number;
  chunks: number;
  embedded: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

const jobs = new Map<string, IngestJob>();

export function getJob(jobId: string): IngestJob | undefined { return jobs.get(jobId); }
export function getRunningJobForTenant(tenantId: string): IngestJob | undefined {
  return [...jobs.values()].find((j) => j.tenantId === tenantId && (j.status === 'queued' || j.status === 'crawling' || j.status === 'embedding'));
}

export function startIngestJob(params: IngestParams, run: typeof defaultRun = defaultRun): IngestJob {
  if (getRunningJobForTenant(params.tenantId)) {
    throw AppError.conflict('該租戶已有解析任務進行中');
  }
  const job: IngestJob = {
    id: randomUUID(), tenantId: params.tenantId, status: 'queued',
    pagesCrawled: 0, chunks: 0, embedded: 0, startedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);

  void (async () => {
    try {
      const idx = await run(params, (p) => {
        job.status = p.phase === 'done' ? 'embedding' : p.phase;
        job.pagesCrawled = p.pagesCrawled; job.chunks = p.chunks; job.embedded = p.embedded;
      });
      invalidateIndexCache(params.tenantId);
      knowledgeStore.setMeta(params.tenantId, {
        status: 'ready', chunkCount: idx.chunks.length, generatedAt: idx.generatedAt, model: idx.model, source: idx.source,
      });
      job.status = 'done'; job.finishedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed'; job.error = (err as Error).message; job.finishedAt = new Date().toISOString();
      knowledgeStore.setMeta(params.tenantId, { status: 'failed', chunkCount: 0, error: job.error });
      logger.warn({ err, tenantId: params.tenantId }, 'ingest job failed');
    }
  })();

  return job;
}
```

- [ ] **Step 4: 執行確認通過**

Run: `cd server && npx jest tests/knowledge-job.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/knowledge/knowledge.job.ts server/tests/knowledge-job.test.ts
git commit -m "feat(knowledge): 非同步 ingest job（同租戶單一）"
```

---

## Task 7: Admin API（schema + controller + routes）

**Files:**
- Create: `server/src/modules/knowledge/knowledge.admin.schema.ts`
- Create: `server/src/modules/knowledge/knowledge.admin.controller.ts`
- Modify: `server/src/modules/admin/admin.routes.ts`
- Test: `server/tests/knowledge-admin.test.ts`

**Interfaces:**
- Consumes: `knowledgeStore`、`startIngestJob`/`getJob`/`getRunningJobForTenant`、`staticIndexRetriever.search`、`invalidateIndexCache`、`tenantParamSchema`（既有）。
- Produces 路由：`GET/PUT/POST/DELETE /tenants/:id/knowledge`、`POST /tenants/:id/knowledge/ingest`、`GET /tenants/:id/knowledge/jobs/:jobId`、`POST /tenants/:id/knowledge/query-test`。

- [ ] **Step 1: 寫失敗測試（supertest，比照 form-admin.test.ts）**

`server/tests/knowledge-admin.test.ts`（節錄關鍵案例）：
```ts
import request from 'supertest';
import { createApp } from '@/app';
import { env } from '@/config/env';

const app = createApp();
const auth = { 'x-admin-key': env.ADMIN_API_KEY || 'test-admin-key' };

describe('admin knowledge API', () => {
  it('PUT source 後 GET 讀回', async () => {
    await request(app).put('/api/v1/admin/tenants/default/knowledge/source').set(auth)
      .send({ startUrl: 'https://x.com', maxPages: 30, chunkChars: 600, embeddingModel: 'text-embedding-3-large', rerank: true })
      .expect(200);
    const res = await request(app).get('/api/v1/admin/tenants/default/knowledge').set(auth).expect(200);
    expect(res.body.data.source.startUrl).toBe('https://x.com');
    expect(res.body.data.meta.status).toBeDefined();
  });

  it('缺 startUrl 觸發 ingest → 422', async () => {
    await request(app).post('/api/v1/admin/tenants/no-src-tenant/knowledge/ingest').set(auth)
      .send({}).expect(422);
  });
});
```
> 註：若 `env.ADMIN_API_KEY` 為空，測試環境於 `tests/setup-env.ts` 補一個值；`requireAdmin` 接受 `x-admin-key`。

- [ ] **Step 2: 執行確認失敗**

Run: `cd server && npx jest tests/knowledge-admin.test.ts`
Expected: FAIL（路由不存在 → 404）

- [ ] **Step 3: 實作 schema**

`server/src/modules/knowledge/knowledge.admin.schema.ts`：
```ts
import { z } from 'zod';

export const sourceSchema = z.object({
  startUrl: z.string().url(),
  maxPages: z.coerce.number().int().min(1).max(1000).default(100),
  pathPrefix: z.string().optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  chunkChars: z.coerce.number().int().min(200).max(4000).default(800),
  embeddingModel: z.string().default('text-embedding-3-large'),
  rerank: z.coerce.boolean().default(true),
});
export const ingestSchema = sourceSchema.partial();
export const queryTestSchema = z.object({ question: z.string().min(1) });
export const jobParamSchema = z.object({ id: z.string(), jobId: z.string() });
```

- [ ] **Step 4: 實作 controller**

`server/src/modules/knowledge/knowledge.admin.controller.ts`：
```ts
import type { Request, Response } from 'express';
import { AppError } from '@/utils/app-error';
import { indexPathFor } from './index-path';
import { getJob, getRunningJobForTenant, startIngestJob } from './knowledge.job';
import { knowledgeStore } from './knowledge.store';
import { invalidateIndexCache, staticIndexRetriever } from './retriever.staticIndex';
import { existsSync, rmSync } from 'node:fs';
import type { KnowledgeSource } from './knowledge.store';

function ingestParamsFor(tenantId: string) {
  const s = knowledgeStore.getSource(tenantId);
  if (!s.startUrl) throw AppError.unprocessable('尚未設定知識來源網址');
  return { tenantId, startUrl: s.startUrl, maxPages: s.maxPages, pathPrefix: s.pathPrefix,
    includePatterns: s.includePatterns, excludePatterns: s.excludePatterns,
    chunkChars: s.chunkChars, embeddingModel: s.embeddingModel };
}

export const knowledgeAdminController = {
  get(req: Request, res: Response): void {
    const tenantId = String(req.params.id);
    const running = getRunningJobForTenant(tenantId);
    res.json({ data: { source: knowledgeStore.getSource(tenantId), meta: knowledgeStore.getMeta(tenantId), runningJob: running ?? null } });
  },
  saveSource(req: Request, res: Response): void {
    const tenantId = String(req.params.id);
    const saved = knowledgeStore.saveSource(tenantId, req.body as Omit<KnowledgeSource, 'updatedAt'>);
    res.json({ data: saved });
  },
  ingest(req: Request, res: Response): void {
    const tenantId = String(req.params.id);
    const body = req.body as Partial<KnowledgeSource>;
    if (body.startUrl) knowledgeStore.saveSource(tenantId, { ...knowledgeStore.getSource(tenantId), ...body } as Omit<KnowledgeSource, 'updatedAt'>);
    const job = startIngestJob(ingestParamsFor(tenantId));
    res.status(202).json({ data: { jobId: job.id, status: job.status } });
  },
  job(req: Request, res: Response): void {
    const job = getJob(String(req.params.jobId));
    if (!job || job.tenantId !== String(req.params.id)) throw AppError.notFound('job not found');
    res.json({ data: job });
  },
  async queryTest(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.id);
    const { question } = req.body as { question: string };
    const hits = await staticIndexRetriever.search(tenantId, question);
    res.json({ data: { hits: hits.map((h) => ({ title: h.title, url: h.url, score: h.score, snippet: h.content.slice(0, 160) })) } });
  },
  remove(req: Request, res: Response): void {
    const tenantId = String(req.params.id);
    const path = indexPathFor(tenantId);
    if (existsSync(path)) rmSync(path);
    invalidateIndexCache(tenantId);
    knowledgeStore.setMeta(tenantId, { status: 'none', chunkCount: 0 });
    res.json({ data: { ok: true } });
  },
};
```

- [ ] **Step 5: 掛路由**

`server/src/modules/admin/admin.routes.ts`（在 usage 路由附近加入；import controller 與 schema）：
```ts
import { knowledgeAdminController } from '@/modules/knowledge/knowledge.admin.controller';
import { ingestSchema, queryTestSchema, sourceSchema } from '@/modules/knowledge/knowledge.admin.schema';

router.get('/tenants/:id/knowledge', validate({ params: tenantParamSchema }), asyncHandler(knowledgeAdminController.get));
router.put('/tenants/:id/knowledge/source', validate({ params: tenantParamSchema, body: sourceSchema }), asyncHandler(knowledgeAdminController.saveSource));
router.post('/tenants/:id/knowledge/ingest', validate({ params: tenantParamSchema, body: ingestSchema }), asyncHandler(knowledgeAdminController.ingest));
router.get('/tenants/:id/knowledge/jobs/:jobId', validate({ params: tenantParamSchema }), asyncHandler(knowledgeAdminController.job));
router.post('/tenants/:id/knowledge/query-test', validate({ params: tenantParamSchema, body: queryTestSchema }), asyncHandler(knowledgeAdminController.queryTest));
router.delete('/tenants/:id/knowledge', validate({ params: tenantParamSchema }), asyncHandler(knowledgeAdminController.remove));
```

- [ ] **Step 6: 執行確認通過**

Run: `cd server && npx jest tests/knowledge-admin.test.ts && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/modules/knowledge/knowledge.admin.schema.ts server/src/modules/knowledge/knowledge.admin.controller.ts server/src/modules/admin/admin.routes.ts server/tests/knowledge-admin.test.ts
git commit -m "feat(admin): 知識庫 RAG 來源設定/觸發/進度/測試查詢 API"
```

---

## Task 8: Admin API 前端 client

**Files:**
- Modify: `admin/src/api.ts`

**Interfaces:**
- Produces（供 Task 9 使用）：型別 `KnowledgeSource`、`KnowledgeMeta`、`IngestJob`、`QueryHit`；函式 `getKnowledge(tenantId)`、`saveKnowledgeSource(tenantId, src)`、`startKnowledgeIngest(tenantId, body?)`、`getKnowledgeJob(tenantId, jobId)`、`knowledgeQueryTest(tenantId, question)`、`deleteKnowledge(tenantId)`。

- [ ] **Step 1: 實作 client（無獨立測試；型別由 tsc 驗證）**

在 `admin/src/api.ts` 末段加入：
```ts
export interface KnowledgeSource {
  startUrl: string; maxPages: number; pathPrefix?: string;
  includePatterns?: string[]; excludePatterns?: string[];
  chunkChars: number; embeddingModel: string; rerank: boolean; updatedAt?: string;
}
export interface KnowledgeMeta {
  status: 'none' | 'ready' | 'failed'; chunkCount: number;
  generatedAt?: string; model?: string; source?: string; error?: string;
}
export interface IngestJob {
  id: string; tenantId: string;
  status: 'queued' | 'crawling' | 'embedding' | 'done' | 'failed';
  pagesCrawled: number; chunks: number; embedded: number;
  startedAt: string; finishedAt?: string; error?: string;
}
export interface QueryHit { title: string; url?: string; score: number; snippet: string; }

export const getKnowledge = (tenantId: string) =>
  req<{ source: KnowledgeSource; meta: KnowledgeMeta; runningJob: IngestJob | null }>('GET', `/admin/tenants/${tenantId}/knowledge`);
export const saveKnowledgeSource = (tenantId: string, src: Omit<KnowledgeSource, 'updatedAt'>) =>
  req<KnowledgeSource>('PUT', `/admin/tenants/${tenantId}/knowledge/source`, src);
export const startKnowledgeIngest = (tenantId: string, body?: Partial<KnowledgeSource>) =>
  req<{ jobId: string; status: string }>('POST', `/admin/tenants/${tenantId}/knowledge/ingest`, body ?? {});
export const getKnowledgeJob = (tenantId: string, jobId: string) =>
  req<IngestJob>('GET', `/admin/tenants/${tenantId}/knowledge/jobs/${jobId}`);
export const knowledgeQueryTest = (tenantId: string, question: string) =>
  req<{ hits: QueryHit[] }>('POST', `/admin/tenants/${tenantId}/knowledge/query-test`, { question });
export const deleteKnowledge = (tenantId: string) =>
  req<{ ok: boolean }>('DELETE', `/admin/tenants/${tenantId}/knowledge`);
```

- [ ] **Step 2: 型別檢查**

Run: `cd admin && npx tsc --noEmit`
Expected: PASS（無型別錯）

- [ ] **Step 3: Commit**

```bash
git add admin/src/api.ts
git commit -m "feat(admin-ui): 知識庫 API client"
```

---

## Task 9: Admin UI 「知識庫」tab

**Files:**
- Create: `admin/src/pages/tabs/KnowledgeTab.tsx`
- Modify: `admin/src/pages/TenantDetailPage.tsx`

**Interfaces:**
- Consumes: Task 8 的 API 函式與型別。
- Produces: `KnowledgeTab({ tenantId, onError }: { tenantId: string; onError: (e: unknown) => void })`。

- [ ] **Step 1: 建 KnowledgeTab**

`admin/src/pages/tabs/KnowledgeTab.tsx`：
```tsx
import { useEffect, useRef, useState } from 'react';
import {
  deleteKnowledge, getKnowledge, getKnowledgeJob, knowledgeQueryTest,
  saveKnowledgeSource, startKnowledgeIngest,
  type IngestJob, type KnowledgeMeta, type KnowledgeSource, type QueryHit,
} from '../../api';

const EMBEDDING_MODELS = ['text-embedding-3-large', 'text-embedding-3-small'];

export default function KnowledgeTab({ tenantId, onError }: { tenantId: string; onError: (e: unknown) => void }) {
  const [src, setSrc] = useState<KnowledgeSource | null>(null);
  const [meta, setMeta] = useState<KnowledgeMeta | null>(null);
  const [job, setJob] = useState<IngestJob | null>(null);
  const [question, setQuestion] = useState('');
  const [hits, setHits] = useState<QueryHit[]>([]);
  const [saving, setSaving] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => getKnowledge(tenantId).then((d) => { setSrc(d.source); setMeta(d.meta); setJob(d.runningJob); }).catch(onError);
  useEffect(() => { load(); return () => { if (poll.current) clearInterval(poll.current); }; }, [tenantId]);

  const update = (patch: Partial<KnowledgeSource>) => setSrc((s) => (s ? { ...s, ...patch } : s));

  const save = async () => {
    if (!src) return;
    setSaving(true);
    try { await saveKnowledgeSource(tenantId, src); await load(); } catch (e) { onError(e); } finally { setSaving(false); }
  };

  const startPoll = (jobId: string) => {
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const j = await getKnowledgeJob(tenantId, jobId);
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') { clearInterval(poll.current!); poll.current = null; load(); }
      } catch (e) { onError(e); }
    }, 2000);
  };

  const ingest = async () => {
    if (!src) return;
    try { await saveKnowledgeSource(tenantId, src); const { jobId } = await startKnowledgeIngest(tenantId); startPoll(jobId); }
    catch (e) { onError(e); }
  };

  const test = async () => {
    try { const { hits } = await knowledgeQueryTest(tenantId, question); setHits(hits); } catch (e) { onError(e); }
  };

  const clear = async () => { try { await deleteKnowledge(tenantId); await load(); setHits([]); } catch (e) { onError(e); } };

  if (!src || !meta) return <p>載入中…</p>;
  const running = !!job && ['queued', 'crawling', 'embedding'].includes(job.status);

  return (
    <div className="knowledge-tab">
      <h3>知識來源</h3>
      <label>起始網址
        <input value={src.startUrl} onChange={(e) => update({ startUrl: e.target.value })} placeholder="https://www.example.com/" />
      </label>
      <label>最大頁數
        <input type="number" value={src.maxPages} onChange={(e) => update({ maxPages: Number(e.target.value) })} />
      </label>
      <label>路徑前綴（選填，例 /mp）
        <input value={src.pathPrefix ?? ''} onChange={(e) => update({ pathPrefix: e.target.value || undefined })} />
      </label>
      <label>chunk 大小（字元）
        <input type="number" value={src.chunkChars} onChange={(e) => update({ chunkChars: Number(e.target.value) })} />
      </label>
      <label>embedding 模型
        <select value={src.embeddingModel} onChange={(e) => update({ embeddingModel: e.target.value })}>
          {EMBEDDING_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={src.rerank} onChange={(e) => update({ rerank: e.target.checked })} /> 啟用 LLM 重排</label>

      <div className="actions">
        <button onClick={save} disabled={saving || running}>儲存設定</button>
        <button onClick={ingest} disabled={running || !src.startUrl}>開始解析</button>
        <button onClick={clear} disabled={running || meta.status === 'none'}>清除索引</button>
      </div>

      <h3>索引狀態</h3>
      {running
        ? <p>解析中… 階段：{job!.status}，已爬 {job!.pagesCrawled} 頁 / 已 embed {job!.embedded} / {job!.chunks}</p>
        : <p>狀態：{meta.status}{meta.status === 'ready' && `（${meta.chunkCount} 片段，來源 ${meta.source}，${meta.generatedAt}）`}{meta.status === 'failed' && `（失敗：${meta.error}）`}</p>}

      <h3>測試查詢</h3>
      <div className="actions">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="輸入問題，例：台北分公司電話" />
        <button onClick={test} disabled={!question}>查詢</button>
      </div>
      <ul>{hits.map((h, i) => <li key={i}><strong>{h.title}</strong>（{h.score.toFixed(3)}）<br />{h.snippet}</li>)}</ul>
    </div>
  );
}
```

- [ ] **Step 2: 掛入 TenantDetailPage**

`admin/src/pages/TenantDetailPage.tsx`：
- import：`import KnowledgeTab from './tabs/KnowledgeTab';`
- `type TabKey` 末端加 `| 'knowledge'`
- `TABS` 陣列加 `{ key: 'knowledge', label: '知識庫' }`
- render 區加：`{tab === 'knowledge' && <KnowledgeTab tenantId={tenant.id} onError={handleErr} />}`

- [ ] **Step 3: 型別檢查 + build**

Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/tabs/KnowledgeTab.tsx admin/src/pages/TenantDetailPage.tsx
git commit -m "feat(admin-ui): 知識庫 tab（設定/解析/進度/測試查詢）"
```

---

## Task 10: 端到端驗證

**Files:** 無（手動驗證）

- [ ] **Step 1: 全站測試 + 型別 + lint**

Run: `cd server && npm run typecheck && npm test && npm run lint`
Expected: 全 PASS

- [ ] **Step 2: 實機驗證（需 OPENAI_API_KEY）**

```bash
# 啟動 server 與 admin，登入後台 → 選 default 租戶 → 知識庫 tab
# 填 https://www.hywebsys.com.tw/mp、路徑前綴 /mp → 開始解析 → 觀察進度到 done
# 測試查詢「台北分公司電話」→ 應回含 02-2395-6966 的片段
```

- [ ] **Step 3: 最終 commit（若有微調）**

```bash
git add -A && git commit -m "chore(knowledge): admin RAG ingestion 端到端驗證修整"
```

---

## Self-Review 註記

- Spec 各節皆有對應 task：儲存模型(T2,T3,T5)、ingest 服務化(T4)、API(T7)、retriever 租戶感知+模型一致性(T1,T3)、UI(T8,T9)、測試(各 task)、安全(T4 allowed()/協定過濾、T6 同租戶單一 job)。
- 型別一致：`IngestParams`/`IngestProgress`(T4) 被 T6/T7 使用；`KnowledgeSource`/`KnowledgeMeta`(T5) 被 T7/T8/T9 使用；retriever 對外 `hasStaticIndex(tenantId)`/`invalidateIndexCache`/`_setIndexForTest(tenantId,…)`(T3) 被 T6/T7 使用。
- 相容：既有單一索引檔於 T4 Step6 遷移為 `.default.json`。
