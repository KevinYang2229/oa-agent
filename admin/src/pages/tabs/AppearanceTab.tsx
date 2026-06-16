import { useMemo, useState } from 'react';
import type { TenantAppearance } from '@oa-agent/shared';
import { Button } from '@oa-agent/ui';
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          主色
          <input
            type="color"
            value={form.primaryColor ?? '#0057ff'}
            onChange={(e) => set('primaryColor', e.target.value)}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>

        <label>
          主題
          <select
            value={form.theme ?? 'light'}
            onChange={(e) => set('theme', e.target.value as TenantAppearance['theme'])}
            style={{ display: 'block', marginTop: 4 }}
          >
            <option value="light">淺色</option>
            <option value="dark">深色</option>
          </select>
        </label>

        <label>
          按鈕位置
          <select
            value={form.position ?? 'br'}
            onChange={(e) => set('position', e.target.value as TenantAppearance['position'])}
            style={{ display: 'block', marginTop: 4 }}
          >
            {POSITIONS.map((p) => (
              <option key={p.v} value={p.v}>{p.label}</option>
            ))}
          </select>
        </label>

        <label>
          Logo URL
          <input
            type="url"
            value={form.logoUrl ?? ''}
            onChange={(e) => set('logoUrl', e.target.value)}
            placeholder="https://…/logo.png"
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        <label>
          歡迎語
          <input
            type="text"
            value={form.welcomeMessage ?? ''}
            onChange={(e) => set('welcomeMessage', e.target.value)}
            maxLength={200}
            style={{ display: 'block', marginTop: 4, width: '100%' }}
          />
        </label>

        <label>
          預設語言
          <input
            type="text"
            value={form.defaultLocale ?? ''}
            onChange={(e) => set('defaultLocale', e.target.value)}
            placeholder="zh-Hant"
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>

        <div>
          <Button variant="confirm" onClick={save} disabled={busy}>{busy ? '儲存中…' : '儲存外觀'}</Button>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, color: '#888' }}>即時預覽（widget）</p>
        <iframe
          title="widget-preview"
          src={previewSrc}
          style={{ width: 340, height: 520, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <p style={{ fontSize: 11, color: '#aaa' }}>
          需同時執行 widget client（5173）。主色預覽以儲存後套用為準。
        </p>
      </div>
    </div>
  );
}
