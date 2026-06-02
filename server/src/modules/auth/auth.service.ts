/**
 * 認證 service（MVP）：固定 dev 密碼驗證 + 簽發 access/refresh token。
 *
 * 驗證邏輯刻意獨立成一段（verifyCredentials），之後接真實使用者/密碼來源
 * （DB、SSO、LDAP…）只要換掉這段，token 簽發與 refresh 流程不動。
 */
import type { Applicant } from '@oa-agent/shared';
import { env } from '@/config/env';
import { getApplicant, isKnownUser } from '@/modules/user/user.directory';
import { AppError } from '@/utils/app-error';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from '@/utils/jwt';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: Applicant;
}

function issueTokens(payload: JwtPayload): AuthTokens {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export const authService = {
  /** 帳密驗證 → 簽發 access/refresh token 與使用者資料 */
  login(userId: string, password: string): LoginResult {
    // MVP：已知帳號 + 固定 dev 密碼。錯誤訊息不分帳號/密碼以免帳號列舉。
    if (!isKnownUser(userId) || password !== env.AUTH_DEV_PASSWORD) {
      throw AppError.unauthorized('帳號或密碼錯誤');
    }
    const payload: JwtPayload = { sub: userId, role: 'employee' };
    return { ...issueTokens(payload), user: getApplicant(userId) };
  },

  /** 用 refresh token 換新的 access/refresh（輪替） */
  refresh(refreshToken: string): AuthTokens {
    let payload: JwtPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }
    // 重新簽發前確認帳號仍有效
    if (!isKnownUser(payload.sub)) throw AppError.unauthorized('Unknown user');
    return issueTokens({ sub: payload.sub, role: payload.role });
  },

  /** 取目前登入者資料（requireAuth 後使用） */
  me(userId: string): Applicant {
    return getApplicant(userId);
  },
};
