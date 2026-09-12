import type { Request, Response } from 'express';
import {
  cancelCatalogDiscoveryRun,
  createCatalogDiscoveryRun,
  getCatalogDiscoveryRun,
  listCatalogDiscoveryRuns,
  retryCatalogDiscoveryRun,
} from '../services/catalog-discovery.service';

function userId(req: Request) {
  if (!req.authUser) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  return req.authUser.userId;
}

function id(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('id must be a positive integer');
  return parsed;
}

function fail(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const explicit = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
  const status = explicit || (message.includes('not found') ? 404 : message.includes('must be') ? 400 : 500);
  if (status === 500) console.error(error);
  return res.status(status).json({ success: false, message });
}

export async function listCatalogDiscoveryRunsController(_req: Request, res: Response) {
  try { return res.json({ success: true, runs: await listCatalogDiscoveryRuns() }); }
  catch (error) { return fail(res, error); }
}

export async function getCatalogDiscoveryRunController(req: Request, res: Response) {
  try { return res.json({ success: true, run: await getCatalogDiscoveryRun(id(req.params.id)) }); }
  catch (error) { return fail(res, error); }
}

export async function createCatalogDiscoveryRunController(req: Request, res: Response) {
  try { return res.status(202).json({ success: true, run: await createCatalogDiscoveryRun(req.body, userId(req)) }); }
  catch (error) { return fail(res, error); }
}

export async function cancelCatalogDiscoveryRunController(req: Request, res: Response) {
  try { await cancelCatalogDiscoveryRun(id(req.params.id)); return res.json({ success: true }); }
  catch (error) { return fail(res, error); }
}

export async function retryCatalogDiscoveryRunController(req: Request, res: Response) {
  try { return res.status(202).json({ success: true, run: await retryCatalogDiscoveryRun(id(req.params.id)) }); }
  catch (error) { return fail(res, error); }
}
