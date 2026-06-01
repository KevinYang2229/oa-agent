/**
 * 欄位元件註冊表（schema-driven renderer 的接縫）。
 *
 * schema 的 field.component（'Select' / 'DatePicker'…）在此對應到 @oa-agent/ui 的設計系統元件。
 * 要新增/替換元件：在這裡 import，寫一個把 FieldControlProps 轉成該元件 props 的 adapter，
 * 再加進 fieldRegistry。FormView 只查表，不需改動。
 */
import { Checkbox, DatePicker, Input, Select, Textarea } from '@oa-agent/ui';
import type { FieldComponent } from '@oa-agent/shared';
import i18n from '../i18n';
import type { FieldRenderer } from './types';

// ---- adapters：schema 欄位 → 設計系統元件 ----
const renderSelect: FieldRenderer = ({ spec, value, disabled, onChange }) => (
  <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
    <option value="">{i18n.t('form.selectPlaceholder')}</option>
    {spec.options?.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </Select>
);

const renderTextarea: FieldRenderer = ({ spec, value, disabled, onChange }) => (
  <Textarea
    value={value}
    rows={3}
    placeholder={spec.placeholder}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  />
);

const renderDate: FieldRenderer = ({ spec, value, disabled, onChange }) => (
  <DatePicker value={value} placeholder={spec.placeholder} disabled={disabled} onChange={onChange} />
);

// 布林欄位：value 以 'true' / 'false' 字串往返（送出前由 form.engine coerce 回 boolean）
const renderCheckbox: FieldRenderer = ({ spec, value, disabled, onChange }) => (
  <Checkbox
    label={spec.label}
    checked={value === 'true'}
    disabled={disabled}
    onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
  />
);

const makeInput =
  (type: 'text' | 'number' | 'time'): FieldRenderer =>
  ({ spec, value, disabled, onChange }) => (
    <Input
      type={type}
      value={value}
      placeholder={spec.placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );

/** field.component → renderer。未列出的型別走 fallback（純文字輸入）。 */
export const fieldRegistry: Partial<Record<FieldComponent, FieldRenderer>> = {
  Select: renderSelect,
  Textarea: renderTextarea,
  DatePicker: renderDate,
  Input: makeInput('text'),
  Number: makeInput('number'),
  TimePicker: makeInput('time'),
  Checkbox: renderCheckbox,
};

const fallback = makeInput('text');

export function resolveFieldRenderer(component: FieldComponent): FieldRenderer {
  return fieldRegistry[component] ?? fallback;
}
