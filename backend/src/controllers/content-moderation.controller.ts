import { Request, Response } from 'express';
import {
  blockUser,
  createProfileReport,
  listBlockedUsers,
  listPendingProfileReports,
  ProfileReportAction,
  resolveProfileReport,
  setAnimeVisibilityOverride,
  unblockUser,
} from '../services/content-moderation.service';

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message.includes('not found')) return 404;
  if (message.includes('rate limit')) return 429;
  if (message.includes('already resolved')) return 409;
  if (message.includes('yourself') || message.includes('Invalid') || message.includes('must be')) return 400;
  return 500;
}
export async function setAnimeVisibilityController(req: Request, res: Response) {
  try {
    await setAnimeVisibilityOverride(Number(req.params.animeId), req.body.visible, req.body.reason);
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
}
function fail(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return res.status(statusFor(error)).json({ success: false, message });
}
function target(req: Request) { return Number(req.params.userId); }

export async function reportProfileController(req: Request, res: Response) {
  try {
    const report = await createProfileReport(req.authUser!.userId, target(req), req.body.reason);
    return res.status(report.merged ? 200 : 201).json({ success: true, report });
  } catch (error) { return fail(res, error); }
}
export async function blockUserController(req: Request, res: Response) {
  try { await blockUser(req.authUser!.userId, target(req)); return res.json({ success: true }); }
  catch (error) { return fail(res, error); }
}
export async function unblockUserController(req: Request, res: Response) {
  try { await unblockUser(req.authUser!.userId, target(req)); return res.json({ success: true }); }
  catch (error) { return fail(res, error); }
}
export async function listBlockedUsersController(req: Request, res: Response) {
  try { return res.json({ success: true, users: await listBlockedUsers(req.authUser!.userId) }); }
  catch (error) { return fail(res, error); }
}
export async function listProfileReportsController(_req: Request, res: Response) {
  try { return res.json({ success: true, reports: await listPendingProfileReports() }); }
  catch (error) { return fail(res, error); }
}
export async function resolveProfileReportController(req: Request, res: Response) {
  try {
    await resolveProfileReport(Number(req.params.reportId), req.authUser!.userId, req.body.action as ProfileReportAction);
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
}
