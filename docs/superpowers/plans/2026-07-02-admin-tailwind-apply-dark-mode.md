# Admin @apply 統一 + Dark/Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 admin 的手寫 CSS 改成與 client 一致的 Tailwind `@apply` + `@oa-agent/ui` token 寫法，並加上 dark/light 切換。

**Architecture:** admin `index.css` 匯入 `tailwindcss` 與 `@oa-agent/ui`（提供 token + `:root[data-theme=dark]` 全域覆寫）；先以「set-1 token 別名 → ui token」讓整站立即支援 dark mode（零 class 改動），再分組把 class 規則改寫為 `@apply`（顏色改用 ui token）；加一顆主題 toggle。

**Tech Stack:** Vite + `@tailwindcss/vite`（admin 已裝）、`@oa-agent/ui`（admin 已依賴）、React。

## Global Constraints

- 只動 `admin/`；不改 `@oa-agent/ui`、`client/`、`server/`。
- 驗證＝`cd admin && npx tsc --noEmit && npm run build` 綠 + **人工目視**（light 與 dark 皆檢查）。無 CSS 單元測試。
- **分組改寫、每組 build + 目視確認後再進下一組、每組一個 commit**（控回歸風險）。
- 主色採 `@oa-agent/ui` 的藍（light `#0060d5` / dark `#22bafb`），不覆寫。
- 側邊欄維持固定深色（不隨 light/dark 切換）。
- **Token 對應（set-1 → ui token），@apply 改寫時一律換成右欄：**
  | set-1 | ui token |
  |---|---|
  | `--surface` | `--card-bg` |
  | `--surface-2` | `--bg-secondary` |
  | `--bg` | `--bg-color` |
  | `--text` | `--text-primary` |
  | `--text-muted` / `--text-faint` | `--text-secondary` |
  | `--border` / `--border-strong` | `--border-color` |
  | `--accent` / `--accent-hover` | `--primary-color` |
  | `--accent-soft` | `--nav-active-bg` |
  | `--accent-ring` | `rgba(var(--primary-color-rgb),0.25)` |
  | `--danger` | `--status-danger` |
  | `--danger-soft` | `--badge-danger-bg` |
  | `--success` | `--status-positive` |
  | `--success-soft` | `--badge-success-bg` |
- 側邊欄/圓角/陰影 token（`--sidebar*`/`--radius*`/`--shadow*`/`--font`/`--sidebar-w`）為 admin 專屬，保留字面值。
- 無法 `@apply` 者（`::-webkit-*` pseudo、`@keyframes`、`@media`、複雜選擇器）保留原生 CSS。

---

## Task 1: 接線 + Token 別名 + Dark/Light toggle（dark mode 落地）

**Files:**
- Modify: `admin/src/index.css`（頭部 import + 重寫 `:root`）
- Create: `admin/src/theme.ts`
- Modify: `admin/src/main.tsx`
- Modify: `admin/src/components/AppLayout.tsx`

**Interfaces:**
- Produces: `initialTheme(): 'light'|'dark'`、`applyTheme(t): void`、`getTheme(): 'light'|'dark'`（`theme.ts`）。

- [ ] **Step 1: theme.ts**
```ts
// admin/src/theme.ts
export type Theme = 'light' | 'dark';
const KEY = 'oa-admin-theme';

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
```

- [ ] **Step 2: main.tsx 於 render 前套主題（防閃爍）**
在 `import './index.css';` 之後、`createRoot(...)` 之前加入：
```ts
import { applyTheme, initialTheme } from './theme';
applyTheme(initialTheme());
```

- [ ] **Step 3: index.css 頭部 + :root 重寫**
把 `admin/src/index.css` 最上方（在任何規則之前）改為：
```css
@import "tailwindcss";
@import "@oa-agent/ui/index.css";

@theme {
  --font-sans: "Plus Jakarta Sans", "Noto Sans TC", system-ui, -apple-system, sans-serif;
}

:root {
  /* admin 專屬（ui 沒有）：側邊欄固定深色、圓角、陰影、字型 */
  --sidebar: #0e1525;
  --sidebar-2: #131c30;
  --sidebar-border: #20293d;
  --on-sidebar: #c4ccdc;
  --on-sidebar-dim: #7c879c;
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.05);
  --shadow-sm: 0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04);
  --shadow-md: 0 6px 16px rgba(16, 24, 40, 0.08), 0 2px 6px rgba(16, 24, 40, 0.04);
  --shadow-lg: 0 24px 48px -12px rgba(16, 24, 40, 0.18);
  --font: "Plus Jakarta Sans", "Noto Sans TC", system-ui, -apple-system, sans-serif;
  --sidebar-w: 248px;

  /* set-1 → ui token 別名：讓現有 class 立即改用 ui token 並支援 dark mode。
     @apply 改寫時逐步改為直接引用 ui token；全部改完後（Task 7）移除此區。 */
  --surface: var(--card-bg);
  --surface-2: var(--bg-secondary);
  --bg: var(--bg-color);
  --bg-grad-1: var(--bg-secondary);
  --text: var(--text-primary);
  --text-muted: var(--text-secondary);
  --text-faint: var(--text-secondary);
  --accent: var(--primary-color);
  --accent-hover: var(--primary-color);
  --accent-soft: var(--nav-active-bg);
  --accent-ring: rgba(var(--primary-color-rgb), 0.25);
  --success: var(--status-positive);
  --success-soft: var(--badge-success-bg);
  --danger: var(--status-danger);
  --danger-soft: var(--badge-danger-bg);
  --warn: var(--status-warning);
  --border: var(--border-color);
  --border-strong: var(--border-color);
}
```
刪除原本 admin 那兩個 `:root` 區塊（set-1 硬值 + set-2 死變數）。其餘 class 規則**本 task 不動**。
> 若後續 build 報某個 set-1 token 未定義（例如漏掉某個），在此 `:root` 補上對應別名。

- [ ] **Step 4: AppLayout 加主題 toggle**
`admin/src/components/AppLayout.tsx`：
- 頂部 import：`import { useState } from 'react';`（若已 import 則合併）、`import { applyTheme, getTheme, type Theme } from '../theme';`
- 元件內加：
```tsx
  const [theme, setTheme] = useState<Theme>(getTheme());
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
```
- 在側邊欄底部（sidebar 內、nav 之後）加入切換鈕：
```tsx
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="切換深淺色">
          <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? '淺色模式' : '深色模式'}
        </button>
```
（實際插入點：找到 `<aside className="sidebar">` 內、導覽清單結束後、`</aside>` 之前。）

- [ ] **Step 5: 加 .theme-toggle 樣式（原生 CSS，之後 Task 2 併入 @apply 組）**
在 `admin/src/index.css` 適當處（sidebar 相關樣式附近）加：
```css
.theme-toggle {
  margin: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 24px);
  padding: 8px 12px;
  border: 1px solid var(--sidebar-border);
  border-radius: 9px;
  background: transparent;
  color: var(--on-sidebar);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.theme-toggle:hover {
  background: var(--sidebar-2);
}
```

- [ ] **Step 6: 建置 + 目視驗證**
Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: PASS。
目視：`npm run dev`，登入後**切換 toggle**，確認：(a) light 模式外觀與改寫前一致；(b) dark 模式整站（側欄外的內容區）轉深色、文字/邊框/主色正常；(c) 重新整理保留選擇、首次進站跟隨系統偏好。

- [ ] **Step 7: Commit**
```bash
git add admin/src/index.css admin/src/theme.ts admin/src/main.tsx admin/src/components/AppLayout.tsx
git commit -m "feat(admin-ui): 接入 @oa-agent/ui token + dark/light 切換（別名讓現有樣式即支援深色）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: @apply 改寫 — base / layout / sidebar / topbar / brand / theme-toggle

**Files:** Modify `admin/src/index.css`

- [ ] **Step 1: 改寫該組 class 為 @apply**
把下列相關規則從原生 CSS 改寫為 `@apply`（顏色用 ui token，比照 `@oa-agent/ui` 寫法）：全域 base（`body`/連結/scrollbar 等）、`.app`/版面 grid、`.sidebar`/`.nav*`/`.brand*`、`.topbar`/`.crumb`/`.page-title`/`.theme-toggle`。
**改寫規則**：每條屬性對應 Tailwind utility；顏色 `color/background/border` 用 `text-[var(--x)]`/`bg-[var(--x)]`/`border-[var(--x)]`，token 依 Global Constraints 對應表換成 ui token（側欄色仍用 `--sidebar*`）。
**Worked example**（`.brand-mark`）：
```css
/* 改寫前（原生） */
.brand-mark { width: 38px; height: 38px; border-radius: 11px; background: #fff; display: grid; place-items: center; overflow: hidden; flex: none; }
/* 改寫後（@apply） */
.brand-mark { @apply grid h-[38px] w-[38px] flex-none place-items-center overflow-hidden rounded-[11px] bg-white; }
```
無法 @apply 的（`.brand-mark img` 的 object-fit 可 @apply；`::-webkit-scrollbar` 保留原生）維持原生。

- [ ] **Step 2: 建置 + 目視**
Run: `cd admin && npm run build`；目視側邊欄、頂部、品牌、版面在 light+dark 皆正確、與改寫前一致。

- [ ] **Step 3: Commit**
```bash
git add admin/src/index.css
git commit -m "refactor(admin-ui): base/layout/sidebar/topbar 改寫為 @apply

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: @apply 改寫 — button / card / banner / badge

**Files:** Modify `admin/src/index.css`

- [ ] **Step 1: 改寫** `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-danger`/`.btn-sm`、`.card`/`.card-head`/`.card-title`/`.card-desc`/`.card-body`、`.banner*`、`.badge`/`.badge-on`/`.badge-off` 為 `@apply`（ui token）。
**Worked example**（`.btn-primary`）：
```css
.btn-primary { @apply border-[var(--primary-color)] bg-[var(--primary-color)] text-white hover:opacity-90; }
```
- [ ] **Step 2: 建置 + 目視** 各按鈕/卡片/badge 在 light+dark 正常（hover/active 態一併看）。
- [ ] **Step 3: Commit**
```bash
git add admin/src/index.css
git commit -m "refactor(admin-ui): button/card/banner/badge 改寫為 @apply

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: @apply 改寫 — field / input / select / form-actions / color-swatch

**Files:** Modify `admin/src/index.css`

- [ ] **Step 1: 改寫** `.field`/`.field-label`/`.field-hint`/`.form-grid`/`.form-actions`、`.input`/`.select`/`.toolbar`、`.color-field`（`input[type=color]` 本體可 @apply；`::-webkit-color-swatch-wrapper`/`::-webkit-color-swatch`/`::-moz-color-swatch` **保留原生**）為 `@apply`（ui token）。
**Worked example**（`.input`）：
```css
.input { @apply h-[38px] w-full rounded-[9px] border border-[var(--border-color)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary-color)]; }
```
- [ ] **Step 2: 建置 + 目視** 設定頁/外觀頁/知識庫頁的欄位、下拉、主色色票在 light+dark 正常。
- [ ] **Step 3: Commit**
```bash
git add admin/src/index.css
git commit -m "refactor(admin-ui): field/input/select/color-swatch 改寫為 @apply

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: @apply 改寫 — tabs / list / row

**Files:** Modify `admin/src/index.css`

- [ ] **Step 1: 改寫** `.tabs`/`.tab`/`.tab.active`（含既有 `@media (max-width:640px)` 內容——`@media` 區塊保留原生，內部宣告可用 @apply）、`.list`/`.row`/`.row-link`/`.row-main`/`.row-title`/`.row-sub`/`.row-actions`/`.row:last-child`/`.chev`/`.empty` 為 `@apply`（ui token）。
**Worked example**（`.tab.active`）：
```css
.tab.active { @apply bg-[var(--card-bg)] text-[var(--primary-color)] shadow-sm; }
```
- [ ] **Step 2: 建置 + 目視** 租戶詳情各 tab 列、清單、租戶列表在 light+dark 正常；tabs RWD 換行仍運作。
- [ ] **Step 3: Commit**
```bash
git add admin/src/index.css
git commit -m "refactor(admin-ui): tabs/list/row 改寫為 @apply

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: @apply 改寫 — login / form-designer / 其餘雜項

**Files:** Modify `admin/src/index.css`

- [ ] **Step 1: 改寫** `.login-*`、Form Designer 相關（`.designer*` 若在此檔）、以及檔案中尚未改寫的所有其餘 class 為 `@apply`（ui token）。掃一遍確保**沒有殘留 set-1 token**（`--surface`/`--border`/`--text`/`--accent`/`--danger`/`--success`）出現在 class 規則裡（側欄 `--sidebar*`、`--radius*`、`--shadow*`、`--font` 除外）。
- [ ] **Step 2: 建置 + 目視** 登入頁、Form Designer 在 light+dark 正常。
- [ ] **Step 3: Commit**
```bash
git add admin/src/index.css
git commit -m "refactor(admin-ui): login/designer/其餘 改寫為 @apply

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 清理別名 + 全站 light/dark 目視總驗

**Files:** Modify `admin/src/index.css`

- [ ] **Step 1: 確認 set-1 別名已無人使用**
Run: `cd admin && grep -nE "var\(--(surface|surface-2|bg|bg-grad-1|text|text-muted|text-faint|accent|accent-hover|accent-soft|accent-ring|success|success-soft|danger|danger-soft|warn|border|border-strong)\b" src/index.css`
Expected: 只剩 `:root` 內的別名定義本身（無其他 class 使用）。若仍有 class 使用 → 回該組改成 ui token。

- [ ] **Step 2: 移除別名區**
從 `:root` 刪除「set-1 → ui token 別名」整段（保留側欄/圓角/陰影/字型 token）。

- [ ] **Step 3: 建置 + 全站目視**
Run: `cd admin && npx tsc --noEmit && npm run build`
逐頁 light + dark 檢查：登入、租戶列表、租戶詳情（外觀/表單/知識庫/服務/設定/Webhook/用量）、Form Designer。確認與改寫前一致（light）、深色正常（dark）、無殘留淺色硬塊。

- [ ] **Step 4: Commit**
```bash
git add admin/src/index.css
git commit -m "refactor(admin-ui): 移除 set-1 token 別名，全面採用 @oa-agent/ui token

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 註記

- Spec 各節皆有對應 task：接線+toggle(T1)、token 對應(Global Constraints 表 + T1 別名 → 各組直接引用)、@apply 全面改寫(T2–T6 分組)、深色微調(各組目視時處理)、清理+總驗(T7)。
- 風險控制：T1 先用別名讓 dark mode **零 class 改動**即落地；T2–T6 每組 build+目視+commit；T7 收尾。
- 一致性：Token 對應表為單一來源；側欄固定深色、主色採 ui 藍，皆與 spec 一致。
- 註：本計畫為大規模樣式改寫，`@apply` 各組以「對應表 + 每組 worked example + 目視驗證」指引，不逐行列出全部 ~1000 行轉換。
