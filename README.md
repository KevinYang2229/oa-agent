# OA Agent（MVP）

對話式 OA 表單填寫 Agent。員工用自然語言描述需求，Agent 透過對話補齊欄位（slot-filling）、驗證、請使用者確認後送出。**MVP：請假單（leave-request）**，schema-driven、Claude 驅動、OA 以 stub 模擬。

## 核心理念：一份 Schema 當唯一來源

表單以 `schemas/<formId>/` 下的六層 JSON 定義，程式由此生成驗證與 Agent 工具：

| 層 | 檔 | 用途 | MVP |
|---|---|---|---|
| Data | `data.schema.json` | 資料形狀（JSON Schema = OA 契約） | ✅ |
| Field | `field.schema.json` | 欄位 UI 元件 + 標籤 + 選項 | ✅ |
| Validation | `validation.schema.json` | 必填 + 跨欄商規 | ✅ |
| Agent | `agent.schema.json` | 詢問順序、提示、確認話術 | ✅ |
| Layout | `layout.schema.json` | 版面（optional seam） | 🔸 留著未用 |
| Workflow | `workflow.schema.json` | 簽核流程（optional seam） | 🔸 留著未用 |

新增一張表單 = 在 `schemas/` 加一個資料夾，**不需改編排層程式**。

## 專案結構（monorepo / npm workspaces）

```
oa-agent/
├─ schemas/            前後端共用：六層表單 JSON Definition（單一來源）
├─ shared/             前後端共用：TS 型別（Definition / FieldSpec / SessionStatus…）
├─ ui/                 設計系統元件庫 @oa-agent/ui（前端共用、純展示）
├─ server/             後端 Express（schema 引擎 + 對話 Agent + REST）
└─ client/             前端 Vite + React + TS（對話 + schema-driven 表單）
```

`server` 與 `client` 都 import `@oa-agent/shared`，型別不再各寫一份。

### 設計系統與 schema-driven 渲染

表單元件由 schema 的 `field.component` 決定，透過一張 registry 對應到 `@oa-agent/ui` 的元件：

```
ui/src/components/*          設計系統元件（自己的 props，不認識 schema）
ui/src/styles.css            設計系統共用樣式：token（--primary-color…）+ base + 共用 class
client/src/form/registry.tsx field.component（'Select'…）→ 設計系統元件的 adapter
client/src/FormView.tsx      只查 registry render，不寫死 switch
```

設計系統的共用樣式由 ui 套件擁有並對外提供，client 引用一次（`@import "tailwindcss"` 之後）：

```css
/* client/src/index.css */
@import 'tailwindcss';
@import '@oa-agent/ui/styles.css';   /* ← 元件共用 token + base */
```

（`@oa-agent/ui/styles.css` 對應 `ui/src/styles.css`，於 ui 的 package.json `exports` 宣告。）

**接上你的設計系統**：
1. 把元件放進 `ui/src/components/` 並從 `ui/src/index.ts` export。
2. 在 `client/src/form/registry.tsx` import，寫一個把 `FieldControlProps`（`spec` / `value` / `onChange` / `disabled`）轉成該元件 props 的 adapter。
3. 加進 `fieldRegistry`。FormView 不需改動。

（`ui/src/components/` 內目前是範例佔位元件，換成你的設計系統後保留 props 介面即可。）

## 快速開始

```bash
# 1. 安裝（根目錄一次裝齊所有 workspace）
npm install

# 2. 設定 API key（編輯 server/.env，把 ANTHROPIC_API_KEY 換成真正的 key）
#    ANTHROPIC_API_KEY=sk-ant-...

# 3. 啟動（兩個終端機）
npm run dev:server   # 後端 http://localhost:3000
npm run dev:client   # 前端 http://localhost:5173

# 4.（離線）驗證 schema 引擎，不需 key
npm run smoke

# build / typecheck 全部 workspace
npm run build
npm run typecheck
```

打開 http://localhost:5173 即可用對話畫面填寫請假單；前端 dev server 會把 `/api`、`/healthz` proxy 到後端 3000。

## API（REST，全程繁中對話）

| Method | Path | 說明 |
|---|---|---|
| POST | `/api/v1/conversations` | 建對話，可帶 `{ "message": "..." }` 起首輪 |
| POST | `/api/v1/conversations/:id/messages` | 送一則訊息，跑一輪 |
| PATCH | `/api/v1/conversations/:id/fields` | 確認畫面手動編輯欄位（不經 LLM，走 form.engine 驗證後存回） |
| GET | `/api/v1/conversations/:id` | 取狀態 + 已填值 + 送出結果 |
| POST | `/api/v1/conversations/:id/cancel` | 取消 |
| GET | `/api/v1/forms` / `/api/v1/forms/:formId` | 列出 / 取得表單 Definition |

> MVP 未接 JWT，使用者身分用 `x-user-id` header（預設 `demo-user`）。

### Demo（curl）

```bash
# 建立並起首輪
curl -s -X POST localhost:3000/api/v1/conversations \
  -H 'content-type: application/json' -H 'x-user-id: kevin' \
  -d '{"message":"我下週一到週二要請特休，家裡有事"}'

# 後續回答（用回傳的 id）
curl -s -X POST localhost:3000/api/v1/conversations/<id>/messages \
  -H 'content-type: application/json' -H 'x-user-id: kevin' \
  -d '{"message":"確認"}'
```

Agent 會逐一問缺漏欄位 → 必填齊全後出摘要請你回「確認」→ 送出 stub OA，回 `oaRequestId: STUB-...`。

## 架構

```
server/src/
  config/env.ts                 環境變數（含 LLM_/OA_）
  lib/llm/                      LLM provider 抽象 + Claude 實作（tool use + prompt caching）
  lib/oa/                       OA 連接器抽象 + StubOAConnector
  modules/form/                 schema-core：型別 / Ajv 引擎 / loader / registry / 工具生成
  modules/conversation/         in-memory session + slot-filling agent loop + REST
  modules/leave/                請假最終驗證 → 送 OA
client/src/
  api.ts                        對話 / 表單 API client（型別取自 @oa-agent/shared）
  App.tsx                       對話畫面 + 狀態管理
  FormView.tsx                  schema-driven 表單：依 field.component 渲染可編輯元件
shared/src/index.ts             前後端共用型別（Definition / FieldSpec / SessionStatus…）
schemas/leave-request/*.json    六層表單 Definition（前後端共用單一來源）
```

**送出守門**：`submit` 只在「使用者上一輪已看到摘要（status=confirming）且本輪確認」時才執行，伺服器端硬守，LLM 無法跳過。確認畫面的手動編輯走 `PATCH /fields`，同樣經 `form.engine` 驗證後才存回 `session.values`，因此畫面所見即送出所送。

## 已實作 vs 延後

- ✅ schema-driven 引擎、對話 slot-filling、Claude 抽象、OA stub、確認送出、REST
- ✅ React 前端：對話畫面 + schema-driven 表單（依 `field.component` 渲染、送出前可編輯）
- 🔜 延後（架構留 seam）：表單 Designer、真 OA HTTP 連接器、Prisma 持久化、workflow/簽核、OpenAI provider、報告產出

## 可抽換層

- LLM：`LLM_PROVIDER`（目前 `anthropic`）— 換廠商只要新增 `lib/llm/<x>.provider.ts`
- OA：`OA_CONNECTOR`（目前 `stub`）— 真 OA 規格確定後實作 `lib/oa/http.connector.ts`
