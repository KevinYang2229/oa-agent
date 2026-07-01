import { resolve } from 'node:path';
import { env } from '@/config/env';

/** 該租戶的靜態向量索引檔絕對路徑 */
export function indexPathFor(tenantId: string): string {
  return resolve(process.cwd(), env.KNOWLEDGE_INDEX_DIR, `knowledge-index.${tenantId}.json`);
}
