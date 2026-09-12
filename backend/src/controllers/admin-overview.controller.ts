import type { Request, Response } from 'express';
import { getAdminOverview } from '../services/admin-overview.service';

export async function getAdminOverviewController(_req: Request, res: Response) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, item: await getAdminOverview() });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '관리자 현황을 불러오지 못했습니다.' });
  }
}
