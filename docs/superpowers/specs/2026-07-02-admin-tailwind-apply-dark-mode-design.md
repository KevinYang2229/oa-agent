# 設計：Admin 樣式統一為 Tailwind @apply + Dark/Light Mode

日期：2026-07-02
狀態：設計已確認，待實作計畫

## Context

admin 目前是**手寫純 CSS**（`admin/src/index.css`，0 個 `@apply`），用自成一套的 token（set-1：`--surface`/`--border`/`--text`/`--accent`）。client 則 `@import "tailwindcss"` + `@import "@oa-agent/ui/index.css"`，用共用設計系統套件 `@oa-agent/ui`（set-2 token：`--card-bg`/`--text-primary`/`--primary-color`…）並內建 dark mode（`:root[data-theme="dark"]` 全域覆寫 token）。

admin 其實**已依賴 `@oa-agent/ui` 且 vite 已掛 `@tailwindcss/vite`**，只是從未 import。目標：把 admin 樣式改成與 client 一致的 **Tailwind @apply + `@oa-agent/ui` token** 寫法，並加上 dark/light 切換。

## 決策（已確認）

- 一次做到位：**@apply 全面改寫 + token 換成 ui token + dark mode + toggle**。
- 保留 admin 現有 class 名稱與 JSX（`.card`/`.btn`/`.row`/`.tabs`/`.sidebar`/`.field`…），只改 `index.css` 的規則寫法與 token。
- dark mode 沿用 `@oa-agent/ui` 的 `:root[data-theme="dark"]` 機制（設 `<html data-theme>` 即整站切換）。

## 架構

```
admin/src/index.css
  @import "tailwindcss";              ← 啟用 Tailwind utilities / @apply
  @import "@oa-agent/ui/index.css";   ← 取得 ui token（light + dark）
  @theme { --font-sans: ... }          ← 字型（比照 client）
  /* admin 專屬 class，全部改寫為 @apply，顏色用 ui token */
  .card { @apply ... bg-[var(--card-bg)] border-[var(--border-color)] ...; }
  ...
<html data-theme="light|dark">  ← 由 toggle 設定；ui token 隨之切換
```

## 1. 接線（index.css 頭部）

加入 `@import "tailwindcss";`、`@import "@oa-agent/ui/index.css";`、`@theme { --font-sans: "Plus Jakarta Sans","Noto Sans TC",system-ui,sans-serif; }`。移除 admin 自有的兩組 `:root`（set-1 硬值 + set-2 死變數）——token 一律改用 ui 提供的。

保留 admin 專屬、ui 沒有的少量 token（如 `--sidebar` 系列、`--radius`、`--shadow-*`）於一個精簡 `:root`，並為 dark 視需要在 `:root[data-theme="dark"]` 補值。

## 2. Token 對應（set-1 → ui token）

@apply 改寫時，顏色一律換成 ui token：

| admin set-1 | ui token |
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
| `--danger` / `--danger-soft` | `--status-danger` / `--badge-danger-bg` |
| `--success` / `--success-soft` | `--status-positive` / `--badge-success-bg` |

側邊欄（`--sidebar`/`--sidebar-2`/`--on-sidebar`…）：**維持深色設計、跨模式固定**（側邊欄本就是 dark 元件），保留為 admin 專屬 token 字面值；不套 light/dark 切換，避免在深色模式下與內容區糊在一起。`--radius`/`--shadow-*` 保留字面值（ui 用 Tailwind 陰影，admin 沿用現值即可）。

## 3. @apply 全面改寫

把 `admin/src/index.css` 每條 class 規則改寫為 `@apply`（比照 `@oa-agent/ui`/client 寫法：utility + `[var(--token)]` 任意值）。

- 能用 utility 表達的（layout/spacing/typography/color/border/radius/shadow）→ `@apply`。
- 無法 `@apply` 的（`::-webkit-color-swatch` 等 pseudo-element、`@keyframes`、複雜選擇器、`@media` 內容）→ 保留為原生 CSS（ui 也是這樣混用）。
- 分組進行以利驗證：base/layout、sidebar/nav、topbar/brand、card、button、field/input/select、tabs、list/row/badge、login、form-designer、色票/雜項。

## 4. Dark / Light Toggle

- 一個 `theme.ts`：讀 `localStorage('oa-admin-theme')`（'light'|'dark'）→ 無則用 `matchMedia('(prefers-color-scheme: dark)')`；`applyTheme(t)` 設 `document.documentElement.dataset.theme` 並寫回 localStorage。
- **防閃爍**：在 `main.tsx` 於 render 前先 `applyTheme(initialTheme())`（或 index.html inline script）。
- **切換 UI**：於 `AppLayout` 側邊欄底部加一顆切換鈕（太陽/月亮圖示），呼叫 `applyTheme`。比照 client 的切換語意。

## 5. 深色微調

改寫後於每頁檢查並視需要補少量覆寫：
- 品牌 logo 容器：白底（已是），深色下仍清楚。
- badge（badge-on/off）、危險鈕、色票外框、陰影在深色下的對比。
- 側邊欄與內容區的邊界對比。

## 6. 驗證

- `cd admin && npx tsc --noEmit && npm run build` 綠。
- **視覺回歸（人工）**：逐頁在 light 與 dark 兩種模式檢視——登入頁、租戶列表、租戶詳情各 tab（外觀/表單/知識庫/服務/設定/Webhook/用量）、Form Designer。確認外觀與改寫前一致（light）且深色正常（dark）。
- 因無視覺自動化測試，改寫**分組 commit**，每組 build + 目視確認後再進下一組，降低回歸風險。

## 邊界 / 風險

- @apply 改寫是 ~1000 行、純樣式，**視覺回歸風險高**：以「分組改寫 + 每組目視」控制。
- ui token 與 admin 原色不完全相同（例如 primary 由靛藍 `#4f46e5` 變成 ui 的 `#0060d5`），改寫後**品牌色會變成 ui 那套**——這是「與 client 一致」的預期結果；若要保留 admin 原色需另在 admin 覆寫 token（設計預設採 ui 色）。
- 只動 `admin/`；不改 `@oa-agent/ui`、client、server。

## 對應改動檔案

- 改：`admin/src/index.css`（全面改寫）
- 新增：`admin/src/theme.ts`（初始化 + applyTheme）
- 改：`admin/src/main.tsx`（render 前套主題）、`admin/src/components/AppLayout.tsx`（加切換鈕）
- 可能微改：`admin/index.html`（防閃爍 inline script，選配）
