/**
 * requireAdmin：保護管理 API。驗證 x-admin-key header 是否等於 env.ADMIN_API_KEY。
 *
 * 安全預設：ADMIN_API_KEY 留空時，管理 API 一律 403（停用），避免未設定密鑰就對外開放。
 */
import type { NextFunction, Request, Response } from 'express';
import { env } from '@/config/env';
import { AppError } from '@/utils/app-error';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!env.ADMIN_API_KEY) {
    throw AppError.forbidden('管理 API 未啟用（未設定 ADMIN_API_KEY）');
  }
  const key = req.header('x-admin-key');
  if (key !== env.ADMIN_API_KEY) {
    throw AppError.unauthorized('管理金鑰無效');
  }
  next();
}
