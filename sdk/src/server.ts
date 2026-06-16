/**
 * @oa-agent/sdk/server — 伺服器端 SSO 工具（給「整合方後端」用）。
 *
 * 用途：整合方在自己的後端，於使用者登入後，用該租戶的 ssoSecret 簽一張「終端使用者 token」，
 * 交給前端塞進 OA widget（data-user-token）。OA Agent 收到後驗章換發本系統 token，達成免登入。
 *
 * 注意：依賴 jsonwebtoken，僅供 Node 端使用；瀏覽器端請用主入口 createOAAgent。
 * ssoSecret 是後端機密，切勿外洩到前端。
 */
import jwt, { type SignOptions } from 'jsonwebtoken';

export interface UserTokenClaims {
  /** 終端使用者在宿主系統的唯一識別（工號 / 帳號） */
  sub: string;
  /** 顯示名稱（選填） */
  name?: string;
  /** 角色（選填；省略時 OA 端預設為 employee） */
  role?: string;
}

export interface SignUserTokenOptions extends UserTokenClaims {
  /** 該租戶的 ssoSecret（建租戶時設定，須留在後端） */
  secret: string;
  /** 有效期，預設 '5m'（建議短效，因為會出現在前端） */
  expiresIn?: SignOptions['expiresIn'];
}

/**
 * 用租戶 ssoSecret 簽一張 OA Agent SSO user token。
 * 回傳的字串交給前端，作為 widget 的 data-user-token 或 SDK 的 userToken。
 */
export function signUserToken(opts: SignUserTokenOptions): string {
  const { secret, sub, name, role, expiresIn = '5m' } = opts;
  if (!secret) throw new Error('signUserToken: secret（租戶 ssoSecret）為必填');
  if (!sub) throw new Error('signUserToken: sub（使用者識別）為必填');
  const claims: UserTokenClaims = { sub };
  if (name !== undefined) claims.name = name;
  if (role !== undefined) claims.role = role;
  return jwt.sign(claims, secret, { expiresIn });
}

/**
 * 驗證一張 user token（測試 / 除錯用；正式環境的驗章由 OA Agent 後端負責）。
 * 失敗會丟出 jsonwebtoken 的錯誤。
 */
export function verifyUserToken(token: string, secret: string): UserTokenClaims {
  return jwt.verify(token, secret) as UserTokenClaims;
}
