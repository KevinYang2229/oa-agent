/**
 * requireAuth：驗證 Authorization: Bearer <accessToken>，通過後把 payload 掛到 req.user。
 * 未帶或無效（含過期）一律 401，由前端以 refresh token 續期或導回登入。
 */
import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '@/utils/jwt';
import { AppError } from '@/utils/app-error';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw AppError.unauthorized('Invalid or expired access token');
  }
}
