import { useState } from 'react';
import { Button } from '@oa-agent/ui';
import { api, type ApiKey, type Tenant } from '../../api';

export default function SettingsTab({
  tenant,
  onSaved,
  onError,
}: {
  tenant: Tenant;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState(tenant.name);
  const [origins, setOrigins] = useState((tenant.allowedOrigins ?? []).join('\n'));
  const [ssoSecret, setSsoSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKeys, setNewKeys] = useState<ApiKey[]>([]);

  async function save() {
    setBusy(true);
    try {
      const allowedOrigins = origins.split('\n').map((s) => s.trim()).filter(Boolean);
      const patch: Parameters<typeof api.updateTenant>[1] = { name: name.trim(), allowedOrigins };
      if (ssoSecret.trim().length >= 16) patch.ssoSecret = ssoSecret.trim();
      await api.updateTenant(tenant.id, patch);
      setSsoSecret('');
      onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function genKey(type: 'publishable' | 'secret') {
    try {
      const k = await api.createKey(tenant.id, type);
      setNewKeys((ks) => [k, ...ks]);
    } catch (e) {
      onError(e);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <label>
        名稱
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4 }} />
      </label>

      <label>
        允許嵌入來源（每行一個，<code>*</code> 代表全放行）
        <textarea
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
          rows={4}
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>

      <label>
        SSO 共享密鑰（留空＝不變更；需 ≥16 字元）
        <input
          type="password"
          value={ssoSecret}
          onChange={(e) => setSsoSecret(e.target.value)}
          placeholder={tenant.ssoSecret ? '（已設定，輸入以覆蓋）' : '（未設定）'}
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>

      <div>
        <Button variant="confirm" onClick={save} disabled={busy}>{busy ? '儲存中…' : '儲存設定'}</Button>
      </div>

      <hr />
      <div>
        <h3 style={{ fontSize: 16 }}>API Keys</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="new" onClick={() => genKey('publishable')}>產生公開金鑰 pk_</Button>
          <Button variant="new" onClick={() => genKey('secret')}>產生秘密金鑰 sk_</Button>
        </div>
        {newKeys.length > 0 && (
          <ul style={{ marginTop: 8 }}>
            {newKeys.map((k) => (
              <li key={k.key} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                <button onClick={() => void navigator.clipboard.writeText(k.key)} title="複製">📋</button> {k.key}
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: 12, color: '#888' }}>金鑰僅在產生當下顯示完整字串，請立即保存。</p>
      </div>
    </div>
  );
}
