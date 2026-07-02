import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type IngestJob, type KnowledgeMeta, type KnowledgeSource, type QueryHit } from '../../api';

const EMBEDDING_MODELS = ['text-embedding-3-large', 'text-embedding-3-small'];

export default function KnowledgeTab({
  tenantId,
  onError,
}: {
  tenantId: string;
  onError: (e: unknown) => void;
}) {
  const [src, setSrc] = useState<KnowledgeSource | null>(null);
  const [meta, setMeta] = useState<KnowledgeMeta | null>(null);
  const [job, setJob] = useState<IngestJob | null>(null);
  const [question, setQuestion] = useState('');
  const [hits, setHits] = useState<QueryHit[]>([]);
  const [saving, setSaving] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.getKnowledge(tenantId);
      setSrc(d.source);
      setMeta(d.meta);
      setJob(d.runningJob);
    } catch (e) {
      onError(e);
    }
  }, [tenantId, onError]);

  useEffect(() => {
    load();
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [load]);

  const update = (patch: Partial<KnowledgeSource>) => setSrc((s) => (s ? { ...s, ...patch } : s));

  const save = async () => {
    if (!src) return;
    setSaving(true);
    try {
      await api.saveKnowledgeSource(tenantId, src);
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const startPoll = (jobId: string) => {
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const j = await api.getKnowledgeJob(tenantId, jobId);
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') {
          if (poll.current) clearInterval(poll.current);
          poll.current = null;
          load();
        }
      } catch (e) {
        onError(e);
      }
    }, 2000);
  };

  const ingest = async () => {
    if (!src) return;
    try {
      await api.saveKnowledgeSource(tenantId, src);
      const { jobId } = await api.startKnowledgeIngest(tenantId);
      startPoll(jobId);
    } catch (e) {
      onError(e);
    }
  };

  const test = async () => {
    try {
      const { hits } = await api.knowledgeQueryTest(tenantId, question);
      setHits(hits);
    } catch (e) {
      onError(e);
    }
  };

  const clear = async () => {
    try {
      await api.deleteKnowledge(tenantId);
      await load();
      setHits([]);
    } catch (e) {
      onError(e);
    }
  };

  if (!src || !meta) return <p>載入中…</p>;
  const running = !!job && ['queued', 'crawling', 'embedding'].includes(job.status);

  return (
    <div className="knowledge-tab">
      <h3>知識來源</h3>
      <label>
        起始網址
        <input
          value={src.startUrl}
          onChange={(e) => update({ startUrl: e.target.value })}
          placeholder="https://www.example.com/"
        />
      </label>
      <label>
        最大頁數
        <input
          type="number"
          value={src.maxPages}
          onChange={(e) => update({ maxPages: Number(e.target.value) })}
        />
      </label>
      <label>
        路徑前綴（選填，例 /mp）
        <input
          value={src.pathPrefix ?? ''}
          onChange={(e) => update({ pathPrefix: e.target.value || undefined })}
        />
      </label>
      <label>
        chunk 大小（字元）
        <input
          type="number"
          value={src.chunkChars}
          onChange={(e) => update({ chunkChars: Number(e.target.value) })}
        />
      </label>
      <label>
        embedding 模型
        <select value={src.embeddingModel} onChange={(e) => update({ embeddingModel: e.target.value })}>
          {EMBEDDING_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={src.rerank} onChange={(e) => update({ rerank: e.target.checked })} />{' '}
        啟用 LLM 重排
      </label>

      <div className="actions">
        <button onClick={save} disabled={saving || running}>
          儲存設定
        </button>
        <button onClick={ingest} disabled={running || !src.startUrl}>
          開始解析
        </button>
        <button onClick={clear} disabled={running || meta.status === 'none'}>
          清除索引
        </button>
      </div>

      <h3>索引狀態</h3>
      {running ? (
        <p>
          解析中… 階段：{job!.status}，已爬 {job!.pagesCrawled} 頁 / 已 embed {job!.embedded} / {job!.chunks}
        </p>
      ) : (
        <p>
          狀態：{meta.status}
          {meta.status === 'ready' &&
            `（${meta.chunkCount} 片段，來源 ${meta.source ?? ''}，${meta.generatedAt ?? ''}）`}
          {meta.status === 'failed' && `（失敗：${meta.error ?? ''}）`}
        </p>
      )}

      <h3>測試查詢</h3>
      <div className="actions">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="輸入問題，例：台北分公司電話"
        />
        <button onClick={test} disabled={!question}>
          查詢
        </button>
      </div>
      <ul>
        {hits.map((h, i) => (
          <li key={i}>
            <strong>{h.title}</strong>（{h.score.toFixed(3)}）
            <br />
            {h.snippet}
          </li>
        ))}
      </ul>
    </div>
  );
}
