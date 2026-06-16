import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';

export interface JwtPayload {
  sub: string;
  role: string;
  /** 簽發來源：password＝內部帳密登入；sso＝租戶 SSO handoff。影響 refresh 時是否查內部名錄 */
  via?: 'password' | 'sso';
  /** SSO 簽發時帶入的所屬租戶 */
  tenantId?: string;
  /** SSO 簽發時帶入的終端使用者顯示名（終端使用者不在內部名錄） */
  name?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
