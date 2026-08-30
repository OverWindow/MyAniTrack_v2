import type { Request, Response } from 'express';
import {
  listMyShares,
  protectShareCursor,
  putMyShare,
  resolveShare,
  revokeMyShare,
  sanitizeAnalysisValue,
  sanitizeCollectionResult,
  sanitizeSeriesResult,
  ShareError,
  unprotectShareCursor,
  validateShareExpiryDays,
  validateShareResourceType,
  type ShareResourceType,
} from '../services/share.service';
import {
  getUserAnimeList,
  validateUserAnimeListFormat,
  validateUserAnimeListGenre,
  validateUserAnimeListLimit,
  validateUserAnimeListQuery,
  validateUserAnimeListScoreFilter,
  validateUserAnimeListSort,
  validateUserAnimeListTitleLanguage,
  validateUserAnimeListYear,
} from '../services/user-anime-list.service';
import {
  getUserSeriesCollection,
  validateAnimeSeriesScope,
  validateUserSeriesCollectionStatus,
  validateUserSeriesQuery,
} from '../services/user-series-stats.service';
import { getUserAnimeStats, getUserGenreBubbleChart } from '../services/recommendation.service';
import { getUserViewingDna } from '../services/user-viewing-dna.service';
import {
  getUserFormatStats,
  validateFormatStatsMinimumCount,
  validateFormatStatsStatus,
} from '../services/user-format-stats.service';
import {
  getUserYearlyScoreStats,
  validateYearlyScoreStatsMinimumCount,
  validateYearlyScoreStatsStatus,
} from '../services/user-yearly-score-stats.service';
import {
  getUserStudioAnime,
  getUserStudioRanking,
  validateStudioId,
  validateStudioStatsBoolean,
  validateStudioStatsLimit,
  validateStudioStatsMinimumCount,
  validateStudioStatsSort,
  validateStudioStatsStatus,
} from '../services/user-studio-stats.service';
import {
  getUserVoiceActorAnime,
  getUserVoiceActorRanking,
  validateMinimumCount,
  validateVoiceActorId,
  validateVoiceActorRankingSort,
  validateVoiceActorStatsLimit,
} from '../services/user-voice-actor-stats.service';
import { validateVoiceActorAnimeStatus } from './user-voice-actor-stats.controller';

function sendError(res: Response, error: unknown) {
  if (error instanceof ShareError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message.includes('must be') || message.includes('Cursor') || message === 'Invalid cursor' ? 400
    : message.includes('not found') ? 404 : 500;
  if (status === 500) console.error(error);
  return res.status(status).json({ success: false, code: status === 400 ? 'INVALID_REQUEST' : 'SHARE_REQUEST_FAILED', message });
}

function requireOwner(req: Request) {
  if (!req.authUser) throw new ShareError(401, 'UNAUTHORIZED', 'Unauthorized');
  return req.authUser.userId;
}

function setShareHeaders(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

async function getResolved(req: Request, resourceType?: ShareResourceType) {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const share = await resolveShare(token, req.authUser?.userId);
  if (resourceType && share.resourceType !== resourceType) {
    throw new ShareError(404, 'SHARE_NOT_FOUND', 'Share not found');
  }
  return share;
}

function parseTitleLanguage(value: unknown): 'ko' | 'en' | 'ja' {
  return value === 'en' || value === 'ja' ? value : 'ko';
}

function parsePositiveInt(value: unknown, fallback: number, max: number, field: string) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new ShareError(400, 'INVALID_REQUEST', `${field} must be between 1 and ${max}`);
  return parsed;
}

export async function listMySharesController(req: Request, res: Response) {
  setShareHeaders(res);
  try { return res.json({ success: true, items: await listMyShares(requireOwner(req)) }); }
  catch (error) { return sendError(res, error); }
}

export async function putMyShareController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const item = await putMyShare(requireOwner(req), validateShareResourceType(req.params.resourceType), validateShareExpiryDays(req.body?.expiresInDays));
    return res.json({ success: true, item });
  } catch (error) { return sendError(res, error); }
}

export async function revokeMyShareController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    await revokeMyShare(requireOwner(req), validateShareResourceType(req.params.resourceType));
    return res.status(204).send();
  } catch (error) { return sendError(res, error); }
}

export async function getShareDescriptorController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req);
    return res.json({ success: true, resourceType: share.resourceType, expiresAt: share.expiresAt, owner: share.owner });
  } catch (error) { return sendError(res, error); }
}

function collectionParams(req: Request, share: Awaited<ReturnType<typeof resolveShare>>, purpose = 'anime-list') {
  return {
    userId: share.ownerUserId,
    sort: validateUserAnimeListSort(typeof req.query.sort === 'string' ? req.query.sort : 'latest'),
    titleLanguage: validateUserAnimeListTitleLanguage(req.query.titleLanguage),
    genre: validateUserAnimeListGenre(req.query.genre),
    format: validateUserAnimeListFormat(req.query.format),
    year: validateUserAnimeListYear(req.query.year),
    score: validateUserAnimeListScoreFilter(req.query.score),
    query: validateUserAnimeListQuery(req.query.query),
    limit: validateUserAnimeListLimit(req.query.limit),
    cursor: unprotectShareCursor(req.query.cursor, share.publicId, purpose),
  };
}

export async function getSharedCollectionController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'COLLECTION');
    return res.json({ success: true, owner: share.owner, ...sanitizeCollectionResult(await getUserAnimeList(collectionParams(req, share)), share.publicId) });
  } catch (error) { return sendError(res, error); }
}

export async function getSharedAnalysisAnimeListController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'ANALYSIS');
    if (req.query.genre === undefined && req.query.year === undefined && req.query.score === undefined) {
      throw new ShareError(400, 'FILTER_REQUIRED', 'genre, year, or score filter is required');
    }
    return res.json({ success: true, owner: share.owner, ...sanitizeCollectionResult(await getUserAnimeList(collectionParams(req, share, 'analysis-anime-list')), share.publicId, 'analysis-anime-list') });
  } catch (error) { return sendError(res, error); }
}

export async function getSharedSeriesController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'COLLECTION');
    const result = await getUserSeriesCollection({
      userId: share.ownerUserId,
      scope: validateAnimeSeriesScope(req.query.scope),
      status: validateUserSeriesCollectionStatus(req.query.status),
      titleLanguage: validateUserAnimeListTitleLanguage(req.query.titleLanguage),
      query: validateUserSeriesQuery(req.query.query),
      limit: validateUserAnimeListLimit(req.query.limit),
      cursor: unprotectShareCursor(req.query.cursor, share.publicId, 'series'),
    });
    return res.json({ success: true, owner: share.owner, ...sanitizeSeriesResult(result, share.publicId) });
  } catch (error) { return sendError(res, error); }
}

async function sendAnalysis(req: Request, res: Response, loader: (userId: number) => Promise<unknown>) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'ANALYSIS');
    return res.json({ success: true, owner: share.owner, item: sanitizeAnalysisValue(await loader(share.ownerUserId)) });
  } catch (error) { return sendError(res, error); }
}

export const getSharedAnimeStatsController = (req: Request, res: Response) => sendAnalysis(req, res, (userId) => getUserAnimeStats(userId));
export const getSharedViewingDnaController = (req: Request, res: Response) => sendAnalysis(req, res, getUserViewingDna);
export const getSharedGenreBubbleController = (req: Request, res: Response) => sendAnalysis(req, res, (userId) => getUserGenreBubbleChart(userId, {
  titleLanguage: parseTitleLanguage(req.query.titleLanguage),
  minCount: parsePositiveInt(req.query.minCount, 5, 100, 'minCount'),
  weighting: req.query.weighting === 'full' ? 'full' : 'fractional',
  status: req.query.status === 'all' ? 'all' : 'completed',
  communityScore: req.query.communityScore === 'mean' ? 'mean' : 'average',
  topLimit: parsePositiveInt(req.query.topLimit, 3, 10, 'topLimit'),
}));
export const getSharedYearlyScoresController = (req: Request, res: Response) => sendAnalysis(req, res, (userId) => getUserYearlyScoreStats({ userId, status: validateYearlyScoreStatsStatus(req.query.status), minRatedAnimeCount: validateYearlyScoreStatsMinimumCount(req.query.minRatedAnimeCount) }));
export const getSharedFormatDistributionController = (req: Request, res: Response) => sendAnalysis(req, res, (userId) => getUserFormatStats({ userId, status: validateFormatStatsStatus(req.query.status), minCount: validateFormatStatsMinimumCount(req.query.minCount) }));

export async function getSharedStudioRankingController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'ANALYSIS');
    const result = await getUserStudioRanking({ userId: share.ownerUserId, sort: validateStudioStatsSort(req.query.sort), status: validateStudioStatsStatus(req.query.status), mainOnly: validateStudioStatsBoolean(req.query.mainOnly, true), minAnimeCount: validateStudioStatsMinimumCount(req.query.minAnimeCount, 'minAnimeCount', 1), minRatedAnimeCount: validateStudioStatsMinimumCount(req.query.minRatedAnimeCount, 'minRatedAnimeCount', 1), limit: validateStudioStatsLimit(req.query.limit), cursor: unprotectShareCursor(req.query.cursor, share.publicId, 'studios') });
    const clean = sanitizeAnalysisValue(result);
    clean.pageInfo.nextCursor = protectShareCursor(result.pageInfo.nextCursor, share.publicId, 'studios');
    return res.json({ success: true, owner: share.owner, ...clean });
  } catch (error) { return sendError(res, error); }
}

export async function getSharedStudioAnimeController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'ANALYSIS');
    const result = await getUserStudioAnime({ userId: share.ownerUserId, studioId: validateStudioId(req.params.studioId), titleLanguage: parseTitleLanguage(req.query.titleLanguage), status: validateStudioStatsStatus(req.query.status), mainOnly: validateStudioStatsBoolean(req.query.mainOnly, true), limit: validateStudioStatsLimit(req.query.limit), cursor: unprotectShareCursor(req.query.cursor, share.publicId, 'studio-anime') });
    const clean = sanitizeAnalysisValue(result);
    clean.pageInfo.nextCursor = protectShareCursor(result.pageInfo.nextCursor, share.publicId, 'studio-anime');
    return res.json({ success: true, owner: share.owner, ...clean });
  } catch (error) { return sendError(res, error); }
}

export async function getSharedVoiceActorRankingController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'ANALYSIS');
    const result = await getUserVoiceActorRanking({ userId: share.ownerUserId, sort: validateVoiceActorRankingSort(req.query.sort), limit: validateVoiceActorStatsLimit(req.query.limit), minAnimeCount: validateMinimumCount(req.query.minAnimeCount, 'minAnimeCount'), minRatedAnimeCount: validateMinimumCount(req.query.minRatedAnimeCount, 'minRatedAnimeCount'), cursor: unprotectShareCursor(req.query.cursor, share.publicId, 'voice-actors') });
    const clean = sanitizeAnalysisValue(result);
    clean.pageInfo.nextCursor = protectShareCursor(result.pageInfo.nextCursor, share.publicId, 'voice-actors');
    return res.json({ success: true, owner: share.owner, ...clean });
  } catch (error) { return sendError(res, error); }
}

export async function getSharedVoiceActorAnimeController(req: Request, res: Response) {
  setShareHeaders(res);
  try {
    const share = await getResolved(req, 'ANALYSIS');
    const result = await getUserVoiceActorAnime({ userId: share.ownerUserId, voiceActorId: validateVoiceActorId(req.params.voiceActorId), titleLanguage: parseTitleLanguage(req.query.titleLanguage), status: validateVoiceActorAnimeStatus(req.query.status), limit: validateVoiceActorStatsLimit(req.query.limit), cursor: unprotectShareCursor(req.query.cursor, share.publicId, 'voice-actor-anime') });
    const clean = sanitizeAnalysisValue(result);
    clean.pageInfo.nextCursor = protectShareCursor(result.pageInfo.nextCursor, share.publicId, 'voice-actor-anime');
    return res.json({ success: true, owner: share.owner, ...clean });
  } catch (error) { return sendError(res, error); }
}
