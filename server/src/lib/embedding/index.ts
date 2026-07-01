/**
 * Embedding provider（用於知識庫 RAG）。
 *
 * Claude 無原生 embedding API，故用 OpenAI text-embedding-3-small（便宜、品質足）；
 * 與主對話 LLM（可為 anthropic）互不影響。索引與查詢共用同一模型/維度。
 */
import OpenAI from 'openai';
import { env } from '@/config/env';

export interface EmbeddingProvider {
  readonly model: string;
  /** 批次向量化；回傳順序與輸入對應 */
  embed(texts: string[]): Promise<number[][]>;
}

// 延遲建立：OpenAI SDK 無 key 時建構即拋錯，避免 provider=anthropic 也被卡住啟動
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export const openaiEmbeddingProvider: EmbeddingProvider = {
  model: env.EMBEDDING_MODEL,
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const resp = await getClient().embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: texts,
    });
    return resp.data.map((d) => d.embedding);
  },
};

export function getEmbeddingProvider(): EmbeddingProvider {
  return openaiEmbeddingProvider;
}
