import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '@oa-agent/ui';
import { api, UnauthorizedError, type Tenant } from '../api';
import { useAuth } from '../auth';

export default function TenantsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [name, setName] = useState('');
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
    if (!name.trim()) return;
    try {
      const { publishableKey } = await api.createTenant({ name: name.trim() });
      setName('');
      setNewKey(publishableKey);
      await load();
    } catch (e) {
      handleErr(e);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>租戶</h1>
        <Button variant="cancel" onClick={() => { logout(); navigate('/login'); }}>登出</Button>
      </div>

      {err && <p style={{ color: '#c00' }}>{err}</p>}
      {newKey && (
        <p style={{ background: '#eef', padding: 8, borderRadius: 6 }}>
          已建立，公開金鑰：<code>{newKey}</code>（請妥善保存）
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新租戶名稱" />
        <Button variant="confirm" onClick={create}>建立租戶</Button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tenants.map((t) => (
          <li key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <Link to={`/tenants/${t.id}`}>{t.name}</Link>
            <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>{t.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
