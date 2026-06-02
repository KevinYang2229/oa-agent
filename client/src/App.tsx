import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Input, type StatusBadgeVariant } from '@oa-agent/ui';
import {
  api,
  ApiError,
  auth,
  setUnauthorizedHandler,
  type Applicant,
  type Definition,
  type LeaveBalance,
  type SessionStatus,
  type SubmissionInfo,
  type TurnData,
} from './api';
import { changeLanguage } from './i18n';
import FormView from './FormView';
import LoginView from './LoginView';
import SettingsMenu, { FONT_MAX, FONT_MIN } from './SettingsMenu';

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

// 逐字浮現：Agent 回覆抵達後一字一字顯示，營造「正在回覆」的動態感。
// 元件以 message id 為 key，狀態隨實例保留 → 既有訊息不會在重繪（如切主題）時重播。
function TypewriterText({ text, onTick }: { text: string; onTick?: () => void }) {
  const [count, setCount] = useState(0);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    // 尊重使用者「減少動態」偏好：直接整段顯示
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !text) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setCount(i);
      onTickRef.current?.();
      if (i >= text.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [text]);

  const done = count >= text.length;
  return (
    <>
      {text.slice(0, count)}
      {!done && <span className="type-caret" aria-hidden />}
    </>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();

  // 登入者；未登入為 null。userId 由登入者帶出（不再手動輸入）
  const [authUser, setAuthUser] = useState<Applicant | null>(null);
  const [authReady, setAuthReady] = useState(false); // 重整時還原登入狀態的載入旗標
  const userId = authUser?.id ?? '';
  const [convId, setConvId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
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
  // 系統字級（百分比）：縮放整個介面的 root font-size
  const [fontScale, setFontScale] = useState<number>(() => {
    const saved = Number(localStorage.getItem('oa-font-scale'));
    return saved >= FONT_MIN && saved <= FONT_MAX ? saved : 100;
  });

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 主題：寫到 <html data-theme>，設計系統 token 隨之切換
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('oa-theme', theme);
  }, [theme]);

  // 系統字級：調整 root font-size（rem 為基準，整個介面隨之縮放）並記憶
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
    localStorage.setItem('oa-font-scale', String(fontScale));
  }, [fontScale]);

  // 啟動：還原登入狀態（有 token 就用 /me 取使用者）；並註冊 401（refresh 失敗）→ 登出
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthUser(null);
      resetSessionState();
    });
    if (auth.isAuthenticated()) {
      auth
        .me()
        .then(setAuthUser)
        .catch(() => setAuthUser(null))
        .finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToEnd = useCallback(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, busy, scrollToEnd]);

  // 假別剩餘時數：登入後依使用者載入，供表單顯示「今年度剩餘 N 小時」
  useEffect(() => {
    if (!authUser) return;
    let alive = true;
    api
      .getLeaveBalances(authUser.id)
      .then((b) => alive && setBalances(b))
      .catch(() => alive && setBalances([]));
    return () => {
      alive = false;
    };
  }, [authUser]);

  function pushMsg(role: Role, text: string) {
    setMessages((prev) => [...prev, { id: nextId(), role, text }]);
  }

  // 對話已不存在（多半是後端重啟導致記憶體 session 遺失）。404 → 視為連線重置
  const isSessionGone = (e: unknown) => e instanceof ApiError && e.status === 404;

  // 優雅地清掉本地對話狀態，下一則訊息會自動開新對話
  function resetSessionState() {
    setConvId(null);
    setStatus(null);
    setValues({});
    setSubmission(null);
    setShowForm(false);
    setFormDef(null);
  }

  function handleLogin(user: Applicant) {
    setAuthUser(user);
    setMessages([{ id: nextId(), role: 'agent', text: t('app.greeting') }]);
  }

  function handleLogout() {
    auth.logout();
    setAuthUser(null);
    setBalances([]);
    resetSessionState();
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
      if (isSessionGone(e)) {
        resetSessionState();
        pushMsg('sys', t('app.sessionExpired'));
      } else {
        pushMsg('sys', '⚠️ ' + (e instanceof Error ? e.message : t('app.requestFailed')));
      }
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
      // 對話已不存在＝本來就沒得取消，視同已結束、清掉本地狀態即可
      if (isSessionGone(e)) {
        resetSessionState();
        pushMsg('sys', t('app.sessionExpired'));
      } else {
        pushMsg('sys', '⚠️ ' + t('app.cancelFailed') + (e instanceof Error ? e.message : ''));
      }
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

  // 還原登入狀態中：先不渲染，避免閃一下登入頁
  if (!authReady) return null;
  // 未登入：擋住整個 App，只顯示登入頁
  if (!authUser) return <LoginView onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">{t('app.title')}</h1>

        {/* 其餘控制項整組靠右；空間夠 inline，不夠自動換行 */}
        <div className="app-collapse">
          <div className="app-meta">
            <span className="app-meta-item">
              <span className="app-meta-label">{t('app.user')}</span>
              <span className="app-meta-value">{authUser.name}</span>
            </span>

            <span className="app-meta-sep" aria-hidden="true" />

            <span className="app-meta-item">
              <span className="app-meta-label">{t('app.statusLabel')}</span>
              <Badge status={status ? STATUS_BADGE[status] : 'normal'}>
                {status ? t(`app.status.${status}`) : t('app.statusInitial')}
              </Badge>
            </span>

            <span className="app-meta-sep" aria-hidden="true" />

            <button type="button" className="app-reset" onClick={reset}>
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {t('app.reset')}
            </button>
          </div>

          {/* 齒輪設定：外觀模式 / 系統字級 / 切換語言 / 登出 */}
          <SettingsMenu
            theme={theme}
            onThemeChange={setTheme}
            language={i18n.language}
            onLanguageChange={changeLanguage}
            fontScale={fontScale}
            onFontScaleChange={setFontScale}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <div className="app-body">
        <div className="chat-pane">
          <div className="msg-list" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`bubble bubble-${m.role}`}>
                {m.role === 'agent' ? (
                  <TypewriterText text={m.text} onTick={scrollToEnd} />
                ) : (
                  m.text
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble-typing" aria-label={t('app.typing')}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}
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
          balances={balances}
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
