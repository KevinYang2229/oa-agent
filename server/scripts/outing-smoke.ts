/* 離線驗證外出登記 schema + 引擎 + 工具閘控（不需 API key）。執行：npx tsx scripts/outing-smoke.ts */
import { computeStatus, setField, validateAll } from '../src/modules/form/form.engine';
import { getDefinition, listDefinitions } from '../src/modules/form/form.registry';
import { buildTools } from '../src/modules/form/form.tools';
import type { FormValues } from '../src/modules/form/form.types';

let failures = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failures += 1;
}

// 0. 兩張表單都註冊
const ids = listDefinitions('default').map((d) => d.formId).sort();
check(`registry 含 leave-request 與 outing-registration（${ids.join(', ')}）`,
  ids.includes('leave-request') && ids.includes('outing-registration'));

const def = getDefinition('default', 'outing-registration');

// 1. required 欄位都存在於 data.properties
check('required 欄位皆有對應 property',
  def.validation.required.every((f) => f in def.data.properties));

// 2. 每個 required 欄位都有 field spec（label/component）
check('required 欄位皆有 field spec',
  def.validation.required.every((f) => !!def.field[f]));

// 3. 空表單未完成、必填皆 missing
const s0 = computeStatus(def, {});
check('空表單未完成', s0.isComplete === false);
check('空表單 missing 含 subject/fromLocation/needReimbursement',
  ['subject', 'fromLocation', 'needReimbursement'].every((f) => s0.missing.includes(f)));

// 4. needReimbursement 只接受 yes/no
let values: FormValues = {};
check('needReimbursement=maybe 被拒', !!setField(def, values, 'needReimbursement', 'maybe').issue);
const rNeed = setField(def, values, 'needReimbursement', 'yes');
check('needReimbursement=yes 有效', !rNeed.issue);

// 5. 走完 happy path → isComplete、validateAll 無 issue
const happy: Record<string, string> = {
  applicant: '楊明倫(EF002)',
  subject: '產品演示會議',
  fromLocation: '台北辦公室',
  toLocation: '台中軟體園區',
  departDate: '2026-06-20',
  departTime: '08:00',
  returnDate: '2026-06-20',
  returnTime: '18:00',
  needReimbursement: 'yes',
};
values = {};
for (const [k, v] of Object.entries(happy)) {
  const r = setField(def, values, k, v);
  if (r.issue) console.log(`   setField ${k} issue:`, r.issue.message);
  values = r.values;
}
check('happy path 完整', computeStatus(def, values).isComplete === true);
check('happy path validateAll 無 issue', validateAll(def, values).length === 0);

// 6. returnAfterDepart 商規：返回早於外出 → invalid
const bad = setField(def, values, 'returnDate', '2026-06-19');
const sBad = computeStatus(def, bad.values);
check('返回日期早於外出 → invalid 觸發', sBad.invalid.some((i) => i.field === 'returnDate'));

// 7. 工具閘控：外出登記只有 fill_fields + submit（無 leave 專屬工具）
const outingTools = buildTools(def).map((t) => t.name).sort();
check(`外出工具僅 fill_fields/submit（${outingTools.join(', ')}）`,
  outingTools.length === 2 && outingTools.includes('fill_fields') && outingTools.includes('submit'));

// 8. 請假仍保有 leave 專屬工具（回歸）
const leaveTools = buildTools(getDefinition('default', 'leave-request')).map((t) => t.name);
check('請假含 get_leave_balances / find_deputy_candidates / compute_leave_hours',
  ['get_leave_balances', 'find_deputy_candidates', 'compute_leave_hours'].every((n) => leaveTools.includes(n)));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
