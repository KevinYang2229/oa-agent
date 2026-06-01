/**
 * Mock 使用者目錄（MVP）：以 userId 對應姓名 / 部門 / 職稱。
 * 之後接真實 HR / OA 來源時，只要換這層實作，getApplicant 介面不變。
 */
import type { Applicant } from '@oa-agent/shared';

const DIRECTORY: Record<string, Omit<Applicant, 'id'>> = {
  kevin: { name: 'Kevin Yang', department: '資訊部', title: '前端工程師' },
  alice: { name: 'Alice Chen', department: '人資部', title: '人資專員' },
  bob: { name: 'Bob Lin', department: '業務部', title: '業務經理' },
};

/** 取申請人 profile；未知帳號回退為「以 userId 當顯示名、部門未知」 */
export function getApplicant(userId: string): Applicant {
  const profile = DIRECTORY[userId];
  return profile
    ? { id: userId, ...profile }
    : { id: userId, name: userId, department: '—' };
}
