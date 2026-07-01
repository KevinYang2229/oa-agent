/*
 * 知識庫 ingest：爬取靜態網站 → 抽正文 → 切 chunk → embed → 產生 knowledge-index.json。
 *
 * 一次性（或內容更新時）執行；查詢端由 retriever.staticIndex 讀取此檔。
 * 需要 OPENAI_API_KEY（embedding）。
 *
 * 執行：
 *   npx tsx scripts/knowledge-ingest.ts [startUrl] [maxPages]
 * 例：
 *   npx tsx scripts/knowledge-ingest.ts https://www.hywebsys.com.tw/mp 100
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { env } from '../src/config/env';
import { getEmbeddingProvider } from '../src/lib/embedding';
import type { IndexedChunk, KnowledgeIndexFile } from '../src/modules/knowledge/knowledge-index.types';

const START_URL = process.argv[2] ?? 'https://www.hywebsys.com.tw/mp';
const MAX_PAGES = Number(process.argv[3] ?? 100);
const MAX_CHUNK_CHARS = 800;
const EMBED_BATCH = 64;
const OUT_PATH = resolve(process.cwd(), env.KNOWLEDGE_INDEX_PATH);

const ORIGIN = new URL(START_URL).origin;

/** 正規化 URL：同源、去 hash/query、去尾斜線；非 http(s) 或非同源或疑似檔案則回 null */
function normalizeUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.origin !== ORIGIN) return null;
    if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$/i.test(u.pathname)) return null;
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

interface Section {
  heading: string;
  text: string;
}

interface Page {
  url: string;
  title: string;
  sections: Section[];
}

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 抽正文並依標題切段（提升精準度）：每個 h1~h3 到下一個標題間為一個 section，
 * 保留「段落標題」讓後續 chunk 可加 breadcrumb（頁標題 > 段標題）作語境。
 * 無標題結構時退回整頁單一 section。
 */
function extractPage(html: string): { title: string; sections: Section[] } {
  const $ = cheerio.load(html);
  // 先擷取頁尾聯絡資訊（電話/地址/信箱常在 footer），再移除非內容元素避免雜訊
  const footerText = squash($('footer').text());
  $('script, style, noscript, nav, header, footer, aside, form, svg, iframe').remove();
  const title = squash($('title').first().text() || $('h1').first().text() || '');
  const root = $('main').length ? $('main') : $('body');

  const sections: Section[] = [];
  root.find('h1, h2, h3').each((_, el) => {
    const $el = $(el);
    const heading = squash($el.text());
    const text = squash($el.nextUntil('h1, h2, h3').text());
    if (text.length >= 20) sections.push({ heading, text });
  });

  // 無標題結構（或全被過濾）：退回整頁單一 section
  if (sections.length === 0) {
    const text = squash(root.text());
    if (text.length >= 40) sections.push({ heading: '', text });
  }

  // 頁尾聯絡資訊獨立成 section（電話/地址）；跨頁重複由內容 hash 去重收斂成一筆
  if (footerText.length >= 20) sections.push({ heading: '聯絡資訊', text: footerText });
  return { title, sections };
}

function extractLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const norm = normalizeUrl($(el).attr('href') ?? '', base);
    if (norm) links.push(norm);
  });
  return links;
}

/** 依句子累積切 chunk（到 ~MAX_CHUNK_CHARS 為界），避免切斷語意；單句超長才硬切 */
function chunkText(text: string, maxLen = MAX_CHUNK_CHARS): string[] {
  const sentences = text
    .split(/(?<=[。！？；!?;\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (buf.length + s.length > maxLen && buf) {
      chunks.push(buf.trim());
      buf = '';
    }
    if (s.length > maxLen) {
      for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen));
    } else {
      buf += s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length >= 20);
}

async function crawl(): Promise<Page[]> {
  const seen = new Set<string>();
  const queue: string[] = [normalizeUrl(START_URL, START_URL) ?? START_URL];
  const pages: Page[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift() as string;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const resp = await fetch(url, { headers: { 'user-agent': 'oa-agent-knowledge-ingest' } });
      const ct = resp.headers.get('content-type') ?? '';
      if (!resp.ok || !ct.includes('text/html')) continue;
      const html = await resp.text();
      const { title, sections } = extractPage(html);
      if (sections.length > 0) pages.push({ url, title: title || url, sections });
      for (const link of extractLinks(html, url)) {
        if (!seen.has(link)) queue.push(link);
      }
      const chars = sections.reduce((n, s) => n + s.text.length, 0);
      console.log(`✓ [${pages.length}/${MAX_PAGES}] ${url}（${sections.length} 段 / ${chars} 字）`);
    } catch (err) {
      console.warn(`✗ ${url}: ${(err as Error).message}`);
    }
  }
  return pages;
}

async function main(): Promise<void> {
  if (!env.OPENAI_API_KEY) {
    console.error('缺 OPENAI_API_KEY，無法產生 embedding。請於 .env 設定後再執行。');
    process.exit(1);
  }
  console.log(`爬取起點：${START_URL}（上限 ${MAX_PAGES} 頁）`);
  const pages = await crawl();
  console.log(`共取得 ${pages.length} 頁，開始切 chunk…`);

  // 切 chunk（以內容 hash 去重）；每個 chunk 前置 breadcrumb（頁標題 › 段標題）作語境，
  // 讓 embedding 與作答 LLM 都拿到「這段在講什麼主題」，大幅提升檢索與引用精準度。
  const seenHash = new Set<string>();
  const pending: Array<Omit<IndexedChunk, 'vector'>> = [];
  for (const page of pages) {
    for (const section of page.sections) {
      const crumb = [page.title, section.heading].filter(Boolean).join(' › ');
      chunkText(section.text).forEach((body, i) => {
        const text = crumb ? `${crumb}\n${body}` : body;
        const hash = createHash('sha1').update(text).digest('hex');
        if (seenHash.has(hash)) return;
        seenHash.add(hash);
        pending.push({ id: `${hash.slice(0, 12)}-${i}`, url: page.url, title: crumb || page.title, text });
      });
    }
  }
  console.log(`共 ${pending.length} 個 chunk，開始 embedding（模型 ${env.EMBEDDING_MODEL}）…`);

  const embedder = getEmbeddingProvider();
  const chunks: IndexedChunk[] = [];
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const vectors = await embedder.embed(batch.map((c) => c.text));
    batch.forEach((c, j) => chunks.push({ ...c, vector: vectors[j] }));
    console.log(`  embedded ${Math.min(i + EMBED_BATCH, pending.length)}/${pending.length}`);
  }

  const index: KnowledgeIndexFile = {
    generatedAt: new Date().toISOString(),
    model: env.EMBEDDING_MODEL,
    source: START_URL,
    chunks,
  };

  if (!existsSync(dirname(OUT_PATH))) mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(index), 'utf8');
  console.log(`完成：${chunks.length} chunks 已寫入 ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
