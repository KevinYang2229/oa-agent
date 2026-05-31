import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Input, Select, Textarea, type StatusBadgeVariant } from '@oa-agent/ui';
import {
  api,
  type Definition,
  type SessionStatus,
  type SubmissionInfo,
  type TurnData,
} from './api';
import { changeLanguage } from './i18n';
import FormView from './FormView';

type Role = 'user' | 'agent' | 'sys';
interface ChatMessage {
  id: number;
  role: Role;
  text: string;
}

type Theme = 'light' | 'dark';

// session 狀態 → 設計系統 Badge 的 status 變體
const STATUS_BADGE: Record<SessionStatus, StatusBadgeVariant> = {
  collecting: 'info',
  confirming: 'warning',
  submitting: 'process',
  submitted: 'success',
  cancelled: 'default',
  failed: 'danger',
};

let seq = 0;
const nextId = () => ++seq;

export default function App() {
  const { t, i18n } = useTranslation();

  const [userId, setUserId] = useState('kevin');
  const [convId, setConvId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), role: 'agent', text: t('app.greeting') },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [formDef, setFormDef] = useState<Definition | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('oa-theme') as Theme) || 'light',
  );

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 主題：寫到 <html data-theme>，設計系統 token 隨之切換
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('oa-theme', theme);
  }, [theme]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  function pushMsg(role: Role, text: string) {
    setMessages((prev) => [...prev, { id: nextId(), role, text }]);
  }

  function applyTurn(data: TurnData, sessionId: string | null) {
    if (data.id) setConvId(data.id);
    setStatus(data.status);
    setValues(data.values ?? {});
    setSubmission(data.submission ?? null);
    if (data.reply) pushMsg('agent', data.reply);

    if (data.status === 'confirming' || data.status === 'submitted') {
      void loadAndShowForm(data.id ?? sessionId);
    }
  }

  async function loadAndShowForm(sessionId: string | null) {
    if (!sessionId) return;
    try {
      let def = formDef;
      if (!def) {
        const conv = await api.getConversation(userId, sessionId);
        def = await api.getForm(conv.formId);
        setFormDef(def);
      }
      setShowForm(true);
    } catch (e) {
      pushMsg('sys', '⚠️ ' + t('app.loadFormFailed') + (e instanceof Error ? e.message : ''));
    }
  }

  async function send(message: string) {
    if (busy) return;
    setBusy(true);
    try {
      const data = convId
        ? await api.sendMessage(userId, convId, message)
        : await api.start(userId, message);
      applyTurn(data, convId);
    } catch (e) {
      pushMsg('sys', '⚠️ ' + (e instanceof Error ? e.message : t('app.requestFailed')));
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  // 確認畫面送出：先把編輯後的草稿（差異）存回後端，再送「確認」觸發 submit
  async function handleConfirm(draft: Record<string, unknown>) {
    if (!convId || busy) return;
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (String(v ?? '') !== String(values[k] ?? '')) changed[k] = v;
    }

    setBusy(true);
    try {
      if (Object.keys(changed).length > 0) {
        const upd = await api.updateFields(userId, convId, changed);
        setStatus(upd.status);
        setValues(upd.values);
        if (upd.rejected.length > 0) {
          throw new Error(upd.rejected.map((r) => r.message).join('；'));
        }
        if (upd.status !== 'confirming') {
          throw new Error(t('form.incomplete'));
        }
      }
      pushMsg('user', t('app.confirm'));
      const turn = await api.sendMessage(userId, convId, '確認');
      applyTurn(turn, convId);
    } finally {
      setBusy(false);
    }
  }

  // 取消：打後端 cancel 端點（非送對話訊息，Agent 無取消工具）
  async function handleCancel() {
    if (!convId || busy) return;
    setBusy(true);
    try {
      const res = await api.cancel(userId, convId);
      setStatus(res.status);
      setShowForm(false);
      pushMsg('sys', t('app.cancelledMsg'));
    } catch (e) {
      pushMsg('sys', '⚠️ ' + t('app.cancelFailed') + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  function submitForm() {
    const text = input.trim();
    if (!text || busy) return;
    pushMsg('user', text);
    setInput('');
    void send(text);
  }

  function reset() {
    setConvId(null);
    setStatus(null);
    setValues({});
    setSubmission(null);
    setShowForm(false);
    setMessages([
      { id: nextId(), role: 'agent', text: t('app.greeting') },
      { id: nextId(), role: 'sys', text: t('app.restarted') },
    ]);
    taRef.current?.focus();
  }

  const valueEntries = Object.entries(values).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">{t('app.title')}</h1>
        <div className="app-meta">
          <label className="flex items-center gap-2">
            {t('app.user')}
            <span className="w-28">
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </span>
          </label>
          <span className="flex items-center gap-2">
            {t('app.statusLabel')}
            <Badge status={status ? STATUS_BADGE[status] : 'normal'}>
              {status ? t(`app.status.${status}`) : t('app.statusInitial')}
            </Badge>
          </span>

          <Button variant="reset" size="sm" onClick={reset} type="button">
            {t('app.reset')}
          </Button>
        </div>

        <div className="app-header-actions">
          {/* 語系切換 */}
          <span className="w-28" title={t('app.language')}>
            <Select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
            >
              <option value="zh-Hant">繁體中文</option>
              <option value="en">English</option>
            </Select>
          </span>

          {/* 深色 / 淺色切換 */}
          <Button
            variant="nav"
            size="sm"
            type="button"
            title={t('app.theme')}
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </Button>
        </div>
      </header>

      <div className="app-body">
        <div className="chat-pane">
          <div className="msg-list" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`bubble bubble-${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="bubble-typing">…</div>}
          </div>

          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              submitForm();
            }}
          >
            <span className="min-w-0 flex-1">
              <Input
                autoFocus
                placeholder={t('app.inputPlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // 輸入法組字中的 Enter 是「選字」，不可當送出（否則中文會殘留在框內）
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitForm();
                  }
                }}
              />
            </span>
            <Button variant="confirm" size="md" type="submit" disabled={busy}>
              {t('app.send')}
            </Button>
          </form>
        </div>

        <aside className="side-pane">
          <h2 className="side-title">{t('app.filledFields')}</h2>
          {valueEntries.length ? (
            valueEntries.map(([k, v]) => (
              <div className="kv-row" key={k}>
                <span className="kv-key">{k}</span>
                <span className="kv-val">{String(v)}</span>
              </div>
            ))
          ) : (
            <div className="empty-hint">{t('app.noData')}</div>
          )}

          <h2 className="side-title mt-5">{t('app.result')}</h2>
          {submission ? (
            <>
              <div className="kv-row">
                <span className="kv-key">{t('app.oaNo')}</span>
                <span className="kv-val">{submission.oaRequestId}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">{t('app.statusField')}</span>
                <span className="kv-val">{submission.status}</span>
              </div>
              <Button
                variant="reset"
                size="sm"
                type="button"
                className="mt-3 w-full"
                onClick={() => setShowForm(true)}
              >
                {t('app.viewForm')}
              </Button>
            </>
          ) : (
            <div className="empty-hint">{t('app.notSubmitted')}</div>
          )}
        </aside>
      </div>

      {showForm && formDef && (
        <FormView
          def={formDef}
          values={values}
          submission={submission}
          busy={busy}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
