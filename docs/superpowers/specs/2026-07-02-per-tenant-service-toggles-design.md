# 設計：管理者設定租戶可用服務

日期：2026-07-02
狀態：設計已確認，待實作計畫

## Context

我們已有可插拔的 agent 服務架構（`serviceRegistry` 註冊 `form`、`knowledge`）與每租戶表單（form designer）。目前**所有租戶都能用所有服務與所有表單**，無法逐租戶控管。本功能讓管理者在後台為各租戶開關：(1) agent 服務類別（Form / Knowledge），(2) Form 服務內的個別表單。

## 決策（已確認）

- **兩種granularity**：服務類別 + 個別表單。
- **opt-out 預設全開**：用「停用清單」，未設定＝全開，向後相容；日後新增的服務/表單自動對所有租戶開放。
- 服務開關 UI 放在 TenantDetailPage 新分頁。

## 資料模型（擴充 Tenant）

`server/src/modules/tenant/tenant.types.ts` 的 `Tenant` 增：
```ts
/** 停用的 agent 服務 id（如 ['knowledge']）；空/未設 = 全部啟用 */
disabledServices?: string[];
/** 停用的表單 id（如 ['business-trip-domestic']）；空/未設 = 全部啟用 */
disabledForms?: string[];
```
tenant.store 的 persist/restore 已整包序列化 Tenant，無需額外處理。

## 服務契約補充

`AgentService`（`agent-service.types.ts`）增 `readonly label: string`（給 admin UI 顯示）。
- `formAgentService.label = '填表申請'`
- `knowledgeAgentService.label = '知識庫問答'`

## 強制點（enforcement）

### 服務層
`service.registry.ts` 新增：
```ts
enabledFor(tenantId: string): AgentService[]
// = all() 濾掉 tenantStore.getTenant(tenantId)?.disabledServices
```
`intent-router.ts` 的 `keywordRoute`、`classify`、`route` 全部把 `serviceRegistry.all()` 改為 `serviceRegistry.enabledFor(session.tenantId)`。→ 被停用的服務永遠不被路由/分類到。

### 表單層
新增 helper（放 `form.agent-service.ts`，避免 form.registry 反向依賴 tenant）：
```ts
export function listEnabledForms(tenantId: string): Definition[]
// = listDefinitions(tenantId) 濾掉 tenant.disabledForms
```
改用點（皆在 conversation 層）：
- `formAgentService.intents()` → `listEnabledForms`（同時影響 keyword 路由與分類 catalog）
- `buildSystemPrompt` 的「本系統可申請的表單」清單 → `listEnabledForms`
- `intent-router.pickFormId()` → `listEnabledForms`

`getDefinition(tenantId, formId)` 不變（既有 session 不因停用而中斷）。`listDefinitions` 保持原樣（未過濾），admin catalog 用它取完整清單。

## Admin API

- **catalog（給 UI 畫開關）**：`GET /admin/tenants/:id/services`
  → `{ services: [{ id, label, enabled }], forms: [{ formId, title, enabled }] }`
  （`services` 來自 `serviceRegistry.all()`；`forms` 來自 `listDefinitions(id)` 完整清單；`enabled` = 不在對應 disabled 清單中。）
  控制器：`knowledge` 無關——放在既有 `admin.controller` 或新 `service-toggle` controller。採新檔 `tenant.services.controller.ts` 於 tenant 模組，掛 admin.routes。
- **儲存**：沿用 `PATCH /admin/tenants/:id`；`patchTenantSchema`（admin.schema）增選填 `disabledServices?: string[]`、`disabledForms?: string[]`；`adminController.updateTenant` / `tenantStore.update` 需接受並寫入這兩欄。

## Admin UI

TenantDetailPage 新增 **「服務」tab**（`ServicesTab.tsx`）：
- 載入 `api.getTenantServices(tenantId)`。
- 兩區塊 checkbox：「Agent 服務」（services）、「可用表單」（forms），預設依 `enabled` 勾選。
- 儲存：把未勾選者組成 `disabledServices` / `disabledForms`，呼叫既有 `api.updateTenant(id, { disabledServices, disabledForms })`。
- api.ts 增型別 `TenantServiceCatalog` + `getTenantServices`；`updateTenant` 的 body 型別加兩欄。

## 邊界 / 相容

- 全部向後相容（現有租戶 undefined = 全開）。
- **全表單停用**：`pickFormId` 若算出的表單在 disabledForms → 退回第一個啟用表單；若無任何啟用表單 → 仍回 `DEFAULT_FORM_ID`（form 服務退化但不崩）。UI 於某區塊全不勾時顯示警告，但不硬擋。
- **全服務停用**：router `enabledFor` 回空時，`route` 退回 `activeServiceId ?? 'form'`（維持可運作）；UI 同樣警告不硬擋。

## 測試

- `enabledFor` 濾除 disabledServices；`listEnabledForms` 濾除 disabledForms。
- router 不路由到停用服務（keyword + classify 兩路徑）。
- catalog 端點回正確 `enabled` 狀態（含 base + tenant 表單）。
- `PATCH /admin/tenants/:id` 存/讀 disabledServices/disabledForms 往返。
- 邊界：全表單停用時 pickFormId 優雅退回。

## 對應改動檔案

- 改：`tenant.types.ts`、`tenant.store.ts`（update 接受新欄）、`agent-service.types.ts`、`form.agent-service.ts`、`knowledge.agent-service.ts`、`service.registry.ts`、`intent-router.ts`、`admin/admin.schema.ts`、`admin/admin.controller.ts`、`admin/admin.routes.ts`
- 新增：`tenant/tenant.services.controller.ts`、`admin/src/pages/tabs/ServicesTab.tsx`
- 改前端：`admin/src/api.ts`、`admin/src/pages/TenantDetailPage.tsx`
- 測試：`tests/service-toggles.test.ts`、`tests/tenant-services-admin.test.ts`
