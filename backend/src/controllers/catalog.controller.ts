import type { Request, Response } from 'express';
import {
  approveCatalogSubmission,
  CatalogConflictError,
  createUserCatalogSubmission,
  getAdminCatalogEntity,
  getCatalogTaxonomy,
  getCatalogSubmission,
  listAdminCatalogSubmissions,
  listMyCatalogSubmissions,
  rejectCatalogSubmission,
  searchCatalogEntities,
  updateCatalogSubmission,
  uploadCatalogEntityImage,
  validateCatalogEntityType,
  withdrawMyCatalogSubmission,
  writeCatalogEntity,
  type CatalogChangeSource,
  type CatalogChangeStatus,
} from '../services/catalog.service';

function positiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

function requireUserId(req: Request) {
  if (!req.authUser) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  return req.authUser.userId;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${field} must be one of ${allowed.join(', ')}`);
  return value as T;
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const explicitStatus = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : null;
  const status = error instanceof CatalogConflictError ? 409
    : message.includes('rate limit') ? 429
      : message.includes('not found') ? 404
        : explicitStatus || (message.includes('required') || message.includes('must be') || message.includes('Only pending') ? 400 : 500);
  if (status >= 500) console.error(error);
  return res.status(status).json({
    success: false,
    message,
    ...(error instanceof CatalogConflictError ? { candidates: error.candidates } : {}),
  });
}

export async function searchCatalogController(req: Request, res: Response) {
  try {
    const items = await searchCatalogEntities({
      type: validateCatalogEntityType(req.query.type),
      query: String(req.query.q ?? ''),
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
    });
    return res.json({ success: true, items });
  } catch (error) { return sendError(res, error); }
}

export async function searchAdminCatalogController(req: Request, res: Response) {
  try {
    const items = await searchCatalogEntities({
      type: validateCatalogEntityType(req.query.type), query: String(req.query.q ?? ''),
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit), includeHidden: true,
    });
    return res.json({ success: true, items });
  } catch (error) { return sendError(res, error); }
}

export async function getAdminCatalogTaxonomyController(_req: Request, res: Response) {
  try {
    return res.json({ success: true, item: await getCatalogTaxonomy() });
  } catch (error) { return sendError(res, error); }
}

export async function getAdminCatalogEntityController(req: Request, res: Response) {
  try {
    const item = await getAdminCatalogEntity(validateCatalogEntityType(req.params.type), req.params.id);
    return res.json({ success: true, item });
  } catch (error) { return sendError(res, error); }
}

export async function createMyCatalogSubmissionController(req: Request, res: Response) {
  try {
    const submission = await createUserCatalogSubmission(requireUserId(req), req.body);
    return res.status(201).json({ success: true, submission });
  } catch (error) { return sendError(res, error); }
}

export async function listMyCatalogSubmissionsController(req: Request, res: Response) {
  try {
    const submissions = await listMyCatalogSubmissions(requireUserId(req));
    return res.json({ success: true, submissions });
  } catch (error) { return sendError(res, error); }
}

export async function withdrawMyCatalogSubmissionController(req: Request, res: Response) {
  try {
    await withdrawMyCatalogSubmission(requireUserId(req), positiveInteger(req.params.id, 'id'));
    return res.status(204).send();
  } catch (error) { return sendError(res, error); }
}

export async function listAdminCatalogSubmissionsController(req: Request, res: Response) {
  try {
    const submissions = await listAdminCatalogSubmissions({
      status: optionalEnum(req.query.status, ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const, 'status') as CatalogChangeStatus | undefined,
      source: optionalEnum(req.query.source, ['USER', 'AI'] as const, 'source') as CatalogChangeSource | undefined,
      entityType: req.query.type ? validateCatalogEntityType(req.query.type) : undefined,
      confidence: optionalEnum(req.query.confidence, ['high', 'medium', 'low'] as const, 'confidence'),
    });
    return res.json({ success: true, submissions });
  } catch (error) { return sendError(res, error); }
}

export async function getAdminCatalogSubmissionController(req: Request, res: Response) {
  try {
    const submission = await getCatalogSubmission(positiveInteger(req.params.id, 'id'));
    return res.json({ success: true, submission });
  } catch (error) { return sendError(res, error); }
}

export async function updateAdminCatalogSubmissionController(req: Request, res: Response) {
  try {
    const submission = await updateCatalogSubmission(positiveInteger(req.params.id, 'id'), req.body);
    return res.json({ success: true, submission });
  } catch (error) { return sendError(res, error); }
}

export async function approveAdminCatalogSubmissionController(req: Request, res: Response) {
  try {
    const result = await approveCatalogSubmission(positiveInteger(req.params.id, 'id'), requireUserId(req));
    return res.json({ success: true, result });
  } catch (error) { return sendError(res, error); }
}

export async function rejectAdminCatalogSubmissionController(req: Request, res: Response) {
  try {
    await rejectCatalogSubmission(positiveInteger(req.params.id, 'id'), requireUserId(req), req.body?.reason);
    return res.json({ success: true });
  } catch (error) { return sendError(res, error); }
}

export async function createAdminCatalogEntityController(req: Request, res: Response) {
  try {
    const result = await writeCatalogEntity({
      type: validateCatalogEntityType(req.params.type), payload: req.body, actorUserId: requireUserId(req),
    });
    return res.status(201).json({ success: true, result });
  } catch (error) { return sendError(res, error); }
}

export async function updateAdminCatalogEntityController(req: Request, res: Response) {
  try {
    const result = await writeCatalogEntity({
      type: validateCatalogEntityType(req.params.type),
      targetEntityId: positiveInteger(req.params.id, 'id'),
      payload: req.body,
      actorUserId: requireUserId(req),
    });
    return res.json({ success: true, result });
  } catch (error) { return sendError(res, error); }
}

export async function uploadAdminCatalogImageController(req: Request, res: Response) {
  try {
    if (!req.file) throw new Error('image file is required');
    const result = await uploadCatalogEntityImage({
      type: validateCatalogEntityType(req.params.type),
      entityId: positiveInteger(req.params.id, 'id'),
      variant: String(req.body?.variant ?? ''),
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
    });
    return res.status(201).json({ success: true, result });
  } catch (error) { return sendError(res, error); }
}
