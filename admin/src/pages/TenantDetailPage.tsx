import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, UnauthorizedError, type Tenant } from '../api';
import { useAuth } from '../auth';
import AppearanceTab from './tabs/AppearanceTab';
import SettingsTab from './tabs/SettingsTab';
import WebhookTab from './tabs/WebhookTab';
import UsageTab from './tabs/UsageTab';

type TabKey = 'appearance' | 'settings' | 'webhook' | 'usage';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'appearance', label: '外觀' },
  { key: 'settings', label: '設定' },
  { key: 'webhook', label: 'Webhook' },
  { key: 'usage', label: '用量' },
];

export default function TenantDetailPage() {
  const { id = '' } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<TabKey>('appearance');
  const [err, setErr] = useState<string | null>(null);

  const handleErr = useCallback(
    (e: unknown) => {
      if (e instanceof UnauthorizedError) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setErr(e instanceof Error ? e.message : '發生錯誤');
    },
    [logout, navigate],
  );

  const reload = useCallback(async () => {
    try {
      const list = await api.listTenants();
      const found = list.find((t) => t.id === id) ?? null;
      setTenant(found);
    } catch (e) {
      handleErr(e);
    }
  }, [id, handleErr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (err) return <p style={{ padding: 24, color: '#c00' }}>{err}</p>;
  if (!tenant) return <p style={{ padding: 24 }}>載入中…</p>;

  return (
    <div style={{ maxWidth: 880, margin: '40px auto', padding: 24 }}>
      <Link to="/">← 租戶清單</Link>
      <h1 style={{ fontSize: 22, margin: '8px 0' }}>{tenant.name}</h1>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #eee', marginBottom: 16 }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: '8px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: tab === tb.key ? '2px solid var(--primary-color, #0057ff)' : '2px solid transparent',
              fontWeight: tab === tb.key ? 600 : 400,
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'appearance' && <AppearanceTab tenant={tenant} onSaved={reload} onError={handleErr} />}
      {tab === 'settings' && <SettingsTab tenant={tenant} onSaved={reload} onError={handleErr} />}
      {tab === 'webhook' && <WebhookTab tenantId={tenant.id} onError={handleErr} />}
      {tab === 'usage' && <UsageTab tenantId={tenant.id} onError={handleErr} />}
    </div>
  );
}
