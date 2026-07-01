# 設計：Admin 後台 · 每租戶 RAG 資料解析

日期：2026-07-02
狀態：設計已確認，待實作計畫

## Context（為什麼做）

目前知識庫 RAG 的索引由 CLI 腳本（`scripts/knowledge-ingest.ts`）手動執行、寫入單一全域檔 `data/knowledge-index.json`。要讓非工程人員也能為**各租戶**設定知識來源，需在 admin 後台提供：輸入 domain、填參數、觸發解析、看進度與結果。

本設計把 ingest 邏輯服務化、索引改為每租戶一份、並提供 admin API + UI。

## 決策（已與使用者確認）

- **每租戶各自一份索引**（依 tenantId 隔離）。
- **非同步任務 + 前端輪詢**（不阻塞請求；無需引入 BullMQ）。
- **完整可調參數**（domain、頁數、路徑規則、chunk 大小、embedding 模型、重排開關）。
- **範圍＝後端 API + admin UI 頁面**。
- job 狀態存記憶體（重啟遺失進度，但已完成索引檔持久）——符合現行 MVP。

## Goals / Non-Goals

**Goals**
- admin 操作者可為指定租戶設定知識來源並觸發解析，看進度與結果，並當場測試查詢。
- 索引依租戶隔離；查詢時只用該租戶的索引。
- ingest 邏輯單一來源（服務化），CLI 與 API 共用。

**Non-Goals（本輪不做）**
- pgvector / DB 儲存（介面已預留，未來替換 retriever 實作）。
- job 持久化 / 跨實例（in-memory 即可）。
- 排程自動重爬（僅手動觸發）。
- 專用 cross-encoder reranker（維持現有 Haiku 重排）。

## 架構總覽

```
Admin UI（KnowledgeTab）
   │ PUT source / POST ingest / GET job（輪詢）/ POST query-test
   ▼
admin API（requireAdmin）── knowledge.controller
   │
   ├─ knowledge.store（來源設定 + 索引 meta，落 data/knowledge-config.json）
   ├─ job store（Map<jobId, IngestJob>，in-memory）
   └─ ingest.service.runIngest(params, onProgress)  ← 由 CLI 與 API 共用
             │ 爬取→抽正文→切段→embedding
             ▼
      data/knowledge-index.<tenantId>.json
             ▲
   查詢：KnowledgeAgentService → retriever.staticIndex（租戶感知，Map<tenantId,index>）
```

## 1. 儲存模型（in-memory + disk JSON，比照 tenant.store）

- **`modules/knowledge/knowledge.store.ts`**
  - `KnowledgeSource`：`{ tenantId, startUrl, maxPages, pathPrefix?, includePatterns?, excludePatterns?, chunkChars, embeddingModel, rerank, updatedAt }`
  - `KnowledgeIndexMeta`：`{ tenantId, status: 'none'|'ready'|'failed', chunkCount, generatedAt?, model?, source? }`
  - 落 `data/knowledge-config.json`（讀寫比照 tenant.store 的 save/restore）。
- **索引檔**：`data/knowledge-index.<tenantId>.json`（每租戶一份）。目錄由 env `KNOWLEDGE_INDEX_DIR`（預設 `data`）決定。
- **Job store**：記憶體 `Map<jobId, IngestJob>`。
  - `IngestJob`：`{ id, tenantId, status: 'queued'|'crawling'|'embedding'|'done'|'failed', pagesCrawled, chunks, embedded, startedAt, finishedAt?, error? }`
  - 同租戶同時只允許一個進行中 job。

## 2. Ingest 服務化

- 新 `modules/knowledge/ingest.service.ts`：`runIngest(params: KnowledgeSource & { tenantId }, onProgress): Promise<KnowledgeIndexFile>`。
  - 將 `scripts/knowledge-ingest.ts` 內的爬取 / 抽正文 / 切段 / embedding 移入，寫檔到該租戶路徑。
  - 純函式（`normalizeUrl`、`extractPage`、`chunkText`）獨立匯出供單元測試。
  - `onProgress(phase, counts)` 回報進度供 job store 更新。
- `scripts/knowledge-ingest.ts` 改為薄殼：解析 argv → 呼叫 `runIngest`（tenantId 預設 `default`）。行為與現況一致。

## 3. Admin API（`/api/v1/admin/tenants/:id/knowledge`，`requireAdmin`）

| 方法 | 路徑 | 作用 |
|---|---|---|
| GET | `/knowledge` | 回來源設定 + 索引 meta + 進行中 job（若有） |
| PUT | `/knowledge/source` | 儲存來源設定（zod 驗證），不執行 |
| POST | `/knowledge/ingest` | 以已存設定（或 body 覆寫）啟動 job → `{ jobId }`；同租戶已有 job 執行中回 409 |
| GET | `/knowledge/jobs/:jobId` | job 狀態/進度（輪詢用） |
| POST | `/knowledge/query-test` | `{ question }` → 回 top-k 片段（title/url/score/snippet），供驗證 |
| DELETE | `/knowledge` | 清除該租戶索引與 meta |

- 控制器 `knowledge.controller.ts` + `knowledge.schema.ts`（zod）比照現有 admin 模組。
- 掛載於 `admin.routes.ts`，`requireAdmin` 之後。

## 4. Retriever 改為租戶感知

- `retriever.staticIndex.ts`：單一快取 → `Map<tenantId, KnowledgeIndexFile|null>`；路徑 `resolve(KNOWLEDGE_INDEX_DIR, 'knowledge-index.<tenantId>.json')`。
- `search(tenantId, query)` 已帶 tenantId，呼叫端免改。
- `hasStaticIndex(tenantId)`、`_setIndexForTest(tenantId, idx)`、清快取 helper 皆改為租戶感知。
- `KnowledgeAgentService.pickRetriever(session)` 依 `session.tenantId` 判斷（有索引走靜態、否則 stub）。
- ingest 完成 / 刪除後需使該租戶快取失效（reload）。
- **相容處理**：目前的 `data/knowledge-index.json` 視為 `default` 租戶，改名/搬移為 `data/knowledge-index.default.json`；保留 `KNOWLEDGE_INDEX_PATH` 對 default 的相容讀取（若存在）。
- **embedding 模型一致性（重要）**：因為模型可每租戶不同，查詢時的問題向量**必須用「該租戶索引所記錄的 `model`」**，不能用全域 env，否則維度/語意不一致（相似度失真）。作法：`EmbeddingProvider.embed(texts, model?)` 加上模型覆寫；`ingest.service` 用來源設定的 `embeddingModel`，`retriever.search` 用 `index.model` 呼叫 embed。index 內既已記錄 `model`，退回時仍保有現行 mismatch 警告。

## 5. Admin UI（TenantDetailPage 新增「知識庫」tab）

- `admin/src/pages/tabs/KnowledgeTab.tsx`，比照 `WebhookTab`（props：`tenantId`、`onError`）。
- **設定表單**：起始網址、最大頁數、路徑前綴、include/exclude 規則、chunk 大小、embedding 模型（下拉）、重排開關 →「儲存設定」。
- **執行**：「開始解析」→ POST ingest → 每 ~2s 輪詢 job → 進度（已爬頁數 / chunk / 已 embed）→ 完成刷新狀態卡。
- **狀態卡**：索引狀態、chunk 數、產生時間、來源。
- **測試查詢**：輸入問題 → 顯示 top-k 命中。
- `admin/src/api.ts` 新增型別與函式；`TenantDetailPage.tsx` 的 `TabKey`/`TABS`/render 加入 `knowledge`。

## 6. 測試

- 純函式：`extractPage`、`chunkText`、`normalizeUrl` 單元測試（含 footer 擷取）。
- `runIngest`：mock fetch + mock embedder，驗證產出索引結構與進度回報。
- `knowledge.store`：設定/meta 存取往返。
- job 生命週期：queued→crawling→embedding→done / failed；同租戶並行守門回 409。
- retriever 租戶感知：`_setIndexForTest(tenantId,…)` 後只回該租戶片段。
- Admin API：比照 `form-admin.test.ts`，以 stub 注入 ingest 跑通 source/ingest/job/query-test。

## 7. 安全

- 全部端點 `requireAdmin`（操作者可信）。
- 爬取守門：僅 http/https、單頁逾時、頁數與單頁大小上限、同租戶單一 job。
- SSRF 風險因僅限 admin 而低，於程式碼註明；未來若開放租戶自助需再收緊（例如禁內網 IP）。

## 風險 / 已知取捨

- job 狀態記憶體存放：伺服器重啟時進行中 job 遺失（需重新觸發）；已完成索引檔不受影響。
- 檔案式索引：單機、不適合多實例水平擴充；擴充路徑為 pgvector（介面已備）。
- 爬取品質依站台結構；抽取器已處理 heading/footer，但非萬用。

## 對應改動檔案（預估）

- 新增：`modules/knowledge/{knowledge.store,ingest.service,knowledge.controller,knowledge.schema,knowledge.job.store}.ts`
- 改：`retriever.staticIndex.ts`、`knowledge.agent-service.ts`、`scripts/knowledge-ingest.ts`、`admin.routes.ts`、`config/env.ts`（`KNOWLEDGE_INDEX_DIR`）
- 前端：`admin/src/pages/tabs/KnowledgeTab.tsx`、`admin/src/api.ts`、`admin/src/pages/TenantDetailPage.tsx`
- 測試：`tests/knowledge-ingest.test.ts`、`tests/knowledge-store.test.ts`、`tests/knowledge-admin.test.ts`、`tests/retriever-tenant.test.ts`
