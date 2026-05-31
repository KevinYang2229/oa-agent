/**
 * OA 連接器抽象。真 OA API 規格未定，先以 stub 實作；介面固定，之後抽換真連接器不動上層。
 */

export interface LeaveRequestPayload {
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface OASubmitResult {
  oaRequestId: string;
  status: 'accepted' | 'pending' | 'rejected';
  raw?: unknown;
}

export interface LeaveBalance {
  leaveType: string;
  remainingHours: number;
}

export interface OAConnector {
  readonly name: string;
  submitLeaveRequest(payload: LeaveRequestPayload): Promise<OASubmitResult>;
  getLeaveBalance?(userId: string): Promise<LeaveBalance[]>;
}
