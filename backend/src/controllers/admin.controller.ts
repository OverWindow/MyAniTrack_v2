import type { Request, Response } from 'express';
import { rebuildAnimeSeries, validateAnimeSeriesRebuildScope } from '../services/admin-anime-series.service';
import { updateAnimeKoreanTitleByAdmin } from '../services/admin-korean-title.service';
import { getAdminUserById, getAdminUsers } from '../services/admin-user.service';

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message.includes('must be') || message.includes('required') ? 400
    : message.includes('not found') ? 404
      : message === 'Admin access required' ? 403
        : message.includes('already running') ? 409 : 500;
  if (status === 500) console.error(error);
  return res.status(status).json({ success: false, message });
}

function admin(req: Request) {
  if (!req.authUser || req.authUser.role !== 'ADMIN') throw new Error('Admin access required');
  return req.authUser;
}

function positiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

export async function rebuildAnimeSeriesController(req: Request, res: Response) {
  try {
    admin(req);
    const result = await rebuildAnimeSeries(validateAnimeSeriesRebuildScope(req.body?.scope));
    return res.json({ success: true, message: 'Anime series rebuild completed', result });
  } catch (error) { return sendError(res, error); }
}

export async function getAdminUsersController(req: Request, res: Response) {
  try {
    admin(req);
    const result = await getAdminUsers({ page: req.query.page, limit: req.query.limit, search: req.query.search, role: req.query.role });
    return res.json({ success: true, ...result });
  } catch (error) { return sendError(res, error); }
}

export async function getAdminUserController(req: Request, res: Response) {
  try {
    admin(req);
    return res.json({ success: true, item: await getAdminUserById(positiveInteger(req.params.userId, 'userId')) });
  } catch (error) { return sendError(res, error); }
}

export async function updateAnimeKoreanTitleController(req: Request, res: Response) {
  try {
    const actor = admin(req);
    const item = await updateAnimeKoreanTitleByAdmin(actor.userId, positiveInteger(req.params.animeId, 'animeId'), {
      title: req.body.title, subtitle: req.body.subtitle,
    });
    return res.json({ success: true, message: 'Anime Korean title updated and locked', item });
  } catch (error) { return sendError(res, error); }
}
