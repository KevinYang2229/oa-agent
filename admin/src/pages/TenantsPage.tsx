import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, UnauthorizedError, type Tenant } from '../api';
import { useAuth } from '../auth';
import AppLayout from '../components/AppLayout';
import { IconChevron, IconInfo, IconPlus } from '../components/icons';

export default function TenantsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleErr(e: unknown) {
    if (e instanceof UnauthorizedError) {
      logout();
      navigate('/login', { replace: true });
      return;
    }
    setErr(e instanceof Error ? e.message : '發生錯誤');
  }

  async function load() {
    try {
      setTenants(await api.listTenants());
    } catch (e) {
      handleErr(e);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { publishableKey } = await api.createTenant({ name: name.trim() });
      setName('');
      setCreating(false);
      setNewKey(publishableKey);
      await load();
    } catch (e) {
      handleErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Tenant, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`確定刪除租戶「${t.name}」？其 API 金鑰會一併移除，此動作無法復原。`)) return;
    try {
      await api.deleteTenant(t.id);
      await load();
    } catch (err) {
      handleErr(err);
    }
  }

  return (
    <AppLayout
      crumb="營運"
      title="租戶"
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setCreating((v) => !v)}>
          <IconPlus />
          新增租戶
        </button>
      }
    >
      {err && (
        <div className="banner banner-err">
          <IconInfo />
          {err}
        </div>
      )}
      {newKey && (
        <div className="banner banner-key">
          <IconInfo />
          <span>
            租戶已建立，公開金鑰 <span className="code-pill">{newKey}</span> — 僅顯示一次，請妥善保存。
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">所有租戶</div>
            <div className="card-desc">{tenants.length} 個整合方</div>
          </div>
        </div>

        {creating && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="toolbar">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="新租戶名稱，例如 Acme Inc."
                autoFocus
              />
              <button className="btn btn-primary" onClick={create} disabled={busy}>
                {busy ? '建立中…' : '建立'}
              </button>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        <ul className="list">
          {tenants.map((t) => (
            <li
              key={t.id}
              className="row row-link"
              onClick={() => navigate(`/tenants/${t.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="row-main">
                <div className="row-title">{t.name}</div>
                <div className="row-sub">{t.id}</div>
              </div>
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                {t.id !== 'default' && (
                  <button className="btn btn-danger btn-sm" onClick={(e) => remove(t, e)}>
                    刪除
                  </button>
                )}
              </div>
              <IconChevron className="chev" />
            </li>
          ))}
          {tenants.length === 0 && <li className="empty">尚無租戶，點右上「新增租戶」開始。</li>}
        </ul>
      </div>
    </AppLayout>
  );
}
