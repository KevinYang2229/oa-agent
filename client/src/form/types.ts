import type { ReactElement } from 'react';
import type { FieldSpec } from '@oa-agent/shared';

/** registry 內每個欄位 renderer 收到的統一 props */
export interface FieldControlProps {
  spec: FieldSpec;
  /** 一律以字串傳遞（送出前由 form.engine coerce 回正確型別） */
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export type FieldRenderer = (props: FieldControlProps) => ReactElement;
