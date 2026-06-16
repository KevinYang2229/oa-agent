import { useMemo, useState } from 'react';
import type { TenantAppearance } from '@oa-agent/shared';
import { api, type Tenant } from '../../api';

const POSITIONS = [
  { v: 'br', label: '右下' },
  { v: 'bl', label: '左下' },
] as const;

export default function AppearanceTab({
  tenant,
  onSaved,
  onError,
}: {
  tenant: Tenant;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState<TenantAppearance>(tenant.appearance ?? {});
  const [busy, setBusy] = useState(false);

  function set<K extends keyof TenantAppearance>(k: K, v: TenantAppearance[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    try {
      await api.updateTenant(tenant.id, { appearance: form });
      onSaved();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  // 即時預覽：嵌入 widget client（5173），帶表單暫存的 theme/locale（query 優先於後端）
  const previewSrc = useMemo(() => {
    const params = new URLSearchParams({ embed: '1' });
    if (form.theme) params.set('theme', form.theme);
    if (form.defaultLocale) params.set('locale', form.defaultLocale);
    return `http://localhost:5173/?${params.toString()}`;
  }, [form.theme, form.defaultLocale]);

  const primary = form.primaryColor ?? '#4f46e5';

  return (
    <div className="appearance-grid">
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Widget 外觀</div>
            <div className="card-desc">儲存後依租戶套用；widget 載入時讀取，data-* 參數仍優先。</div>
          </div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <span className="field-label">主色</span>
              <div className="color-field">
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => set('primaryColor', e.target.value)}
                />
                <span className="color-hex">{primary.toUpperCase()}</span>
              </div>
            </div>

            <div className="field">
              <label className="field-label">主題</label>
              <select
                className="select"
                value={form.theme ?? 'light'}
                onChange={(e) => set('theme', e.target.value as TenantAppearance['theme'])}
              >
                <option value="light">淺色</option>
                <option value="dark">深色</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">啟動按鈕位置</label>
              <select
                className="select"
                value={form.position ?? 'br'}
                onChange={(e) => set('position', e.target.value as TenantAppearance['position'])}
              >
                {POSITIONS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">預設語言</label>
              <input
                className="input"
                value={form.defaultLocale ?? ''}
                onChange={(e) => set('defaultLocale', e.target.value)}
                placeholder="zh-Hant"
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label className="field-label">Logo URL</label>
            <input
              className="input"
              type="url"
              value={form.logoUrl ?? ''}
              onChange={(e) => set('logoUrl', e.target.value)}
              placeholder="https://…/logo.png"
            />
          </div>

          <div className="field">
            <label className="field-label">歡迎語</label>
            <input
              className="input"
              value={form.welcomeMessage ?? ''}
              onChange={(e) => set('welcomeMessage', e.target.value)}
              maxLength={200}
              placeholder="嗨！我可以協助你填寫表單。"
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? '儲存中…' : '儲存外觀'}
            </button>
          </div>
        </div>
      </div>

      <div className="card preview-card">
        <div className="card-head">
          <div className="card-title">即時預覽</div>
        </div>
        <div className="card-body">
          <iframe title="widget-preview" src={previewSrc} className="preview-frame" />
          <p className="field-hint" style={{ marginTop: 10 }}>
            需同時執行 widget client（5173）。主色以儲存後套用為準。
          </p>
        </div>
      </div>
    </div>
  );
}
