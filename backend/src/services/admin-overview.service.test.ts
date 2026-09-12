import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { formatAdminOverview } from './admin-overview.service';
import { getNextCatalogDiscoverySchedule } from './catalog-discovery.service';

test('admin overview splits pending work and normalizes service state', () => {
  const now = new Date('2026-03-10T00:00:00.000Z');
  const item = formatAdminOverview({
    summary: {
      registeredUsers: 42,
      anime: 120,
      characters: 300,
      voiceActors: 180,
      studios: 24,
      pendingCatalog: 7,
      pendingUserCatalog: 3,
      pendingAiCatalog: 4,
      pendingProfileReports: 2,
      failedDiscoveryRuns: 1,
      maintenanceEnabled: 1,
    } as never,
    recentSubmissions: [{
      id: 9,
      displayName: '테스트 작품',
      source: 'AI',
      entityType: 'ANIME',
      status: 'PENDING',
      createdAt: now,
    } as never],
    recentRuns: [{
      id: 4,
      seasonYear: 2026,
      season: 'SPRING',
      phase: 'INITIAL',
      model: 'gpt-5.6-luna',
      searchModel: 'gemini-3.5-flash-lite',
      status: 'failed',
      candidateCount: 10,
      processedCount: 10,
      createdRequestCount: 8,
      failedCount: 2,
      lastError: 'two candidates failed',
      startedAt: now,
      finishedAt: now,
      createdAt: now,
    } as never],
    activeRun: undefined,
  }, now);

  assert.equal(item.counts.pendingUserCatalog, 3);
  assert.equal(item.counts.pendingAiCatalog, 4);
  assert.equal(item.service.maintenanceEnabled, true);
  assert.equal(item.service.discovery.latestRun?.processedCount, 10);
  assert.equal(item.service.discovery.latestRun?.model, 'gpt-5.6-luna');
  assert.equal(item.service.discovery.latestRun?.searchModel, 'gemini-3.5-flash-lite');
  assert.equal(item.recent.submissions[0].createdAt, now.toISOString());
  assert.equal(item.service.discovery.nextSchedule.scheduledAt, '2026-03-31T18:00:00.000Z');
});

test('next catalog discovery schedule follows 03:00 KST quarterly and refresh slots', () => {
  assert.deepEqual(getNextCatalogDiscoverySchedule(new Date('2026-01-01T00:00:00.000Z')), {
    scheduledAt: '2026-01-31T18:00:00.000Z',
    season: 'WINTER',
    phase: 'REFRESH',
  });
  assert.deepEqual(getNextCatalogDiscoverySchedule(new Date('2026-11-30T23:00:00.000Z')), {
    scheduledAt: '2026-12-31T18:00:00.000Z',
    season: 'WINTER',
    phase: 'INITIAL',
  });
});

test('admin overview is protected by the shared admin middleware route', () => {
  const routes = readFileSync(join(process.cwd(), 'routes', 'admin.routes.ts'), 'utf8');
  assert.match(routes, /router\.use\('\/admin', requireAdmin\)/);
  assert.match(routes, /router\.get\('\/admin\/overview', getAdminOverviewController\)/);
});
