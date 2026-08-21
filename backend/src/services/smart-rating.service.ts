import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { UserAnimeListTitleLanguage } from './user-anime-list.service';

type SmartRatingRelation = 'better' | 'similar' | 'worse';

interface SmartRatingAnimeRow extends RowDataPacket {
  animeId: number;
  anilistId: number;
  score: number | string | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
}

interface AnimeExistsRow extends RowDataPacket {
  id: number;
}

export interface SmartRatingComparisonInput {
  animeId: unknown;
  relation: unknown;
}

function parseScore(value: number | string | null) {
  const score = Number(value);
  return Number.isFinite(score) ? Number(score.toFixed(2)) : null;
}

function roundToHalf(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 2) / 2));
}

function round1(value: number) {
  return Number(value.toFixed(1));
}

function getScoreKey(score: number) {
  return score.toFixed(2);
}

function pickDisplayTitle(row: SmartRatingAnimeRow, titleLanguage: UserAnimeListTitleLanguage) {
  if (titleLanguage === 'ko') {
    return row.titleKorean
      ?? row.titleEnglish
      ?? row.titleRomaji
      ?? row.titleUserPreferred
      ?? row.titleNative;
  }

  if (titleLanguage === 'en') {
    return row.titleEnglish
      ?? row.titleKorean
      ?? row.titleRomaji
      ?? row.titleUserPreferred
      ?? row.titleNative;
  }

  return row.titleNative
    ?? row.titleRomaji
    ?? row.titleUserPreferred
    ?? row.titleEnglish
    ?? row.titleKorean;
}

function mapCandidate(row: SmartRatingAnimeRow, titleLanguage: UserAnimeListTitleLanguage) {
  return {
    animeId: row.animeId,
    score: parseScore(row.score),
    anime: {
      id: row.animeId,
      anilistId: row.anilistId,
      title: pickDisplayTitle(row, titleLanguage),
      titles: {
        korean: row.titleKorean,
        english: row.titleEnglish,
        native: row.titleNative,
        romaji: row.titleRomaji,
        userPreferred: row.titleUserPreferred,
      },
      coverImageLarge: row.coverImageLarge,
      coverImageExtraLarge: row.coverImageExtraLarge,
    },
  };
}

function validateComparisonRelation(value: unknown): SmartRatingRelation {
  if (value === 'better' || value === 'similar' || value === 'worse') {
    return value;
  }

  throw new Error('relation must be one of better, similar, worse');
}

function validateComparisonAnimeId(value: unknown) {
  const animeId = Number(value);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    throw new Error('comparison animeId must be a positive integer');
  }

  return animeId;
}

async function ensureAnimeExists(animeId: number) {
  const [rows] = await pool.query<AnimeExistsRow[]>(
    `
    SELECT id
    FROM anime
    WHERE id = ?
      AND is_adult = FALSE
      AND app_visible = TRUE
    LIMIT 1
    `,
    [animeId]
  );

  if (!rows[0]) {
    throw new Error('Anime not found');
  }
}

async function getRatedAnimeRows(userId: number, animeIds: number[]) {
  if (animeIds.length === 0) {
    return [];
  }

  const placeholders = animeIds.map(() => '?').join(', ');
  const [rows] = await pool.query<SmartRatingAnimeRow[]>(
    `
    SELECT
      ual.anime_id AS animeId,
      ual.score,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE ual.user_id = ?
      AND ual.anime_id IN (${placeholders})
      AND ual.score IS NOT NULL
    `,
    [userId, ...animeIds]
  );

  return rows;
}

export async function getSmartRatingCandidates(params: {
  userId: number;
  targetAnimeId: number;
  titleLanguage: UserAnimeListTitleLanguage;
  limit: number;
}) {
  await ensureAnimeExists(params.targetAnimeId);

  const [rows] = await pool.query<SmartRatingAnimeRow[]>(
    `
    SELECT
      ual.anime_id AS animeId,
      ual.score,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE ual.user_id = ?
      AND ual.anime_id <> ?
      AND ual.score IS NOT NULL
    ORDER BY RAND()
    `,
    [params.userId, params.targetAnimeId]
  );

  const uniqueScores = new Set<string>();
  const items = [];

  for (const row of rows) {
    const score = parseScore(row.score);

    if (score === null) {
      continue;
    }

    const scoreKey = getScoreKey(score);

    if (uniqueScores.has(scoreKey)) {
      continue;
    }

    uniqueScores.add(scoreKey);
    items.push(mapCandidate(row, params.titleLanguage));

    if (items.length >= params.limit) {
      break;
    }
  }

  if (items.length === 0) {
    throw new Error('At least one rated anime is required for smart rating');
  }

  return {
    targetAnimeId: params.targetAnimeId,
    items,
  };
}

export async function estimateSmartRating(params: {
  userId: number;
  targetAnimeId: number;
  comparisons: SmartRatingComparisonInput[];
}) {
  await ensureAnimeExists(params.targetAnimeId);

  if (!Array.isArray(params.comparisons) || params.comparisons.length === 0) {
    throw new Error('comparisons must include at least one item');
  }

  if (params.comparisons.length > 5) {
    throw new Error('comparisons must include at most 5 items');
  }

  const normalizedComparisons = params.comparisons.map((comparison) => ({
    animeId: validateComparisonAnimeId(comparison.animeId),
    relation: validateComparisonRelation(comparison.relation),
  }));
  const uniqueAnimeIds = Array.from(new Set(normalizedComparisons.map((comparison) => comparison.animeId)));

  if (uniqueAnimeIds.includes(params.targetAnimeId)) {
    throw new Error('comparison animeId must not equal targetAnimeId');
  }

  if (uniqueAnimeIds.length !== normalizedComparisons.length) {
    throw new Error('comparison animeId must be unique');
  }

  const ratedRows = await getRatedAnimeRows(params.userId, uniqueAnimeIds);
  const ratedByAnimeId = new Map<number, SmartRatingAnimeRow>();

  for (const row of ratedRows) {
    ratedByAnimeId.set(row.animeId, row);
  }

  if (ratedByAnimeId.size !== uniqueAnimeIds.length) {
    throw new Error('All comparison anime must be rated in the user list');
  }

  let lowerBound = 0;
  let upperBound = 10;
  const similarScores: number[] = [];
  const appliedComparisons = normalizedComparisons.map((comparison) => {
    const row = ratedByAnimeId.get(comparison.animeId);
    const score = parseScore(row?.score ?? null);

    if (score === null) {
      throw new Error('All comparison anime must be rated in the user list');
    }

    if (comparison.relation === 'better') {
      lowerBound = Math.max(lowerBound, score);
    } else if (comparison.relation === 'worse') {
      upperBound = Math.min(upperBound, score);
    } else {
      similarScores.push(score);
    }

    return {
      animeId: comparison.animeId,
      relation: comparison.relation,
      score,
    };
  });

  const hasLowerBound = lowerBound > 0;
  const hasUpperBound = upperBound < 10;
  const hasInconsistentBounds = lowerBound > upperBound;
  let estimatedScore: number;

  if (similarScores.length > 0) {
    const similarAverage = similarScores.reduce((sum, score) => sum + score, 0) / similarScores.length;
    estimatedScore = hasInconsistentBounds
      ? similarAverage
      : Math.max(lowerBound, Math.min(upperBound, similarAverage));
  } else if (hasLowerBound && hasUpperBound) {
    estimatedScore = (lowerBound + upperBound) / 2;
  } else if (hasLowerBound) {
    estimatedScore = lowerBound + 0.75;
  } else if (hasUpperBound) {
    estimatedScore = upperBound - 0.75;
  } else {
    estimatedScore = 5;
  }

  const roundedScore = roundToHalf(estimatedScore);
  const confidence = hasInconsistentBounds
    ? 'low'
    : appliedComparisons.length >= 4 && (similarScores.length > 0 || (hasLowerBound && hasUpperBound))
      ? 'high'
      : appliedComparisons.length >= 2
        ? 'medium'
        : 'low';

  return {
    targetAnimeId: params.targetAnimeId,
    estimatedScore: roundedScore,
    confidence,
    range: {
      min: round1(Math.min(roundedScore, lowerBound)),
      max: round1(Math.max(roundedScore, upperBound)),
    },
    comparisons: appliedComparisons,
    reason: buildEstimateReason({
      estimatedScore: roundedScore,
      lowerBound,
      upperBound,
      similarScores,
      hasInconsistentBounds,
    }),
  };
}

function buildEstimateReason(params: {
  estimatedScore: number;
  lowerBound: number;
  upperBound: number;
  similarScores: number[];
  hasInconsistentBounds: boolean;
}) {
  if (params.hasInconsistentBounds) {
    return `비교 결과가 서로 충돌해서 가장 가까운 중간값으로 ${params.estimatedScore}점을 추정했습니다.`;
  }

  if (params.similarScores.length > 0) {
    return `비슷하다고 선택한 작품들의 평점을 중심으로 ${params.estimatedScore}점을 추정했습니다.`;
  }

  if (params.lowerBound > 0 && params.upperBound < 10) {
    return `${params.lowerBound}점 작품보다는 좋고 ${params.upperBound}점 작품보다는 낮게 평가되어 ${params.estimatedScore}점으로 추정했습니다.`;
  }

  if (params.lowerBound > 0) {
    return `${params.lowerBound}점 작품보다 좋다고 평가되어 ${params.estimatedScore}점으로 추정했습니다.`;
  }

  if (params.upperBound < 10) {
    return `${params.upperBound}점 작품보다 낮게 평가되어 ${params.estimatedScore}점으로 추정했습니다.`;
  }

  return `${params.estimatedScore}점으로 추정했습니다.`;
}
