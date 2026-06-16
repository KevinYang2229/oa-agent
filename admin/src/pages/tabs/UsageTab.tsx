import { useEffect, useState } from 'react';
import { api, type Usage } from '../../api';

export default function UsageTab({ tenantId, onError }: { tenantId: string; onError: (e: unknown) => void }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .getUsage(tenantId)
      .then((u) => {
        if (!cancelled) setUsage(u);
      })
      .catch(onError);
    return () => {
      cancelled = true;
    };
  }, [tenantId, onError]);

  if (!usage) return <p style={{ color: '#999' }}>載入中…</p>;

  const items: { label: string; value: number }[] = [
    { label: '對話數', value: usage.conversations ?? 0 },
    { label: '訊息數', value: usage.messages ?? 0 },
    { label: '送出數', value: usage.submissions ?? 0 },
  ];

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {items.map((it) => (
        <div key={it.label} style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888' }}>{it.label}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}
