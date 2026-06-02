import type { Request, Response } from 'express';
import { authService } from './auth.service';
import type { LoginInput, RefreshInput } from './auth.schema';

export const authController = {
  // 公開：帳密登入 → access/refresh + 使用者資料
  async login(req: Request, res: Response): Promise<void> {
    const { userId, password } = req.body as LoginInput;
    const result = authService.login(userId, password);
    res.status(200).json({ data: result });
  },

  // 公開：以 refresh token 換發新 token（輪替）
  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;
    const tokens = authService.refresh(refreshToken);
    res.status(200).json({ data: tokens });
  },

  // 受保護：回目前登入者資料（前端重整時還原登入狀態）
  async me(req: Request, res: Response): Promise<void> {
    const userId = req.user?.sub ?? '';
    res.status(200).json({ data: authService.me(userId) });
  },
};
