/**
 * 從 schemas/<formId>/ 載入六層 JSON 並組成 Definition。
 *
 * MVP：直接讀檔（registry 內快取）。之後改接 Prisma FormDefinition 表只要換這層。
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentSchema,
  DataSchema,
  Definition,
  FieldSchema,
  LayoutSchema,
  ValidationSchema,
  WorkflowSchema,
} from './form.types';

// __dirname：dev(tsx)=server/src/modules/form、build=server/dist/modules/form
// 兩者上溯四層皆為 monorepo 根；schemas/ 為前後端共用、置於根
const SCHEMAS_DIR = path.resolve(__dirname, '../../../../schemas');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

export function loadDefinitionFromDir(formId: string): Definition {
  const dir = path.join(SCHEMAS_DIR, formId);
  return {
    formId,
    data: readJson<DataSchema>(path.join(dir, 'data.schema.json')),
    field: readJson<FieldSchema>(path.join(dir, 'field.schema.json')),
    layout: readJson<LayoutSchema>(path.join(dir, 'layout.schema.json')),
    validation: readJson<ValidationSchema>(path.join(dir, 'validation.schema.json')),
    workflow: readJson<WorkflowSchema>(path.join(dir, 'workflow.schema.json')),
    agent: readJson<AgentSchema>(path.join(dir, 'agent.schema.json')),
  };
}

export function listDefinitionDirs(): string[] {
  return fs
    .readdirSync(SCHEMAS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
