import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { getNextCatalogDiscoverySchedule } from './catalog-discovery.service';

interface OverviewSummaryRow extends RowDataPacket {
  registeredUsers: number;
  anime: number;
  characters: number;
  voiceActors: number;
  studios: number;
  pendingCatalog: number;
  pendingUserCatalog: number;
  pendingAiCatalog: number;
  pendingProfileReports: number;
  failedDiscoveryRuns: number;
  maintenanceEnabled: number | boolean;
}

interface OverviewSubmissionRow extends RowDataPacket {
  id: number;
  displayName: string;
  source: 'USER' | 'AI';
  entityType: 'ANIME' | 'CHARACTER' | 'VOICE_ACTOR' | 'STUDIO';
  status: string;
  createdAt: Date | string;
}

interface OverviewRunRow extends RowDataPacket {
  id: number;
  seasonYear: number;
  season: string;
  phase: string;
  model: string;
  searchModel: string;
  status: string;
  candidateCount: number;
  processedCount: number;
  createdRequestCount: number;
  failedCount: number;
  lastError: string | null;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  createdAt: Date | string;
}

type AdminOverviewInput = {
  summary: OverviewSummaryRow | undefined;
  recentSubmissions: OverviewSubmissionRow[];
  recentRuns: OverviewRunRow[];
  activeRun: OverviewRunRow | undefined;
};

function dateValue(value: Date | string | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeRun(row: OverviewRunRow | undefined) {
  if (!row) return null;
  return {
    id: Number(row.id),
    seasonYear: Number(row.seasonYear),
    season: row.season,
    phase: row.phase,
    model: row.model,
    searchModel: row.searchModel,
    status: row.status,
    candidateCount: Number(row.candidateCount),
    processedCount: Number(row.processedCount),
    createdRequestCount: Number(row.createdRequestCount),
    failedCount: Number(row.failedCount),
    lastError: row.lastError,
    startedAt: dateValue(row.startedAt),
    finishedAt: dateValue(row.finishedAt),
    createdAt: dateValue(row.createdAt),
  };
}

export function formatAdminOverview(input: AdminOverviewInput, now = new Date()) {
  const summary = input.summary;
  return {
    generatedAt: now.toISOString(),
    counts: {
      registeredUsers: Number(summary?.registeredUsers ?? 0),
      anime: Number(summary?.anime ?? 0),
      characters: Number(summary?.characters ?? 0),
      voiceActors: Number(summary?.voiceActors ?? 0),
      studios: Number(summary?.studios ?? 0),
      pendingCatalog: Number(summary?.pendingCatalog ?? 0),
      pendingUserCatalog: Number(summary?.pendingUserCatalog ?? 0),
      pendingAiCatalog: Number(summary?.pendingAiCatalog ?? 0),
      pendingProfileReports: Number(summary?.pendingProfileReports ?? 0),
      failedDiscoveryRuns: Number(summary?.failedDiscoveryRuns ?? 0),
    },
    service: {
      maintenanceEnabled: Boolean(summary?.maintenanceEnabled),
      discovery: {
        activeRun: normalizeRun(input.activeRun),
        latestRun: normalizeRun(input.recentRuns[0]),
        nextSchedule: getNextCatalogDiscoverySchedule(now),
      },
    },
    recent: {
      submissions: input.recentSubmissions.map((item) => ({
        id: Number(item.id),
        displayName: item.displayName,
        source: item.source,
        entityType: item.entityType,
        status: item.status,
        createdAt: dateValue(item.createdAt),
      })),
      discoveryRuns: input.recentRuns.map((item) => normalizeRun(item)!),
    },
  };
}

const RUN_SELECT = `
  SELECT id, season_year AS seasonYear, season, phase, model, search_model AS searchModel, status,
    candidate_count AS candidateCount, processed_count AS processedCount,
    created_request_count AS createdRequestCount, failed_count AS failedCount,
    last_error AS lastError, started_at AS startedAt, finished_at AS finishedAt,
    created_at AS createdAt
  FROM catalog_discovery_runs
`;

export async function getAdminOverview(now = new Date()) {
  const [summaryResult, submissionsResult, runsResult, activeResult] = await Promise.all([
    pool.query<OverviewSummaryRow[]>(`
      SELECT
        (SELECT COUNT(*) FROM users) AS registeredUsers,
        (SELECT COUNT(*) FROM anime) AS anime,
        (SELECT COUNT(*) FROM characters) AS characters,
        (SELECT COUNT(*) FROM voice_actors) AS voiceActors,
        (SELECT COUNT(*) FROM studios) AS studios,
        (SELECT COUNT(*) FROM catalog_change_requests WHERE status = 'PENDING') AS pendingCatalog,
        (SELECT COUNT(*) FROM catalog_change_requests WHERE status = 'PENDING' AND source = 'USER') AS pendingUserCatalog,
        (SELECT COUNT(*) FROM catalog_change_requests WHERE status = 'PENDING' AND source = 'AI') AS pendingAiCatalog,
        (SELECT COUNT(*) FROM profile_reports WHERE status = 'PENDING') AS pendingProfileReports,
        (SELECT COUNT(*) FROM catalog_discovery_runs WHERE status = 'failed') AS failedDiscoveryRuns,
        COALESCE((SELECT enabled FROM maintenance_settings WHERE id = 1), FALSE) AS maintenanceEnabled
    `),
    pool.query<OverviewSubmissionRow[]>(`
      SELECT id, display_name AS displayName, source, entity_type AS entityType, status, created_at AS createdAt
      FROM catalog_change_requests
      ORDER BY id DESC
      LIMIT 5
    `),
    pool.query<OverviewRunRow[]>(`${RUN_SELECT} ORDER BY id DESC LIMIT 5`),
    pool.query<OverviewRunRow[]>(`${RUN_SELECT} WHERE status IN ('queued', 'discovering', 'extracting') ORDER BY id DESC LIMIT 1`),
  ]);

  return formatAdminOverview({
    summary: summaryResult[0][0],
    recentSubmissions: submissionsResult[0],
    recentRuns: runsResult[0],
    activeRun: activeResult[0][0],
  }, now);
}
