import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, UnauthorizedError, type Tenant } from '../api';
import { useAuth } from '../auth';
import AppLayout from '../components/AppLayout';
import { IconBack, IconInfo } from '../components/icons';
import AppearanceTab from './tabs/AppearanceTab';
import SettingsTab from './tabs/SettingsTab';
import WebhookTab from './tabs/WebhookTab';
import UsageTab from './tabs/UsageTab';
import FormsTab from './tabs/FormsTab';
import KnowledgeTab from './tabs/KnowledgeTab';
import ServicesTab from './tabs/ServicesTab';

type TabKey = 'appearance' | 'forms' | 'knowledge' | 'services' | 'settings' | 'webhook' | 'usage';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'appearance', label: '外觀' },
  { key: 'forms', label: '表單' },
  { key: 'knowledge', label: '知識庫' },
  { key: 'services', label: '服務' },
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
      setTenant(list.find((t) => t.id === id) ?? null);
    } catch (e) {
      handleErr(e);
    }
  }, [id, handleErr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <AppLayout
      crumb="租戶"
      title={tenant?.name ?? '載入中…'}
      actions={
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <IconBack />
          租戶清單
        </button>
      }
    >
      {err && (
        <div className="banner banner-err">
          <IconInfo />
          {err}
        </div>
      )}

      {!tenant ? (
        <div className="card">
          <div className="empty">載入中…</div>
        </div>
      ) : (
        <>
          <div className="tabs">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                className={`tab${tab === tb.key ? ' active' : ''}`}
                onClick={() => setTab(tb.key)}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === 'appearance' && <AppearanceTab tenant={tenant} onSaved={reload} onError={handleErr} />}
          {tab === 'forms' && <FormsTab tenantId={tenant.id} onError={handleErr} />}
          {tab === 'knowledge' && <KnowledgeTab tenantId={tenant.id} onError={handleErr} />}
          {tab === 'services' && <ServicesTab tenantId={tenant.id} onError={handleErr} />}
          {tab === 'settings' && <SettingsTab tenant={tenant} onSaved={reload} onError={handleErr} />}
          {tab === 'webhook' && <WebhookTab tenantId={tenant.id} onError={handleErr} />}
          {tab === 'usage' && <UsageTab tenantId={tenant.id} onError={handleErr} />}
        </>
      )}
    </AppLayout>
  );
}
