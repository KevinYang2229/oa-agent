import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';

interface AuthCtx {
  authed: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => !!tokenStore.get());

  const login = useCallback(async (password: string) => {
    const { token } = await api.login(password);
    tokenStore.set(token);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAuthed(false);
  }, []);

  const value = useMemo<AuthCtx>(() => ({ authed, login, logout }), [authed, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth 必須在 AuthProvider 內使用');
  return v;
}
