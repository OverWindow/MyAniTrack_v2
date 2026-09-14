import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

export type AnimeSeriesRebuildScope = 'mainline' | 'franchise' | 'all';

interface AdvisoryLockRow extends RowDataPacket {
  acquired: number | null;
}

interface AnimeSeriesSummaryRow extends RowDataPacket {
  scope: 'mainline' | 'franchise';
  seriesCount: number | string;
  memberCount: number | string;
  updatedAt: string | null;
}

export function validateAnimeSeriesRebuildScope(value: unknown): AnimeSeriesRebuildScope {
  const scope = typeof value === 'string' ? value : 'all';

  if (scope !== 'mainline' && scope !== 'franchise' && scope !== 'all') {
    throw new Error('scope must be one of mainline, franchise, all');
  }

  return scope;
}

export async function rebuildAnimeSeries(scope: AnimeSeriesRebuildScope) {
  const conn = await pool.getConnection();
  const lockName = 'myanitrack:anime-series-rebuild';
  let lockAcquired = false;
  const startedAt = Date.now();

  try {
    const [lockRows] = await conn.query<AdvisoryLockRow[]>(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [lockName]
    );
    lockAcquired = lockRows[0]?.acquired === 1;

    if (!lockAcquired) {
      throw new Error('Anime series rebuild is already running');
    }

    const rebuiltScopes: Array<'mainline' | 'franchise'> = scope === 'all'
      ? ['mainline', 'franchise']
      : [scope];

    for (const targetScope of rebuiltScopes) {
      await conn.query('CALL rebuild_anime_series(?)', [targetScope]);
    }

    const [summaryRows] = await conn.query<AnimeSeriesSummaryRow[]>(
      `
      SELECT
        scope,
        COUNT(*) AS seriesCount,
        COALESCE(SUM(member_count), 0) AS memberCount,
        MAX(updated_at) AS updatedAt
      FROM anime_series
      WHERE scope IN (?)
      GROUP BY scope
      ORDER BY FIELD(scope, 'mainline', 'franchise')
      `,
      [rebuiltScopes]
    );
    const summaryByScope = new Map(summaryRows.map((row) => [row.scope, row]));

    return {
      scope,
      rebuiltScopes,
      durationMs: Date.now() - startedAt,
      summaries: rebuiltScopes.map((targetScope) => {
        const row = summaryByScope.get(targetScope);

        return {
          scope: targetScope,
          seriesCount: Number(row?.seriesCount ?? 0),
          memberCount: Number(row?.memberCount ?? 0),
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    };
  } finally {
    if (lockAcquired) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (error) {
        console.error('Failed to release anime series rebuild lock', error);
      }
    }

    conn.release();
  }
}
