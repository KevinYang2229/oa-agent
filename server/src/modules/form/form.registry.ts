/**
 * Definition 解析器：租戶覆寫優先、內建 base 後備。
 *
 * - base：schemas/ 目錄的內建共用表單（lazy load + 記憶體快取）
 * - override：租戶於 Designer 自建/覆寫的表單（form.store，記憶體 Map，即時讀取）
 *
 * 解析優先序：租戶 override > base。store 為記憶體即時讀取，存檔後 Renderer 立即生效，無需重啟。
 */
import { AppError } from '@/utils/app-error';
import { listDefinitionDirs, loadDefinitionFromDir } from './form.loader';
import { formStore } from './form.store';
import type { Definition } from './form.types';

// ---- base（schemas/ 內建表單）lazy cache ----
const baseRegistry = new Map<string, Definition>();
let baseLoaded = false;

function ensureBaseLoaded(): void {
  if (baseLoaded) return;
  for (const formId of listDefinitionDirs()) {
    baseRegistry.set(formId, loadDefinitionFromDir(formId));
  }
  baseLoaded = true;
}

/** 內建 base 定義；無則 undefined */
export function getBaseDefinition(formId: string): Definition | undefined {
  ensureBaseLoaded();
  return baseRegistry.get(formId);
}

// ---- 租戶感知解析 ----

/** 解析某租戶的表單定義：租戶覆寫優先，否則用 base；皆無則 404。 */
export function getDefinition(tenantId: string, formId: string): Definition {
  const def = formStore.getOverride(tenantId, formId) ?? getBaseDefinition(formId);
  if (!def) throw AppError.notFound(`Unknown form: ${formId}`);
  return def;
}

/** 同 getDefinition 但查無回 undefined（不擲錯）。 */
export function tryGetDefinition(tenantId: string, formId: string): Definition | undefined {
  return formStore.getOverride(tenantId, formId) ?? getBaseDefinition(formId);
}

/** 列出某租戶可見的所有表單：base 為底，租戶覆寫同 formId 則 shadow、新增則 append。 */
export function listDefinitions(tenantId: string): Definition[] {
  ensureBaseLoaded();
  const merged = new Map<string, Definition>(baseRegistry);
  for (const def of formStore.listOverrides(tenantId)) {
    merged.set(def.formId, def);
  }
  return [...merged.values()];
}
