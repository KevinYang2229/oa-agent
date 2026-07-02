/**
 * 知識庫 admin controller：每租戶知識來源設定、觸發解析、查進度、測試查詢、清除索引。
 * 全部端點受 requireAdmin 保護（掛載於 admin.routes）。
 */
import { existsSync, rmSync } from 'node:fs';
import type { Request, Response } from 'express';
import { AppError } from '@/utils/app-error';
import { indexPathFor } from './index-path';
import type { IngestParams } from './ingest.service';
import { getJob, getRunningJobForTenant, startIngestJob } from './knowledge.job';
import { knowledgeStore, type KnowledgeSource } from './knowledge.store';
import { invalidateIndexCache, staticIndexRetriever } from './retriever.staticIndex';

/** 由已存來源設定組出 ingest 參數；未設定起始網址則擋下 */
function ingestParamsFor(tenantId: string): IngestParams {
  const s = knowledgeStore.getSource(tenantId);
  if (!s.startUrl) throw AppError.unprocessable('尚未設定知識來源網址');
  return {
    tenantId,
    startUrl: s.startUrl,
    maxPages: s.maxPages,
    pathPrefix: s.pathPrefix,
    includePatterns: s.includePatterns,
    excludePatterns: s.excludePatterns,
    chunkChars: s.chunkChars,
    embeddingModel: s.embeddingModel,
  };
}

export const knowledgeAdminController = {
  async get(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.id);
    res.json({
      data: {
        source: knowledgeStore.getSource(tenantId),
        meta: knowledgeStore.getMeta(tenantId),
        runningJob: getRunningJobForTenant(tenantId) ?? null,
      },
    });
  },

  async saveSource(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.id);
    const saved = knowledgeStore.saveSource(tenantId, req.body as Omit<KnowledgeSource, 'updatedAt'>);
    res.json({ data: saved });
  },

  async ingest(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.id);
    const body = req.body as Partial<KnowledgeSource>;
    // 有帶覆寫參數時先存起來，再依最終設定啟動 job
    if (body.startUrl) {
      knowledgeStore.saveSource(tenantId, {
        ...knowledgeStore.getSource(tenantId),
        ...body,
      } as Omit<KnowledgeSource, 'updatedAt'>);
    }
    const job = startIngestJob(ingestParamsFor(tenantId));
    res.status(202).json({ data: { jobId: job.id, status: job.status } });
  },

  async job(req: Request, res: Response): Promise<void> {
    const job = getJob(String(req.params.jobId));
    if (!job || job.tenantId !== String(req.params.id)) throw AppError.notFound('job not found');
    res.json({ data: job });
  },

  async queryTest(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.id);
    const { question } = req.body as { question: string };
    const hits = await staticIndexRetriever.search(tenantId, question);
    res.json({
      data: {
        hits: hits.map((h) => ({
          title: h.title,
          url: h.url,
          score: h.score,
          snippet: h.content.slice(0, 160),
        })),
      },
    });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.id);
    const path = indexPathFor(tenantId);
    if (existsSync(path)) rmSync(path);
    invalidateIndexCache(tenantId);
    knowledgeStore.setMeta(tenantId, { status: 'none', chunkCount: 0 });
    res.json({ data: { ok: true } });
  },
};
