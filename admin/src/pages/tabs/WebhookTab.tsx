import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oa-agent/ui';
import { api, type WebhookEndpoint } from '../../api';

export default function WebhookTab({ tenantId, onError }: { tenantId: string; onError: (e: unknown) => void }) {
  const [list, setList] = useState<WebhookEndpoint[]>([]);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await api.listWebhooks(tenantId));
    } catch (e) {
      onError(e);
    }
  }, [tenantId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!url.trim()) return;
    try {
      await api.createWebhook(tenantId, { url: url.trim(), ...(secret.trim() ? { secret: secret.trim() } : {}) });
      setUrl('');
      setSecret('');
      await load();
    } catch (e) {
      onError(e);
    }
  }

  async function toggle(w: WebhookEndpoint) {
    try {
      await api.toggleWebhook(tenantId, w.id, !w.disabledAt);
      await load();
    } catch (e) {
      onError(e);
    }
  }

  async function remove(w: WebhookEndpoint) {
    try {
      await api.deleteWebhook(tenantId, w.id);
      await load();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://接收端/hook" style={{ flex: 1 }} />
        <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="簽章密鑰（選填）" />
        <Button variant="confirm" onClick={add}>新增</Button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {list.map((w) => (
          <li key={w.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: w.disabledAt ? '#999' : '#222' }}>
                {w.url} {w.disabledAt ? '（已停用）' : ''}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <Button variant="reset" onClick={() => toggle(w)}>{w.disabledAt ? '啟用' : '停用'}</Button>
                <Button variant="delete" onClick={() => remove(w)}>刪除</Button>
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#aaa' }}>secret: {w.secret}</div>
          </li>
        ))}
        {list.length === 0 && <li style={{ color: '#999' }}>尚無 webhook 端點</li>}
      </ul>
    </div>
  );
}
