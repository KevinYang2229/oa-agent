/** 後台深/淺色主題：套用 <html data-theme>，@oa-agent/ui token 隨之切換。 */
export type Theme = 'light' | 'dark';
const KEY = 'oa-admin-theme';

/** 初始主題：優先本地記憶，否則跟隨系統偏好 */
export function initialTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(KEY, t);
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
