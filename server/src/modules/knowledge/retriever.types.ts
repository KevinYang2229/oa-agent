/**
 * 知識檢索器介面（可插拔，對齊 lib/oa 的 stub/http 模式）。
 *
 * 本輪只有 stub 實作；之後接 pgvector + embedding 的真 RAG 時，
 * 新增 retriever.pgvector.ts 實作同介面即可，不動 KnowledgeAgentService。
 */
export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  /** 檢索分數（越大越相關）；stub 為關鍵字命中數，之後為向量相似度 */
  score?: number;
}

export interface KnowledgeRetriever {
  readonly name: string;
  search(tenantId: string, query: string): Promise<KnowledgeChunk[]>;
}
