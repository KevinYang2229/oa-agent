/* 離線驗證 schema-driven 引擎（不需 API key）。執行：npx tsx scripts/engine-smoke.ts */
import { computeStatus, setField, validateAll } from '../src/modules/form/form.engine';
import { getDefinition } from '../src/modules/form/form.registry';
import type { FormValues } from '../src/modules/form/form.types';

let failures = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failures += 1;
}

const def = getDefinition('leave-request');
let values: FormValues = {};

// 1. 空表單：四個必填皆 missing
const s0 = computeStatus(def, values);
check('空表單 missing 含 leaveType/startDate/endDate/reason',
  ['leaveType', 'startDate', 'endDate', 'reason'].every((f) => s0.missing.includes(f)));
check('空表單未完成', s0.isComplete === false);

// 2. 設定有效假別
const r1 = setField(def, values, 'leaveType', 'annual');
check('leaveType=annual 有效', !r1.issue);
values = r1.values;

// 3. 設定無效假別 → 回 issue、值不變
const r2 = setField(def, values, 'leaveType', 'not-a-type');
check('leaveType=not-a-type 被拒', !!r2.issue);

// 4. 跨欄商規：endDate < startDate 觸發 invalid
values = setField(def, values, 'startDate', '2026-06-02').values;
values = setField(def, values, 'endDate', '2026-06-01').values;
const s1 = computeStatus(def, values);
check('endDate<startDate 觸發商規 invalid',
  s1.invalid.some((i) => i.message.includes('結束日期不可早於開始日期')));

// 5. 修正日期 + 補齊其餘必填（applicant/deputy/起訖時間/事由）→ 完整
values = setField(def, values, 'endDate', '2026-06-03').values;
values = setField(def, values, 'applicant', '王小明').values;
values = setField(def, values, 'deputy', '李小華').values;
values = setField(def, values, 'startTime', '09:00').values;
values = setField(def, values, 'endTime', '18:00').values;
values = setField(def, values, 'reason', '家裡有事').values;
const s2 = computeStatus(def, values);
check('補齊後 isComplete=true', s2.isComplete === true);
check('validateAll 無錯誤', validateAll(def, values).length === 0);

console.log(`\n最終 values: ${JSON.stringify(values)}`);
console.log(failures === 0 ? '\n全部通過 ✅' : `\n${failures} 項失敗 ❌`);
process.exit(failures === 0 ? 0 : 1);
