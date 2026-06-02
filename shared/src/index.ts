/**
 * 前後端共用型別（single source of truth）。
 *
 * - 六層 Form Definition 的型別（canonical = schemas/<formId>/*.json）
 * - 對話 API 的 DTO 型別片段（SessionStatus / SubmissionInfo）
 *
 * server 透過 form.types / conversation.types 再匯出；client 直接 import。
 */

// ---- ① Data Schema（標準 JSON Schema 子集）----
export interface JsonSchemaProperty {
  type: string;
  enum?: (string | number)[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  description?: string;
  items?: JsonSchemaProperty;
}

export interface DataSchema {
  $schema?: string;
  formId?: string;
  title?: string;
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean;
}

// ---- ② Field Schema（UI 元件 + 語意 metadata）----
export type FieldComponent =
  | 'Input'
  | 'Textarea'
  | 'Number'
  | 'Select'
  | 'DatePicker'
  | 'TimePicker'
  | 'Upload'
  | 'Checkbox';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  component: FieldComponent;
  label: string;
  placeholder?: string;
  options?: FieldOption[];
  help?: string;
}

export type FieldSchema = Record<string, FieldSpec>;

// ---- ③ Layout Schema（optional seam，MVP 不渲染）----
export interface LayoutSection {
  title?: string;
  fields: string[][];
}
export interface LayoutSchema {
  sections: LayoutSection[];
}

// ---- ④ Validation Schema（必填 + 跨欄商規）----
export type RuleOp = '>=' | '>' | '<=' | '<' | '==' | '!=';
export interface BusinessRule {
  id: string;
  type: 'compareField';
  field: string;
  op: RuleOp;
  other: string;
  message: string;
}
export interface ValidationSchema {
  required: string[];
  rules?: BusinessRule[];
}

// ---- ⑤ Workflow Schema（optional seam，MVP 不執行）----
export interface WorkflowStep {
  type: string;
  name?: string;
  assigneeId?: string;
}
export interface WorkflowSchema {
  steps: WorkflowStep[];
}

// ---- ⑥ Agent Schema（對話蒐集策略）----
export interface AgentSchema {
  intent: string;
  description: string;
  examples?: string[];
  askOrder?: string[];
  fieldGuidance?: Record<string, string>;
  confirmationTemplate?: string;
}

// ---- 組合：一份 Definition ----
export interface Definition {
  formId: string;
  data: DataSchema;
  field: FieldSchema;
  layout?: LayoutSchema;
  validation: ValidationSchema;
  workflow?: WorkflowSchema;
  agent: AgentSchema;
}

// ---- slot-filling 用的衍生型別 ----
export type FormValues = Record<string, unknown>;

export interface FieldIssue {
  field: string;
  message: string;
}

export interface SlotStatus {
  /** 已填且有效的欄位 */
  filled: string[];
  /** 必填但尚未填 */
  missing: string[];
  /** 已填但驗證失敗（欄位級或跨欄商規） */
  invalid: FieldIssue[];
  /** 無 missing、無 invalid */
  isComplete: boolean;
}

// ---- 對話 API 共用 DTO 片段 ----
export type SessionStatus =
  | 'collecting'
  | 'confirming'
  | 'submitting'
  | 'submitted'
  | 'cancelled'
  | 'failed';

/** 單一簽核關卡狀態（由 workflow.steps 衍生） */
export interface ApprovalStep {
  /** 關卡名稱（取自 workflow step.name，缺省用 type） */
  name: string;
  /** 關卡類型（manager / hr …） */
  type: string;
  status: 'current' | 'pending' | 'approved' | 'rejected';
}

export interface SubmissionInfo {
  oaRequestId: string;
  status: string;
  /** 送出時間（ISO）；用於計算/查詢簽核進度 */
  submittedAt?: string;
  /** 簽核進度（依表單 workflow.steps 產生）；無 workflow 則不帶 */
  approvals?: ApprovalStep[];
}

/** 申請人（目前使用者）資訊，由後端使用者目錄解析 */
export interface Applicant {
  /** 帳號（userId） */
  id: string;
  name: string;
  department: string;
  title?: string;
}

/** 假別剩餘時數（由 OA 連接器提供） */
export interface LeaveBalance {
  leaveType: string;
  remainingHours: number;
}
