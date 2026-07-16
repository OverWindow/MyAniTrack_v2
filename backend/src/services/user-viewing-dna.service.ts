import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { getUserAnimeStats } from './recommendation.service';

const METHODOLOGY_VERSION = 1;
const GENRE_CATEGORY_COUNT = 19;
const ERA_CATEGORY_COUNT = 8;

export type ViewingDnaAxisKey =
  | 'completion'
  | 'seriesCompletion'
  | 'genreExploration'
  | 'eraExploration'
  | 'ratingActivity'
  | 'watchImmersion';

interface ViewingDnaCollectionRow extends RowDataPacket {
  totalAnimeCount: number | string;
  startedAnimeCount: number | string;
  completedAnimeCount: number | string;
  ratedAnimeCount: number | string;
}

interface ViewingDnaGenreRow extends RowDataPacket {
  genre: string;
  animeCount: number | string;
}

interface ViewingDnaYearRow extends RowDataPacket {
  seasonYear: number;
  animeCount: number | string;
}

interface ViewingDnaPercentileRow extends RowDataPacket {
  communityUserCount: number | string;
  atOrBelowUserCount: number | string;
}

export interface ViewingDnaAxis {
  key: ViewingDnaAxisKey;
  label: string;
  score: number;
  available: boolean;
  description: string;
  raw: Record<string, number>;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return round2(Math.min(100, Math.max(0, value)));
}

function toPercentage(numerator: number, denominator: number) {
  return denominator > 0 ? clampScore((numerator / denominator) * 100) : 0;
}

function calculateNormalizedEntropy(distribution: number[], maximumCategoryCount: number) {
  const values = distribution.filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0 || values.length <= 1 || maximumCategoryCount <= 1) {
    return 0;
  }

  const entropy = -values.reduce((sum, value) => {
    const probability = value / total;
    return sum + probability * Math.log(probability);
  }, 0);

  return clampScore((entropy / Math.log(maximumCategoryCount)) * 100);
}

function toEraBucket(year: number) {
  if (year < 1960) return 'before1960';
  if (year < 1970) return '1960s';
  if (year < 1980) return '1970s';
  if (year < 1990) return '1980s';
  if (year < 2000) return '1990s';
  if (year < 2010) return '2000s';
  if (year < 2020) return '2010s';
  return '2020s';
}

function getConfidence(startedAnimeCount: number): 'none' | 'low' | 'medium' | 'high' {
  if (startedAnimeCount <= 0) return 'none';
  if (startedAnimeCount < 5) return 'low';
  if (startedAnimeCount < 20) return 'medium';
  return 'high';
}

export async function getUserViewingDna(userId: number) {
  const [stats, collectionResult, genreResult, yearResult] = await Promise.all([
    getUserAnimeStats(userId),
    pool.query<ViewingDnaCollectionRow[]>(
      `
      SELECT
        COUNT(*) AS totalAnimeCount,
        COALESCE(SUM(status <> 'planned'), 0) AS startedAnimeCount,
        COALESCE(SUM(status = 'completed'), 0) AS completedAnimeCount,
        COALESCE(SUM(status <> 'planned' AND score IS NOT NULL), 0) AS ratedAnimeCount
      FROM user_anime_lists
      WHERE user_id = ?
      `,
      [userId]
    ),
    pool.query<ViewingDnaGenreRow[]>(
      `
      SELECT
        genreRow.genre,
        COUNT(DISTINCT ual.anime_id) AS animeCount
      FROM user_anime_lists ual
      INNER JOIN anime_genres genreRow
        ON genreRow.anime_id = ual.anime_id
      WHERE ual.user_id = ?
        AND ual.status <> 'planned'
      GROUP BY genreRow.genre
      `,
      [userId]
    ),
    pool.query<ViewingDnaYearRow[]>(
      `
      SELECT
        animeRow.season_year AS seasonYear,
        COUNT(*) AS animeCount
      FROM user_anime_lists ual
      INNER JOIN anime animeRow
        ON animeRow.id = ual.anime_id
      WHERE ual.user_id = ?
        AND ual.status <> 'planned'
        AND animeRow.season_year IS NOT NULL
      GROUP BY animeRow.season_year
      `,
      [userId]
    ),
  ]);

  const collectionRow = collectionResult[0][0];
  const genreRows = genreResult[0];
  const yearRows = yearResult[0];
  const totalAnimeCount = toNumber(collectionRow?.totalAnimeCount);
  const startedAnimeCount = toNumber(collectionRow?.startedAnimeCount);
  const completedAnimeCount = toNumber(collectionRow?.completedAnimeCount);
  const ratedAnimeCount = toNumber(collectionRow?.ratedAnimeCount);
  const eraDistribution = new Map<string, number>();

  for (const row of yearRows) {
    const bucket = toEraBucket(Number(row.seasonYear));
    eraDistribution.set(bucket, (eraDistribution.get(bucket) ?? 0) + toNumber(row.animeCount));
  }

  const [percentileRows] = await pool.query<ViewingDnaPercentileRow[]>(
    `
    SELECT
      COUNT(*) AS communityUserCount,
      COALESCE(SUM(total_watch_minutes <= ?), 0) AS atOrBelowUserCount
    FROM user_anime_stats
    WHERE total_count > 0
    `,
    [stats.totalWatchMinutes]
  );
  const percentileRow = percentileRows[0];
  const communityUserCount = toNumber(percentileRow?.communityUserCount);
  const atOrBelowUserCount = toNumber(percentileRow?.atOrBelowUserCount);
  const watchedSeriesCount = stats.seriesStats.watchedSeriesCount;
  const completedSeriesCount = stats.seriesStats.completedSeriesCount;

  const axes: ViewingDnaAxis[] = [
    {
      key: 'completion',
      label: '작품 완주력',
      score: toPercentage(completedAnimeCount, startedAnimeCount),
      available: startedAnimeCount > 0,
      description: '계획 중을 제외하고 실제 감상을 시작한 작품 중 완주한 비율입니다.',
      raw: { startedAnimeCount, completedAnimeCount },
    },
    {
      key: 'seriesCompletion',
      label: '시리즈 완주력',
      score: toPercentage(completedSeriesCount, watchedSeriesCount),
      available: watchedSeriesCount > 0,
      description: '한 작품 이상 완주한 본편 시리즈 중 모든 본편을 완주한 비율입니다.',
      raw: { watchedSeriesCount, completedSeriesCount },
    },
    {
      key: 'genreExploration',
      label: '장르 탐험도',
      score: calculateNormalizedEntropy(
        genreRows.map((row) => toNumber(row.animeCount)),
        GENRE_CATEGORY_COUNT
      ),
      available: genreRows.length > 0,
      description: '감상 작품이 여러 장르에 얼마나 고르게 분포하는지 나타냅니다.',
      raw: {
        distinctGenreCount: genreRows.length,
        maximumGenreCount: GENRE_CATEGORY_COUNT,
      },
    },
    {
      key: 'eraExploration',
      label: '시대 탐험도',
      score: calculateNormalizedEntropy(
        Array.from(eraDistribution.values()),
        ERA_CATEGORY_COUNT
      ),
      available: yearRows.length > 0,
      description: '1960년 이전부터 2020년대까지 여러 시대의 작품을 얼마나 고르게 감상했는지 나타냅니다.',
      raw: {
        distinctEraCount: eraDistribution.size,
        maximumEraCount: ERA_CATEGORY_COUNT,
      },
    },
    {
      key: 'ratingActivity',
      label: '평가 적극성',
      score: toPercentage(ratedAnimeCount, startedAnimeCount),
      available: startedAnimeCount > 0,
      description: '실제 감상을 시작한 작품 중 내 점수를 기록한 비율입니다.',
      raw: { startedAnimeCount, ratedAnimeCount },
    },
    {
      key: 'watchImmersion',
      label: '시청 몰입도',
      score: toPercentage(atOrBelowUserCount, communityUserCount),
      available: startedAnimeCount > 0 && communityUserCount > 0,
      description: '총 시청 시간을 통계가 있는 전체 사용자와 비교한 백분위입니다.',
      raw: {
        totalWatchMinutes: stats.totalWatchMinutes,
        totalWatchHours: round2(stats.totalWatchMinutes / 60),
        communityUserCount,
      },
    },
  ];
  const availableAxes = axes.filter((axis) => axis.available);
  const strongestAxis = availableAxes.reduce<ViewingDnaAxis | null>(
    (strongest, axis) => !strongest || axis.score > strongest.score ? axis : strongest,
    null
  );

  return {
    userId,
    methodologyVersion: METHODOLOGY_VERSION,
    confidence: getConfidence(startedAnimeCount),
    scale: { min: 0, max: 100 },
    axes,
    strongestAxis: strongestAxis?.key ?? null,
    raw: {
      totalAnimeCount,
      startedAnimeCount,
    },
    calculatedAt: new Date().toISOString(),
  };
}
