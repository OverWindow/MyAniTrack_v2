import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

export type FormatStatsStatus = 'all' | 'completed';

interface FormatStatsRow extends RowDataPacket {
  format: string;
  animeCount: number;
  ratedAnimeCount: number;
  averageScore: string | number | null;
  watchedEpisodes: string | number | null;
  watchMinutes: string | number | null;
}

export interface FormatStatsParams {
  userId: number;
  status: FormatStatsStatus;
  minCount: number;
}

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  UNKNOWN: 'Unknown',
};

function toNumber(value: string | number | null) {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function roundMetric(value: number | null, fractionDigits = 2) {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(fractionDigits));
}

function getStatusWhereClause(status: FormatStatsStatus) {
  return status === 'completed'
    ? "AND ual.status = 'completed'"
    : '';
}

export function validateFormatStatsStatus(value: unknown): FormatStatsStatus {
  const status = typeof value === 'string' ? value : 'completed';

  if (status !== 'all' && status !== 'completed') {
    throw new Error('status must be one of all, completed');
  }

  return status;
}

export function validateFormatStatsMinimumCount(value: unknown) {
  const count = Number(value ?? 1);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('minCount must be an integer between 1 and 100');
  }

  return count;
}

function getFormatLabel(format: string) {
  return FORMAT_LABELS[format] ?? format;
}

export async function getUserFormatStats(params: FormatStatsParams) {
  const [rows] = await pool.query<FormatStatsRow[]>(
    `
    SELECT
      COALESCE(a.format, 'UNKNOWN') AS format,
      COUNT(DISTINCT ual.anime_id) AS animeCount,
      COUNT(DISTINCT CASE WHEN ual.score IS NOT NULL THEN ual.anime_id END) AS ratedAnimeCount,
      AVG(ual.score) AS averageScore,
      SUM(
        CASE
          WHEN a.episodes IS NOT NULL AND a.episodes > 0 AND ual.status = 'completed' THEN a.episodes
          WHEN a.episodes IS NOT NULL AND a.episodes > 0 THEN LEAST(ual.progress, a.episodes)
          ELSE ual.progress
        END
      ) AS watchedEpisodes,
      SUM(
        (
          CASE
            WHEN a.episodes IS NOT NULL AND a.episodes > 0 AND ual.status = 'completed' THEN a.episodes
            WHEN a.episodes IS NOT NULL AND a.episodes > 0 THEN LEAST(ual.progress, a.episodes)
            ELSE ual.progress
          END
        ) * COALESCE(a.duration, 0)
      ) AS watchMinutes
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    WHERE ual.user_id = ?
      ${getStatusWhereClause(params.status)}
    GROUP BY COALESCE(a.format, 'UNKNOWN')
    HAVING animeCount >= ?
    ORDER BY animeCount DESC, format ASC
    `,
    [params.userId, params.minCount]
  );

  const totalAnimeCount = rows.reduce((sum, row) => sum + row.animeCount, 0);
  const totalWatchMinutes = rows.reduce((sum, row) => sum + Math.round(toNumber(row.watchMinutes) ?? 0), 0);

  const items = rows.map((row) => {
    const watchMinutes = Math.round(toNumber(row.watchMinutes) ?? 0);
    const watchedEpisodes = Math.round(toNumber(row.watchedEpisodes) ?? 0);

    return {
      format: row.format,
      label: getFormatLabel(row.format),
      animeCount: row.animeCount,
      percentage: totalAnimeCount > 0
        ? roundMetric((row.animeCount / totalAnimeCount) * 100)
        : 0,
      ratedAnimeCount: row.ratedAnimeCount,
      averageScore: roundMetric(toNumber(row.averageScore)),
      watchedEpisodes,
      watchMinutes,
      watchHours: roundMetric(watchMinutes / 60),
    };
  });

  return {
    userId: params.userId,
    status: params.status,
    minCount: params.minCount,
    totalAnimeCount,
    totalWatchMinutes,
    totalWatchHours: roundMetric(totalWatchMinutes / 60),
    items,
    summary: {
      formatCount: items.length,
      topFormat: items[0]?.format ?? null,
      topFormatLabel: items[0]?.label ?? null,
    },
  };
}
