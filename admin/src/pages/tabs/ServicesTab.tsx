import { useCallback, useEffect, useState } from 'react';
import { api, type TenantServiceCatalog } from '../../api';

export default function ServicesTab({
  tenantId,
  onError,
}: {
  tenantId: string;
  onError: (e: unknown) => void;
}) {
  const [cat, setCat] = useState<TenantServiceCatalog | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCat(await api.getTenantServices(tenantId));
    } catch (e) {
      onError(e);
    }
  }, [tenantId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleService = (id: string) =>
    setCat((c) =>
      c ? { ...c, services: c.services.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) } : c,
    );
  const toggleForm = (formId: string) =>
    setCat((c) =>
      c ? { ...c, forms: c.forms.map((f) => (f.formId === formId ? { ...f, enabled: !f.enabled } : f)) } : c,
    );

  const save = async () => {
    if (!cat) return;
    setSaving(true);
    try {
      await api.updateTenant(tenantId, {
        disabledServices: cat.services.filter((s) => !s.enabled).map((s) => s.id),
        disabledForms: cat.forms.filter((f) => !f.enabled).map((f) => f.formId),
      });
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  if (!cat)
    return (
      <div className="card">
        <div className="card-body">載入中…</div>
      </div>
    );
  const noService = cat.services.every((s) => !s.enabled);
  const noForm = cat.forms.every((f) => !f.enabled);

  return (
    <div className="appearance-grid">
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Agent 服務</div>
            <div className="card-desc">取消勾選即停用該類服務；預設全開。</div>
          </div>
        </div>
        <ul className="list">
          {cat.services.map((s) => (
            <li key={s.id} className="row">
              <div className="row-main">
                <div className="row-title">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={s.enabled} onChange={() => toggleService(s.id)} />
                    <span style={{ fontWeight: 500 }}>{s.label}</span>
                  </label>
                </div>
                <div className="row-sub">{s.id}</div>
              </div>
            </li>
          ))}
        </ul>
        {noService && <div className="card-body row-sub">⚠️ 已停用全部服務，此租戶對話將無可用功能。</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">可用表單</div>
            <div className="card-desc">控制此租戶可申請哪些表單。</div>
          </div>
        </div>
        <ul className="list">
          {cat.forms.map((f) => (
            <li key={f.formId} className="row">
              <div className="row-main">
                <div className="row-title">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={f.enabled} onChange={() => toggleForm(f.formId)} />
                    <span style={{ fontWeight: 500 }}>{f.title}</span>
                  </label>
                </div>
                <div className="row-sub">{f.formId}</div>
              </div>
            </li>
          ))}
          {cat.forms.length === 0 && <li className="empty">尚無表單。</li>}
        </ul>
        {noForm && cat.forms.length > 0 && (
          <div className="card-body row-sub">⚠️ 已停用全部表單，填表功能將無法選到表單。</div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          儲存
        </button>
      </div>
    </div>
  );
}
