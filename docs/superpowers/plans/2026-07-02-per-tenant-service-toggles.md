# 每租戶服務開關 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓管理者為各租戶開關可用的 agent 服務（Form / Knowledge）與個別表單，opt-out（預設全開）。

**Architecture:** 在 `Tenant` 加「停用清單」`disabledServices` / `disabledForms`；路由層 `serviceRegistry.enabledFor(tenantId)` 與表單層 `listEnabledForms(tenantId)` 依租戶過濾；admin 提供 catalog 端點 + 沿用 PATCH tenant 儲存；admin SPA 新增「服務」tab。

**Tech Stack:** Express + TypeScript（server），React + Vite（admin），Jest（ts-jest），supertest。

## Global Constraints

- 繁體中文註解與 UI 文案。
- server 測試：`cd server && npx jest <file>`；型別：`npm run typecheck`；lint：`npm run lint`。admin：`cd admin && npx tsc --noEmit`。
- opt-out 模型：停用清單，未設 = 全啟用；向後相容（現有租戶不變）。
- 路徑別名 `@/*` → `server/src/*`。
- admin 端點掛 `requireAdmin`（`admin.routes.ts`）。
- 既有簽名：`tenantStore.getTenant(id)`、`tenantStore.createTenant(name, allowedOrigins?, ssoSecret?)`、`tenantStore.updateTenant(id, patch)`；`patchTenantSchema`；`admin/src/api.ts` 的 `api.updateTenant(id, patch)`。

---

## Task 1: Tenant 停用欄位 + store 更新

**Files:**
- Modify: `server/src/modules/tenant/tenant.types.ts`
- Modify: `server/src/modules/tenant/tenant.store.ts:130-148`
- Test: `server/tests/tenant-disabled-fields.test.ts`

**Interfaces:**
- Produces: `Tenant.disabledServices?: string[]`、`Tenant.disabledForms?: string[]`；`tenantStore.updateTenant` 接受此二欄。

- [ ] **Step 1: 失敗測試** `server/tests/tenant-disabled-fields.test.ts`
```ts
import { tenantStore } from '@/modules/tenant/tenant.store';

it('updateTenant 存取 disabledServices / disabledForms', () => {
  const t = tenantStore.createTenant('toggle-test');
  const updated = tenantStore.updateTenant(t.id, {
    disabledServices: ['knowledge'],
    disabledForms: ['business-trip-domestic'],
  });
  expect(updated?.disabledServices).toEqual(['knowledge']);
  expect(tenantStore.getTenant(t.id)?.disabledForms).toEqual(['business-trip-domestic']);
});
```

- [ ] **Step 2: 執行確認失敗**
Run: `cd server && npx jest tests/tenant-disabled-fields.test.ts`
Expected: FAIL（型別不接受 / 未寫入）

- [ ] **Step 3: 加型別**
`server/src/modules/tenant/tenant.types.ts` 的 `Tenant` interface 內（`appearance?` 後）加：
```ts
  /** 停用的 agent 服務 id（如 ['knowledge']）；空/未設 = 全部啟用 */
  disabledServices?: string[];
  /** 停用的表單 id（如 ['business-trip-domestic']）；空/未設 = 全部啟用 */
  disabledForms?: string[];
```

- [ ] **Step 4: store 接受更新**
`server/src/modules/tenant/tenant.store.ts` 的 `updateTenant`：把參數型別的 `Pick` 與 merge 補上兩欄：
```ts
  updateTenant(
    id: string,
    patch: Partial<
      Pick<Tenant, 'name' | 'allowedOrigins' | 'ssoSecret' | 'appearance' | 'disabledServices' | 'disabledForms'>
    >,
  ): Tenant | undefined {
    const tenant = tenants.get(id);
    if (!tenant) return undefined;
    const next: Tenant = {
      ...tenant,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.allowedOrigins !== undefined ? { allowedOrigins: patch.allowedOrigins } : {}),
      ...(patch.ssoSecret !== undefined ? { ssoSecret: patch.ssoSecret } : {}),
      ...(patch.appearance !== undefined
        ? { appearance: { ...tenant.appearance, ...patch.appearance } }
        : {}),
      ...(patch.disabledServices !== undefined ? { disabledServices: patch.disabledServices } : {}),
      ...(patch.disabledForms !== undefined ? { disabledForms: patch.disabledForms } : {}),
    };
    tenants.set(id, next);
    persist();
    return next;
  },
```

- [ ] **Step 5: 執行確認通過**
Run: `cd server && npx jest tests/tenant-disabled-fields.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add server/src/modules/tenant/tenant.types.ts server/src/modules/tenant/tenant.store.ts server/tests/tenant-disabled-fields.test.ts
git commit -m "feat(tenant): 加入 disabledServices / disabledForms 停用清單

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 服務 label + serviceRegistry.enabledFor + 路由過濾

**Files:**
- Modify: `server/src/modules/conversation/agent-service.types.ts`
- Modify: `server/src/modules/conversation/form.agent-service.ts`
- Modify: `server/src/modules/knowledge/knowledge.agent-service.ts`
- Modify: `server/src/modules/conversation/service.registry.ts`
- Modify: `server/src/modules/conversation/intent-router.ts`
- Test: `server/tests/service-enabled.test.ts`

**Interfaces:**
- Consumes: `tenantStore.getTenant`（Task 1）、`Tenant.disabledServices`（Task 1）。
- Produces: `AgentService.label: string`；`serviceRegistry.enabledFor(tenantId): AgentService[]`。

- [ ] **Step 1: 失敗測試** `server/tests/service-enabled.test.ts`
```ts
import { tenantStore } from '@/modules/tenant/tenant.store';
import { serviceRegistry } from '@/modules/conversation/service.registry';

it('enabledFor 濾掉租戶 disabledServices', () => {
  const t = tenantStore.createTenant('svc-enabled-test');
  expect(serviceRegistry.enabledFor(t.id).map((s) => s.id).sort()).toEqual(['form', 'knowledge']);
  tenantStore.updateTenant(t.id, { disabledServices: ['knowledge'] });
  expect(serviceRegistry.enabledFor(t.id).map((s) => s.id)).toEqual(['form']);
});

it('每個服務都有 label', () => {
  expect(serviceRegistry.all().every((s) => typeof s.label === 'string' && s.label.length > 0)).toBe(true);
});
```

- [ ] **Step 2: 執行確認失敗**
Run: `cd server && npx jest tests/service-enabled.test.ts`
Expected: FAIL（`label` / `enabledFor` 不存在）

- [ ] **Step 3: 契約加 label**
`agent-service.types.ts` 的 `AgentService` interface 加（`id` 後）：
```ts
  /** 顯示名稱（admin 服務開關 UI 用） */
  readonly label: string;
```

- [ ] **Step 4: 兩個服務設 label**
`form.agent-service.ts` 的 `formAgentService`：在 `id: 'form',` 下一行加 `label: '填表申請',`。
`knowledge.agent-service.ts` 的 `knowledgeAgentService`：在 `id: 'knowledge',` 下一行加 `label: '知識庫問答',`。

- [ ] **Step 5: enabledFor**
`service.registry.ts` 頂部加 `import { tenantStore } from '@/modules/tenant/tenant.store';`，並在 `serviceRegistry` 物件加方法：
```ts
  /** 該租戶啟用中的服務（濾掉 disabledServices） */
  enabledFor(tenantId: string): AgentService[] {
    const disabled = new Set(tenantStore.getTenant(tenantId)?.disabledServices ?? []);
    return [...registry.values()].filter((s) => !disabled.has(s.id));
  },
```

- [ ] **Step 6: 路由改用 enabledFor**
`intent-router.ts`：`keywordRoute` 內 `serviceRegistry.all()` → `serviceRegistry.enabledFor(session.tenantId)`；`classify` 內 `const services = serviceRegistry.all();` → `const services = serviceRegistry.enabledFor(session.tenantId);`。（`route` 不需改，因它呼叫這兩者。）

- [ ] **Step 7: 執行確認通過**
Run: `cd server && npx jest tests/service-enabled.test.ts tests/intent-router.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**
```bash
git add server/src/modules/conversation/agent-service.types.ts server/src/modules/conversation/form.agent-service.ts server/src/modules/knowledge/knowledge.agent-service.ts server/src/modules/conversation/service.registry.ts server/src/modules/conversation/intent-router.ts server/tests/service-enabled.test.ts
git commit -m "feat(conversation): 服務加 label、依租戶 disabledServices 過濾路由

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: listEnabledForms + 表單過濾接入

**Files:**
- Modify: `server/src/modules/conversation/form.agent-service.ts`
- Modify: `server/src/modules/conversation/intent-router.ts`
- Test: `server/tests/form-enabled.test.ts`

**Interfaces:**
- Consumes: `listDefinitions`（form.registry）、`tenantStore`（Task 1）。
- Produces: `listEnabledForms(tenantId: string): Definition[]`（export from form.agent-service.ts）。

- [ ] **Step 1: 失敗測試** `server/tests/form-enabled.test.ts`
```ts
import { tenantStore } from '@/modules/tenant/tenant.store';
import { listEnabledForms } from '@/modules/conversation/form.agent-service';
import { pickFormId } from '@/modules/conversation/intent-router';

it('listEnabledForms 濾掉 disabledForms', () => {
  const t = tenantStore.createTenant('form-enabled-test');
  const all = listEnabledForms(t.id).map((d) => d.formId);
  expect(all).toContain('leave-request');
  tenantStore.updateTenant(t.id, { disabledForms: ['leave-request'] });
  expect(listEnabledForms(t.id).map((d) => d.formId)).not.toContain('leave-request');
});

it('pickFormId 不會選到被停用的表單', () => {
  const t = tenantStore.createTenant('pickform-test');
  tenantStore.updateTenant(t.id, { disabledForms: ['leave-request'] });
  expect(pickFormId(t.id, '我要請假')).not.toBe('leave-request');
});
```

- [ ] **Step 2: 執行確認失敗**
Run: `cd server && npx jest tests/form-enabled.test.ts`
Expected: FAIL（`listEnabledForms` 不存在）

- [ ] **Step 3: 新增 listEnabledForms**
`form.agent-service.ts`（已 import `listDefinitions`、`tenantStore`、型別 `Definition`）加 export：
```ts
/** 該租戶啟用中的表單（濾掉 disabledForms） */
export function listEnabledForms(tenantId: string): Definition[] {
  const disabled = new Set(tenantStore.getTenant(tenantId)?.disabledForms ?? []);
  return listDefinitions(tenantId).filter((d) => !disabled.has(d.formId));
}
```

- [ ] **Step 4: 接入 form 服務的兩處**
`form.agent-service.ts`：
- `formAgentService.intents()` 內把 `listDefinitions(session.tenantId)` 改為 `listEnabledForms(session.tenantId)`。
- `buildSystemPrompt` 內組 `allForms` 的 `listDefinitions(tenantId)` 改為 `listEnabledForms(tenantId)`。

- [ ] **Step 5: pickFormId 改用 listEnabledForms（含全停用退回）**
`intent-router.ts`：移除 `import { listDefinitions } from '@/modules/form/form.registry';`（若僅 pickFormId 用），改 `import { isSubmitConfirmation, listEnabledForms } from './form.agent-service';`（合併既有 import）。重寫 `pickFormId`：
```ts
export function pickFormId(tenantId: string, message?: string): string {
  const forms = listEnabledForms(tenantId);
  if (forms.length === 0) return DEFAULT_FORM_ID; // 全停用：退回預設（form 服務退化但不崩）
  const text = message?.trim();
  let best = forms.some((f) => f.formId === DEFAULT_FORM_ID) ? DEFAULT_FORM_ID : forms[0].formId;
  let bestScore = 0;
  for (const def of forms) {
    const score = (def.agent.keywords ?? []).reduce(
      (n, kw) => (kw && text?.includes(kw) ? n + 1 : n),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = def.formId;
    }
  }
  return best;
}
```

- [ ] **Step 6: 執行確認通過**
Run: `cd server && npx jest tests/form-enabled.test.ts tests/intent-router.test.ts && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**
```bash
git add server/src/modules/conversation/form.agent-service.ts server/src/modules/conversation/intent-router.ts server/tests/form-enabled.test.ts
git commit -m "feat(conversation): 依租戶 disabledForms 過濾可用表單與路由

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Admin catalog 端點 + PATCH 接受停用欄位

**Files:**
- Create: `server/src/modules/admin/tenant-services.controller.ts`
- Modify: `server/src/modules/admin/admin.schema.ts`
- Modify: `server/src/modules/admin/admin.routes.ts`
- Test: `server/tests/tenant-services-admin.test.ts`

**Interfaces:**
- Consumes: `serviceRegistry.all`、`listDefinitions`、`tenantStore`、`tenantParamSchema`、`patchTenantSchema`。
- Produces 路由：`GET /admin/tenants/:id/services`；`PATCH /admin/tenants/:id` 接受 `disabledServices?` / `disabledForms?`。

- [ ] **Step 1: 失敗測試** `server/tests/tenant-services-admin.test.ts`
```ts
import request from 'supertest';
import { createApp } from '@/app';
import { tenantStore } from '@/modules/tenant/tenant.store';

const app = createApp();
const auth = { 'x-admin-key': 'test-admin-key' };

it('GET services 回傳 catalog（含 enabled 狀態）', async () => {
  const t = tenantStore.createTenant('catalog-test');
  tenantStore.updateTenant(t.id, { disabledServices: ['knowledge'] });
  const res = await request(app).get(`/api/v1/admin/tenants/${t.id}/services`).set(auth).expect(200);
  const knowledge = res.body.data.services.find((s: { id: string }) => s.id === 'knowledge');
  expect(knowledge.enabled).toBe(false);
  expect(res.body.data.forms.length).toBeGreaterThan(0);
  expect(res.body.data.forms[0]).toHaveProperty('enabled');
});

it('PATCH tenant 存 disabledForms', async () => {
  const t = tenantStore.createTenant('patch-test');
  await request(app)
    .patch(`/api/v1/admin/tenants/${t.id}`)
    .set(auth)
    .send({ disabledForms: ['business-trip-domestic'] })
    .expect(200);
  expect(tenantStore.getTenant(t.id)?.disabledForms).toEqual(['business-trip-domestic']);
});
```

- [ ] **Step 2: 執行確認失敗**
Run: `cd server && npx jest tests/tenant-services-admin.test.ts`
Expected: FAIL（route 404 / patch 未存）

- [ ] **Step 3: catalog controller**
`server/src/modules/admin/tenant-services.controller.ts`：
```ts
/** 管理端：某租戶的服務/表單 catalog（含 enabled 狀態），供服務開關 UI 使用。 */
import type { Request, Response } from 'express';
import { serviceRegistry } from '@/modules/conversation/service.registry';
import { listDefinitions } from '@/modules/form/form.registry';
import { tenantStore } from '@/modules/tenant/tenant.store';

export const tenantServicesController = {
  async get(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const t = tenantStore.getTenant(id);
    const disabledS = new Set(t?.disabledServices ?? []);
    const disabledF = new Set(t?.disabledForms ?? []);
    const services = serviceRegistry.all().map((s) => ({ id: s.id, label: s.label, enabled: !disabledS.has(s.id) }));
    const forms = listDefinitions(id).map((d) => ({
      formId: d.formId,
      title: d.data.title ?? d.agent.description,
      enabled: !disabledF.has(d.formId),
    }));
    res.json({ data: { services, forms } });
  },
};
```

- [ ] **Step 4: patchTenantSchema 加兩欄**
`admin.schema.ts` 的 `patchTenantSchema` 的 `.object({...})` 內加：
```ts
    disabledServices: z.array(z.string()).optional(),
    disabledForms: z.array(z.string()).optional(),
```

- [ ] **Step 5: 掛路由**
`admin.routes.ts`：頂部加 `import { tenantServicesController } from './tenant-services.controller';`；在 tenants 相關路由區加：
```ts
router.get(
  '/tenants/:id/services',
  validate({ params: tenantParamSchema }),
  asyncHandler(tenantServicesController.get),
);
```

- [ ] **Step 6: 執行確認通過**
Run: `cd server && npx jest tests/tenant-services-admin.test.ts && npm run typecheck && npm run lint`
Expected: PASS
（`adminController.updateTenant` 已把整包 body 傳給 `tenantStore.updateTenant`，Task 1 已讓 store 接受新欄，故 PATCH 無需再改 controller。）

- [ ] **Step 7: Commit**
```bash
git add server/src/modules/admin/tenant-services.controller.ts server/src/modules/admin/admin.schema.ts server/src/modules/admin/admin.routes.ts server/tests/tenant-services-admin.test.ts
git commit -m "feat(admin): 服務/表單 catalog 端點 + PATCH 接受停用清單

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Admin API client

**Files:**
- Modify: `admin/src/api.ts`

**Interfaces:**
- Produces（供 Task 6）：型別 `TenantServiceCatalog`；`api.getTenantServices(id)`；`api.updateTenant` body 型別含 `disabledServices?` / `disabledForms?`；`Tenant` 型別含此二欄。

- [ ] **Step 1: 型別 + 函式**
`admin/src/api.ts`：
- `Tenant` interface 加 `disabledServices?: string[];` `disabledForms?: string[];`。
- 在 `api` 物件加型別（放檔案上方 interface 區）：
```ts
export interface TenantServiceCatalog {
  services: { id: string; label: string; enabled: boolean }[];
  forms: { formId: string; title: string; enabled: boolean }[];
}
```
- `api.updateTenant` 的 patch 型別由 `Partial<Pick<Tenant, 'name' | 'allowedOrigins' | 'ssoSecret' | 'appearance'>>` 改為 `Partial<Pick<Tenant, 'name' | 'allowedOrigins' | 'ssoSecret' | 'appearance' | 'disabledServices' | 'disabledForms'>>`。
- `api` 物件加：
```ts
  getTenantServices: (id: string) =>
    req<TenantServiceCatalog>('GET', `/admin/tenants/${id}/services`),
```

- [ ] **Step 2: 型別檢查**
Run: `cd admin && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add admin/src/api.ts
git commit -m "feat(admin-ui): 服務 catalog API client + tenant 停用欄位型別

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Admin UI 「服務」tab

**Files:**
- Create: `admin/src/pages/tabs/ServicesTab.tsx`
- Modify: `admin/src/pages/TenantDetailPage.tsx`

**Interfaces:**
- Consumes: `api.getTenantServices`、`api.updateTenant`、`TenantServiceCatalog`（Task 5）。
- Produces: `ServicesTab({ tenantId, onError }: { tenantId: string; onError: (e: unknown) => void })`。

- [ ] **Step 1: 建 ServicesTab**
`admin/src/pages/tabs/ServicesTab.tsx`：
```tsx
import { useCallback, useEffect, useState } from 'react';
import { api, type TenantServiceCatalog } from '../../api';

export default function ServicesTab({
  tenantId,
  onError,
}: {
  tenantId: string;
  onError: (e: unknown) => void;
}) {
  const [cat, setCat] = useState<TenantServiceCatalog | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCat(await api.getTenantServices(tenantId));
    } catch (e) {
      onError(e);
    }
  }, [tenantId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleService = (id: string) =>
    setCat((c) =>
      c ? { ...c, services: c.services.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) } : c,
    );
  const toggleForm = (formId: string) =>
    setCat((c) =>
      c ? { ...c, forms: c.forms.map((f) => (f.formId === formId ? { ...f, enabled: !f.enabled } : f)) } : c,
    );

  const save = async () => {
    if (!cat) return;
    setSaving(true);
    try {
      await api.updateTenant(tenantId, {
        disabledServices: cat.services.filter((s) => !s.enabled).map((s) => s.id),
        disabledForms: cat.forms.filter((f) => !f.enabled).map((f) => f.formId),
      });
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  if (!cat) return <div className="card"><div className="card-body">載入中…</div></div>;
  const noService = cat.services.every((s) => !s.enabled);
  const noForm = cat.forms.every((f) => !f.enabled);

  return (
    <div className="appearance-grid">
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Agent 服務</div>
            <div className="card-desc">取消勾選即停用該類服務；預設全開。</div>
          </div>
        </div>
        <ul className="list">
          {cat.services.map((s) => (
            <li key={s.id} className="row">
              <div className="row-main">
                <div className="row-title">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={s.enabled} onChange={() => toggleService(s.id)} />
                    <span style={{ fontWeight: 500 }}>{s.label}</span>
                  </label>
                </div>
                <div className="row-sub">{s.id}</div>
              </div>
            </li>
          ))}
        </ul>
        {noService && <div className="card-body row-sub">⚠️ 已停用全部服務，此租戶對話將無可用功能。</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">可用表單</div>
            <div className="card-desc">控制此租戶可申請哪些表單。</div>
          </div>
        </div>
        <ul className="list">
          {cat.forms.map((f) => (
            <li key={f.formId} className="row">
              <div className="row-main">
                <div className="row-title">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={f.enabled} onChange={() => toggleForm(f.formId)} />
                    <span style={{ fontWeight: 500 }}>{f.title}</span>
                  </label>
                </div>
                <div className="row-sub">{f.formId}</div>
              </div>
            </li>
          ))}
          {cat.forms.length === 0 && <li className="empty">尚無表單。</li>}
        </ul>
        {noForm && cat.forms.length > 0 && (
          <div className="card-body row-sub">⚠️ 已停用全部表單，填表功能將無法選到表單。</div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          儲存
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 掛入 TenantDetailPage**
`admin/src/pages/TenantDetailPage.tsx`：
- import：`import ServicesTab from './tabs/ServicesTab';`
- `type TabKey` 末端加 `| 'services'`
- `TABS` 陣列加（放 forms 後）：`{ key: 'services', label: '服務' }`
- render 區加：`{tab === 'services' && <ServicesTab tenantId={tenant.id} onError={handleErr} />}`

- [ ] **Step 3: 型別檢查 + build**
Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add admin/src/pages/tabs/ServicesTab.tsx admin/src/pages/TenantDetailPage.tsx
git commit -m "feat(admin-ui): 服務 tab（Agent 服務 / 可用表單 開關）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 端到端驗證

**Files:** 無（驗證）

- [ ] **Step 1: 全套**
Run: `cd server && npm run typecheck && npm test && npm run lint`
Expected: 全 PASS
Run: `cd admin && npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 2: 手動**
```
啟動 server + admin → 登入 → 選租戶 → 「服務」tab
取消勾「知識庫問答」→ 儲存 → 該租戶對話問知識問題不再路由到 knowledge
取消勾某表單 → 儲存 → 該表單不再出現在「有哪些表單可申請」、也不被路由
```

- [ ] **Step 3: 最終 commit（若有微調）**
```bash
git add -A && git commit -m "chore(tenant): 服務開關端到端驗證修整"
```

---

## Self-Review 註記

- Spec 各節皆有對應 task：資料模型(T1)、服務 label+enabledFor+路由(T2)、listEnabledForms+表單過濾(T3)、catalog 端點+PATCH(T4)、前端 client(T5)、UI tab(T6)、測試(各 task)、邊界退回(T3 pickFormId 全停用退回、T6 UI 警告)。
- 型別一致：`Tenant.disabledServices/disabledForms`(T1) → T2/T3/T4/T5 使用；`AgentService.label`(T2) → T4 catalog 使用；`enabledFor`(T2)、`listEnabledForms`(T3) → 路由使用；`TenantServiceCatalog`(T5) → T6 使用。
- catalog controller 置於 admin 模組（跨模組彙整），與既有 admin controller 一致；未放 tenant 模組以避免 tenant→conversation 依賴倒置（spec 原提 tenant 模組，此為實作上的合理調整）。
