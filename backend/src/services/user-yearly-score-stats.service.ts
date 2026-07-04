import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

export type YearlyScoreStatsStatus = 'all' | 'completed';

interface YearlyScoreStatsRow extends RowDataPacket {
  year: number;
  animeCount: number;
  ratedAnimeCount: number;
  averageScore: string | number | null;
  communityAverageScore: string | number | null;
}

export interface YearlyScoreStatsParams {
  userId: number;
  status: YearlyScoreStatsStatus;
  minRatedAnimeCount: number;
}

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

function getStatusWhereClause(status: YearlyScoreStatsStatus) {
  return status === 'completed'
    ? "AND ual.status = 'completed'"
    : '';
}

export function validateYearlyScoreStatsStatus(value: unknown): YearlyScoreStatsStatus {
  const status = typeof value === 'string' ? value : 'completed';

  if (status !== 'all' && status !== 'completed') {
    throw new Error('status must be one of all, completed');
  }

  return status;
}

export function validateYearlyScoreStatsMinimumCount(value: unknown) {
  const count = Number(value ?? 3);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('minRatedAnimeCount must be an integer between 1 and 100');
  }

  return count;
}

export async function getUserYearlyScoreStats(params: YearlyScoreStatsParams) {
  const [rows] = await pool.query<YearlyScoreStatsRow[]>(
    `
    SELECT
      a.season_year AS year,
      COUNT(DISTINCT ual.anime_id) AS animeCount,
      COUNT(DISTINCT CASE WHEN ual.score IS NOT NULL THEN ual.anime_id END) AS ratedAnimeCount,
      AVG(ual.score) AS averageScore,
      AVG(CASE WHEN ual.score IS NOT NULL THEN a.average_score END) AS communityAverageScore
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
    WHERE ual.user_id = ?
      AND a.season_year IS NOT NULL
      ${getStatusWhereClause(params.status)}
    GROUP BY a.season_year
    HAVING ratedAnimeCount >= ?
    ORDER BY a.season_year ASC
    `,
    [params.userId, params.minRatedAnimeCount]
  );

  const items = rows.map((row) => {
    const averageScore = roundMetric(toNumber(row.averageScore));
    const communityAverageScore = roundMetric(
      toNumber(row.communityAverageScore) === null
        ? null
        : Number(row.communityAverageScore) / 10
    );

    return {
      year: row.year,
      animeCount: row.animeCount,
      ratedAnimeCount: row.ratedAnimeCount,
      averageScore,
      communityAverageScore,
      preferenceDelta: averageScore !== null && communityAverageScore !== null
        ? roundMetric(averageScore - communityAverageScore)
        : null,
    };
  });

  const scoredItems = items.filter((item) => item.averageScore !== null);
  const bestItem = scoredItems
    .slice()
    .sort((a, b) => (b.averageScore ?? -Infinity) - (a.averageScore ?? -Infinity) || b.ratedAnimeCount - a.ratedAnimeCount || b.year - a.year)[0];
  const worstItem = scoredItems
    .slice()
    .sort((a, b) => (a.averageScore ?? Infinity) - (b.averageScore ?? Infinity) || b.ratedAnimeCount - a.ratedAnimeCount || a.year - b.year)[0];
  const averageScore = scoredItems.length > 0
    ? roundMetric(scoredItems.reduce((sum, item) => sum + (item.averageScore ?? 0), 0) / scoredItems.length)
    : null;

  return {
    userId: params.userId,
    status: params.status,
    minRatedAnimeCount: params.minRatedAnimeCount,
    items,
    summary: {
      yearCount: items.length,
      bestYear: bestItem?.year ?? null,
      worstYear: worstItem?.year ?? null,
      averageScore,
    },
  };
}
