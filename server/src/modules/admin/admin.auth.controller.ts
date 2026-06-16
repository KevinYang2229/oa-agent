/**
 * 後台登入：以單一管理密碼換發 admin JWT。
 * 安全預設：ADMIN_PASSWORD 未設時停用（回 403），避免空密碼即可登入。
 */
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '@/config/env';
import { AppError } from '@/utils/app-error';
import { signAdminToken } from '@/utils/jwt';
import type { AdminLoginInput } from './admin.schema';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const adminAuthController = {
  async login(req: Request, res: Response): Promise<void> {
    if (!env.ADMIN_PASSWORD) {
      throw AppError.forbidden('後台登入未啟用（未設定 ADMIN_PASSWORD）');
    }
    const { password } = req.body as AdminLoginInput;
    if (!safeEqual(password, env.ADMIN_PASSWORD)) {
      throw AppError.unauthorized('密碼錯誤');
    }
    res.status(200).json({ data: { token: signAdminToken() } });
  },
};
