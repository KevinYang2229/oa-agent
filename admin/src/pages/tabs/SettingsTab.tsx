import { useState } from 'react';
import { api, type ApiKey, type Tenant } from '../../api';
import { IconCopy, IconKey } from '../../components/icons';

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
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">租戶設定</div>
            <div className="card-desc">名稱、允許嵌入來源與 SSO 共享密鑰。</div>
          </div>
        </div>
        <div className="card-body">
          <div className="field">
            <label className="field-label">名稱</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label className="field-label">允許嵌入來源</label>
            <span className="field-hint">每行一個網域，<code>*</code> 代表全放行。</span>
            <textarea
              className="textarea"
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              rows={4}
              placeholder="https://acme.com"
            />
          </div>

          <div className="field">
            <label className="field-label">SSO 共享密鑰</label>
            <span className="field-hint">留空＝不變更；需 ≥16 字元。</span>
            <input
              className="input"
              type="password"
              value={ssoSecret}
              onChange={(e) => setSsoSecret(e.target.value)}
              placeholder={tenant.ssoSecret ? '已設定，輸入以覆蓋' : '未設定'}
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? '儲存中…' : '儲存設定'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">API Keys</div>
            <div className="card-desc">金鑰僅在產生當下顯示完整字串，請立即保存。</div>
          </div>
          <div className="toolbar">
            <button className="btn btn-ghost btn-sm" onClick={() => genKey('publishable')}>
              <IconKey />
              產生 pk_
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => genKey('secret')}>
              <IconKey />
              產生 sk_
            </button>
          </div>
        </div>
        {newKeys.length > 0 ? (
          <ul className="list">
            {newKeys.map((k) => (
              <li key={k.key} className="row">
                <div className="row-main">
                  <div className="row-title">
                    <span className={`badge ${k.type === 'publishable' ? 'badge-on' : 'badge-off'}`}>
                      {k.type === 'publishable' ? 'publishable' : 'secret'}
                    </span>
                  </div>
                  <div className="row-sub">{k.key}</div>
                </div>
                <button
                  className="icon-btn"
                  title="複製"
                  onClick={() => void navigator.clipboard.writeText(k.key)}
                >
                  <IconCopy />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">尚未在本次工作階段產生金鑰。</div>
        )}
      </div>
    </>
  );
}
