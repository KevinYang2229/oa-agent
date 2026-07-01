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
