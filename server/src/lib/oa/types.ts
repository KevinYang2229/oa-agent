/**
 * OA 連接器抽象。真 OA API 規格未定，先以 stub 實作；介面固定，之後抽換真連接器不動上層。
 */

import type { Attachment, LeaveBalance } from '@oa-agent/shared';

export type { Attachment, LeaveBalance };

export interface LeaveRequestPayload {
  userId: string;
  /** 是否代人申請 */
  onBehalf?: boolean;
  /** 申請人，格式：姓名(工號) */
  applicant: string;
  /** 職務代理人，格式：姓名(工號) */
  deputy: string;
  /** 同時代理所有表單 */
  deputyAllForms?: boolean;
  leaveType: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  /** 換算後的請假時數（依申請人地區工時政策計算） */
  hours?: number;
  /** 申請人所屬地區（決定工時政策） */
  region?: string;
  /** 附件 metadata（證明文件等）；檔案內容由附件儲存區以 id 保管 */
  attachments?: Attachment[];
}

export interface OutingRegistrationPayload {
  userId: string;
  /** 是否代人登記 */
  onBehalf?: boolean;
  /** 外出人，格式：姓名(工號) */
  applicant: string;
  /** 外出主題 */
  subject: string;
  /** 出發地點 */
  fromLocation: string;
  /** 目的地 */
  toLocation: string;
  departDate: string;
  departTime: string;
  returnDate: string;
  returnTime: string;
  /** 是否需報銷（yes / no） */
  needReimbursement: string;
  /** 需通知人員（選填） */
  notifyPersons?: string;
  /** 備註（選填） */
  remark?: string;
}

export interface OASubmitResult {
  oaRequestId: string;
  status: 'accepted' | 'pending' | 'rejected';
  raw?: unknown;
}

export interface OAConnector {
  readonly name: string;
  submitLeaveRequest(payload: LeaveRequestPayload): Promise<OASubmitResult>;
  submitOutingRegistration(payload: OutingRegistrationPayload): Promise<OASubmitResult>;
  getLeaveBalance?(userId: string): Promise<LeaveBalance[]>;
}
