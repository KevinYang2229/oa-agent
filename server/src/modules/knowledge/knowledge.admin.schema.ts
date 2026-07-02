/** 知識庫 admin API 的請求驗證 schema（zod）。 */
import { z } from 'zod';

/** 知識來源設定（PUT /knowledge/source 的 body） */
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

/** 觸發解析（POST /knowledge/ingest 的 body）：可部分覆寫已存設定 */
export const ingestSchema = sourceSchema.partial();

/** 測試查詢（POST /knowledge/query-test 的 body） */
export const queryTestSchema = z.object({ question: z.string().min(1) });
