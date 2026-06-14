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

export interface OASubmitResult {
  oaRequestId: string;
  status: 'accepted' | 'pending' | 'rejected';
  raw?: unknown;
}

export interface OAConnector {
  readonly name: string;
  submitLeaveRequest(payload: LeaveRequestPayload): Promise<OASubmitResult>;
  getLeaveBalance?(userId: string): Promise<LeaveBalance[]>;
}
