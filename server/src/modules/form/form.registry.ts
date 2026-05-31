/**
 * Definition registry：formId → Definition 的記憶體快取（lazy load）。
 *
 * 新增一張表單 = 在 schemas/ 加一個資料夾，無需改編排層。
 */
import { AppError } from '@/utils/app-error';
import type { Definition } from './form.types';
import { listDefinitionDirs, loadDefinitionFromDir } from './form.loader';

const registry = new Map<string, Definition>();
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  for (const formId of listDefinitionDirs()) {
    registry.set(formId, loadDefinitionFromDir(formId));
  }
  loaded = true;
}

export function getDefinition(formId: string): Definition {
  ensureLoaded();
  const def = registry.get(formId);
  if (!def) throw AppError.notFound(`Unknown form: ${formId}`);
  return def;
}

export function tryGetDefinition(formId: string): Definition | undefined {
  ensureLoaded();
  return registry.get(formId);
}

export function listDefinitions(): Definition[] {
  ensureLoaded();
  return [...registry.values()];
}
