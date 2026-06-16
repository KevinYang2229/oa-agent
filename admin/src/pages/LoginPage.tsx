import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@oa-agent/ui';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setErr(null);
    setBusy(true);
    try {
      await login(password);
      navigate('/', { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '登入失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '15vh auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>OA Agent 管理後台</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>請輸入管理密碼登入</p>
      <form onSubmit={submit}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="管理密碼"
        />
        {err && <p style={{ color: '#c00', marginTop: 8 }}>{err}</p>}
        <div style={{ marginTop: 16 }}>
          <Button type="submit" variant="confirm" disabled={busy}>
            {busy ? '登入中…' : '登入'}
          </Button>
        </div>
      </form>
    </div>
  );
}
