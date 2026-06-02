/**
 * Mock 使用者目錄（MVP）：以 userId 對應姓名 / 部門 / 職稱。
 * 之後接真實 HR / OA 來源時，只要換這層實作，getApplicant 介面不變。
 */
import type { Applicant } from "@oa-agent/shared";

const DIRECTORY: Record<string, Omit<Applicant, "id">> = {
  kevin: { name: "Kevin Yang", department: "行銷部", title: "技術經理" },
  hyweb: { name: "Eason Hsieh", department: "行銷部", title: "處長" },
};

/** 取申請人 profile；未知帳號回退為「以 userId 當顯示名、部門未知」 */
export function getApplicant(userId: string): Applicant {
  const profile = DIRECTORY[userId];
  return profile
    ? { id: userId, ...profile }
    : { id: userId, name: userId, department: "—" };
}

/** 是否為目錄中的已知帳號（登入時用，未知帳號不可登入） */
export function isKnownUser(userId: string): boolean {
  return Object.prototype.hasOwnProperty.call(DIRECTORY, userId);
}

/** 已知帳號清單（登入頁提示用） */
export function listUserIds(): string[] {
  return Object.keys(DIRECTORY);
}
