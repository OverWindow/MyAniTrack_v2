import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

type JsonMap = Record<string, number>;

interface UserHistoryAnimeRow extends RowDataPacket {
  animeId: number;
  status: string;
  score: number | string | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  episodes: number | null;
  duration: number | null;
  seasonYear: number | null;
  genre: string | null;
}

interface UserAnimeStatsRow extends RowDataPacket {
  userId: number;
  totalCount: number;
  completedCount: number;
  watchingCount: number;
  droppedCount: number;
  totalWatchedEpisodes: number;
  totalWatchMinutes: number;
  avgScore: number | string | null;
  favoriteGenre: string | null;
  favoriteReleasePeriod: string | null;
  genreDistribution: string | JsonMap | null;
  genreWatchMinutes: string | JsonMap | null;
  genreAvgScore: string | JsonMap | null;
  releaseYearDistribution: string | JsonMap | null;
  avgReleaseYear: number | string | null;
  scoreDistribution: string | JsonMap | null;
  preferenceSummary: string | null;
  recommendationContext: string | null;
  updatedAt: string;
}

interface RecommendationCandidateRow extends RowDataPacket {
  id: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  siteUrl: string | null;
  genres: string | null;
}

export interface UserAnimeStats {
  userId: number;
  totalCount: number;
  completedCount: number;
  watchingCount: number;
  droppedCount: number;
  totalWatchedEpisodes: number;
  totalWatchMinutes: number;
  avgScore: number | null;
  favoriteGenre: string | null;
  favoriteReleasePeriod: string | null;
  genreDistribution: JsonMap;
  genreWatchMinutes: JsonMap;
  genreAvgScore: JsonMap;
  releaseYearDistribution: JsonMap;
  avgReleaseYear: number | null;
  scoreDistribution: JsonMap;
  preferenceSummary: string;
  recommendationContext: string;
  updatedAt: string;
}

function parseJsonMap(value: string | JsonMap | null): JsonMap {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, mapValue]) => [key, Number(mapValue) || 0])
    );
  }

  try {
    return JSON.parse(value) as JsonMap;
  } catch {
    return {};
  }
}

function parseNullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsedNumber = Number(value);
  return Number.isFinite(parsedNumber) ? parsedNumber : null;
}

function toReleasePeriod(seasonYear: number | null) {
  if (!seasonYear) {
    return null;
  }

  const decade = Math.floor(seasonYear / 10) * 10;
  return `${decade}s`;
}

function toReleaseYearBucket(seasonYear: number | null) {
  if (!seasonYear) {
    return null;
  }

  return String(Math.floor(seasonYear / 10) * 10);
}

function incrementMap(map: JsonMap, key: string, amount: number) {
  map[key] = (map[key] ?? 0) + amount;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function getEffectiveWatchedEpisodes(anime: {
  status: string;
  progress: number;
  episodes: number | null;
}) {
  if (anime.episodes !== null && anime.episodes > 0) {
    if (anime.status === 'completed') {
      return anime.episodes;
    }

    return Math.min(anime.progress, anime.episodes);
  }

  return anime.progress;
}

function pickFavoriteKey(map: JsonMap) {
  let bestKey: string | null = null;
  let bestValue = -Infinity;

  for (const [key, value] of Object.entries(map)) {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }

  return bestKey;
}

function pickDisplayTitle(
  row: RecommendationCandidateRow,
  titleLanguage: 'ko' | 'en' | 'ja'
) {
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

function mapStatsRow(row: UserAnimeStatsRow): UserAnimeStats {
  return {
    userId: row.userId,
    totalCount: row.totalCount,
    completedCount: row.completedCount,
    watchingCount: row.watchingCount,
    droppedCount: row.droppedCount,
    totalWatchedEpisodes: row.totalWatchedEpisodes,
    totalWatchMinutes: row.totalWatchMinutes,
    avgScore: parseNullableNumber(row.avgScore),
    favoriteGenre: row.favoriteGenre,
    favoriteReleasePeriod: row.favoriteReleasePeriod,
    genreDistribution: parseJsonMap(row.genreDistribution),
    genreWatchMinutes: parseJsonMap(row.genreWatchMinutes),
    genreAvgScore: parseJsonMap(row.genreAvgScore),
    releaseYearDistribution: parseJsonMap(row.releaseYearDistribution),
    avgReleaseYear: parseNullableNumber(row.avgReleaseYear),
    scoreDistribution: parseJsonMap(row.scoreDistribution),
    preferenceSummary: row.preferenceSummary ?? '',
    recommendationContext: row.recommendationContext ?? '',
    updatedAt: row.updatedAt,
  };
}

export function buildPreferenceSummary(userStats: Omit<UserAnimeStats, 'preferenceSummary' | 'recommendationContext' | 'updatedAt'> | UserAnimeStats) {
  const topGenre = userStats.favoriteGenre ?? 'varied genres';
  const releasePeriod = userStats.favoriteReleasePeriod ?? 'various eras';
  const avgScoreText = userStats.avgScore !== null ? `${userStats.avgScore}` : 'unrated';

  return [
    `This user has ${userStats.totalCount} anime records and prefers ${topGenre}.`,
    `They mainly enjoy titles from ${releasePeriod}.`,
    `Average user score is ${avgScoreText} with ${userStats.totalWatchMinutes} total watch minutes.`,
  ].join(' ');
}

export function buildRecommendationContext(userStats: Omit<UserAnimeStats, 'preferenceSummary' | 'recommendationContext' | 'updatedAt'> | UserAnimeStats) {
  const topGenres = Object.entries(userStats.genreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre, count]) => `${genre}:${count}`)
    .join(', ');

  const topPeriods = Object.entries(userStats.releaseYearDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([period, count]) => `${period}:${count}`)
    .join(', ');

  return [
    `Top genres => ${topGenres || 'none'}`,
    `Preferred release periods => ${topPeriods || 'none'}`,
    `Average score => ${userStats.avgScore ?? 'none'}`,
    `Watch minutes => ${userStats.totalWatchMinutes}`,
  ].join(' | ');
}

export async function recalculateUserAnimeStats(userId: number) {
  const [rows] = await pool.query<UserHistoryAnimeRow[]>(
    `
    SELECT
      ual.anime_id AS animeId,
      ual.status,
      ual.score,
      ual.progress,
      ual.started_at AS startedAt,
      ual.completed_at AS completedAt,
      ual.updated_at AS updatedAt,
      a.episodes,
      a.duration,
      a.season_year AS seasonYear,
      ag.genre
    FROM user_anime_lists ual
    INNER JOIN anime a
      ON a.id = ual.anime_id
    LEFT JOIN anime_genres ag
      ON ag.anime_id = a.id
    WHERE ual.user_id = ?
    `,
    [userId]
  );

  const uniqueAnime = new Map<number, {
    status: string;
    score: number | null;
    progress: number;
    episodes: number | null;
    duration: number | null;
    seasonYear: number | null;
  }>();
  const animeGenres = new Map<number, Set<string>>();

  for (const row of rows) {
    if (!uniqueAnime.has(row.animeId)) {
      uniqueAnime.set(row.animeId, {
        status: row.status,
        score: parseNullableNumber(row.score),
        progress: row.progress,
        episodes: row.episodes,
        duration: row.duration,
        seasonYear: row.seasonYear,
      });
    }

    if (!animeGenres.has(row.animeId)) {
      animeGenres.set(row.animeId, new Set<string>());
    }

    if (row.genre) {
      animeGenres.get(row.animeId)?.add(row.genre);
    }
  }

  const totalCount = uniqueAnime.size;
  let completedCount = 0;
  let watchingCount = 0;
  let droppedCount = 0;
  let totalWatchedEpisodes = 0;
  let totalWatchMinutes = 0;
  let totalScore = 0;
  let scoredCount = 0;
  let totalReleaseYear = 0;
  let releaseYearCount = 0;
  const genreDistribution: JsonMap = {};
  const genreWatchMinutes: JsonMap = {};
  const genreScoreSums: JsonMap = {};
  const genreScoreCounts: JsonMap = {};
  const releaseYearDistribution: JsonMap = {};
  const scoreDistribution: JsonMap = {};

  for (const [animeId, anime] of uniqueAnime.entries()) {
    const effectiveWatchedEpisodes = getEffectiveWatchedEpisodes(anime);

    if (anime.status === 'completed') {
      completedCount += 1;
    }

    if (anime.status === 'watching') {
      watchingCount += 1;
    }

    if (anime.status === 'dropped') {
      droppedCount += 1;
    }

    totalWatchedEpisodes += effectiveWatchedEpisodes;
    totalWatchMinutes += effectiveWatchedEpisodes * (anime.duration ?? 0);

    if (anime.score !== null) {
      totalScore += anime.score;
      scoredCount += 1;
      incrementMap(scoreDistribution, String(Math.round(anime.score)), 1);
    }

    if (anime.seasonYear) {
      totalReleaseYear += anime.seasonYear;
      releaseYearCount += 1;
      const bucket = toReleaseYearBucket(anime.seasonYear);

      if (bucket) {
        incrementMap(releaseYearDistribution, bucket, 1);
      }
    }

    const genres = Array.from(animeGenres.get(animeId) ?? []);

    for (const genre of genres) {
      incrementMap(genreDistribution, genre, 1);
      incrementMap(genreWatchMinutes, genre, effectiveWatchedEpisodes * (anime.duration ?? 0));

      if (anime.score !== null) {
        incrementMap(genreScoreSums, genre, anime.score);
        incrementMap(genreScoreCounts, genre, 1);
      }
    }
  }

  const genreAvgScore: JsonMap = {};

  for (const genre of Object.keys(genreDistribution)) {
    const scoreCount = genreScoreCounts[genre] ?? 0;
    const scoreSum = genreScoreSums[genre] ?? 0;

    if (scoreCount > 0) {
      genreAvgScore[genre] = round2(scoreSum / scoreCount);
    }
  }

  const avgScore = scoredCount > 0 ? round2(totalScore / scoredCount) : null;
  const avgReleaseYear = releaseYearCount > 0 ? round2(totalReleaseYear / releaseYearCount) : null;
  const favoriteGenre = pickFavoriteKey(genreDistribution);
  const favoriteReleasePeriodBucket = pickFavoriteKey(releaseYearDistribution);
  const favoriteReleasePeriod = favoriteReleasePeriodBucket ? `${favoriteReleasePeriodBucket}s` : null;

  const computedStats = {
    userId,
    totalCount,
    completedCount,
    watchingCount,
    droppedCount,
    totalWatchedEpisodes,
    totalWatchMinutes,
    avgScore,
    favoriteGenre,
    favoriteReleasePeriod,
    genreDistribution,
    genreWatchMinutes,
    genreAvgScore,
    releaseYearDistribution,
    avgReleaseYear,
    scoreDistribution,
  };

  const preferenceSummary = buildPreferenceSummary({
    ...computedStats,
    preferenceSummary: '',
    recommendationContext: '',
    updatedAt: '',
  });
  const recommendationContext = buildRecommendationContext({
    ...computedStats,
    preferenceSummary: '',
    recommendationContext: '',
    updatedAt: '',
  });

  await pool.execute(
    `
    INSERT INTO user_anime_stats (
      user_id,
      total_count,
      completed_count,
      watching_count,
      dropped_count,
      total_watched_episodes,
      total_watch_minutes,
      avg_score,
      favorite_genre,
      favorite_release_period,
      genre_distribution,
      genre_watch_minutes,
      genre_avg_score,
      release_year_distribution,
      avg_release_year,
      score_distribution,
      preference_summary,
      recommendation_context
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_count = VALUES(total_count),
      completed_count = VALUES(completed_count),
      watching_count = VALUES(watching_count),
      dropped_count = VALUES(dropped_count),
      total_watched_episodes = VALUES(total_watched_episodes),
      total_watch_minutes = VALUES(total_watch_minutes),
      avg_score = VALUES(avg_score),
      favorite_genre = VALUES(favorite_genre),
      favorite_release_period = VALUES(favorite_release_period),
      genre_distribution = VALUES(genre_distribution),
      genre_watch_minutes = VALUES(genre_watch_minutes),
      genre_avg_score = VALUES(genre_avg_score),
      release_year_distribution = VALUES(release_year_distribution),
      avg_release_year = VALUES(avg_release_year),
      score_distribution = VALUES(score_distribution),
      preference_summary = VALUES(preference_summary),
      recommendation_context = VALUES(recommendation_context),
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      totalCount,
      completedCount,
      watchingCount,
      droppedCount,
      totalWatchedEpisodes,
      totalWatchMinutes,
      avgScore,
      favoriteGenre,
      favoriteReleasePeriod,
      JSON.stringify(genreDistribution),
      JSON.stringify(genreWatchMinutes),
      JSON.stringify(genreAvgScore),
      JSON.stringify(releaseYearDistribution),
      avgReleaseYear,
      JSON.stringify(scoreDistribution),
      preferenceSummary,
      recommendationContext,
    ]
  );

  return getUserAnimeStats(userId, true);
}

export async function getUserAnimeStats(userId: number, skipRecalculate = false): Promise<UserAnimeStats> {
  const [rows] = await pool.query<UserAnimeStatsRow[]>(
    `
    SELECT
      user_id AS userId,
      total_count AS totalCount,
      completed_count AS completedCount,
      watching_count AS watchingCount,
      dropped_count AS droppedCount,
      total_watched_episodes AS totalWatchedEpisodes,
      total_watch_minutes AS totalWatchMinutes,
      avg_score AS avgScore,
      favorite_genre AS favoriteGenre,
      favorite_release_period AS favoriteReleasePeriod,
      genre_distribution AS genreDistribution,
      genre_watch_minutes AS genreWatchMinutes,
      genre_avg_score AS genreAvgScore,
      release_year_distribution AS releaseYearDistribution,
      avg_release_year AS avgReleaseYear,
      score_distribution AS scoreDistribution,
      preference_summary AS preferenceSummary,
      recommendation_context AS recommendationContext,
      updated_at AS updatedAt
    FROM user_anime_stats
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  if (!rows[0] && !skipRecalculate) {
    return recalculateUserAnimeStats(userId);
  }

  if (!rows[0]) {
    return {
      userId,
      totalCount: 0,
      completedCount: 0,
      watchingCount: 0,
      droppedCount: 0,
      totalWatchedEpisodes: 0,
      totalWatchMinutes: 0,
      avgScore: null,
      favoriteGenre: null,
      favoriteReleasePeriod: null,
      genreDistribution: {},
      genreWatchMinutes: {},
      genreAvgScore: {},
      releaseYearDistribution: {},
      avgReleaseYear: null,
      scoreDistribution: {},
      preferenceSummary: '',
      recommendationContext: '',
      updatedAt: new Date().toISOString(),
    };
  }

  return mapStatsRow(rows[0]);
}

function computeRecommendationScore(
  candidate: RecommendationCandidateRow,
  stats: UserAnimeStats
) {
  const genres = candidate.genres ? candidate.genres.split(',').filter(Boolean) : [];
  let genreScore = 0;

  for (const genre of genres) {
    const watchedCount = stats.genreDistribution[genre] ?? 0;
    const watchMinutes = stats.genreWatchMinutes[genre] ?? 0;
    const avgGenreScore = stats.genreAvgScore[genre] ?? 0;

    genreScore += watchedCount * 1.5;
    genreScore += watchMinutes / 120;
    genreScore += avgGenreScore * 4;
  }

  const releaseBucket = toReleaseYearBucket(candidate.seasonYear);
  const releasePeriodScore = releaseBucket
    ? (stats.releaseYearDistribution[releaseBucket] ?? 0) * 2
    : 0;

  const averageScore = candidate.averageScore ?? candidate.meanScore ?? 0;
  const qualityScore = averageScore / 10;
  const popularityScore = Math.min((candidate.popularity ?? 0) / 5000, 10);

  return round2(genreScore + releasePeriodScore + qualityScore + popularityScore);
}

export async function getRecommendedAnime(
  userId: number,
  titleLanguage: 'ko' | 'en' | 'ja',
  limit = 20
) {
  const stats = await getUserAnimeStats(userId);

  const [rows] = await pool.query<RecommendationCandidateRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.episodes,
      a.duration,
      a.season,
      a.season_year AS seasonYear,
      a.format,
      a.status,
      a.average_score AS averageScore,
      a.mean_score AS meanScore,
      a.popularity,
      a.favourites,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.site_url AS siteUrl,
      GROUP_CONCAT(DISTINCT ag.genre ORDER BY ag.genre SEPARATOR ',') AS genres
    FROM anime a
    LEFT JOIN anime_genres ag
      ON ag.anime_id = a.id
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE a.is_adult = FALSE
      AND NOT EXISTS (
        SELECT 1
        FROM user_anime_lists ual
        WHERE ual.user_id = ?
          AND ual.anime_id = a.id
      )
    GROUP BY
      a.id,
      a.anilist_id,
      a.title_romaji,
      a.title_english,
      a.title_native,
      a.title_user_preferred,
      akt.full_title,
      a.episodes,
      a.duration,
      a.season,
      a.season_year,
      a.format,
      a.status,
      a.average_score,
      a.mean_score,
      a.popularity,
      a.favourites,
      a.cover_image_large,
      a.cover_image_extra_large,
      a.banner_image,
      a.site_url
    ORDER BY a.popularity DESC, a.average_score DESC, a.id DESC
    LIMIT 300
    `,
    [userId]
  );

  const scoredItems = rows
    .map((row) => ({
      id: row.id,
      anilistId: row.anilistId,
      title: pickDisplayTitle(row, titleLanguage),
      titles: {
        korean: row.titleKorean,
        english: row.titleEnglish,
        native: row.titleNative,
        romaji: row.titleRomaji,
        userPreferred: row.titleUserPreferred,
      },
      episodes: row.episodes,
      duration: row.duration,
      season: row.season,
      seasonYear: row.seasonYear,
      format: row.format,
      status: row.status,
      averageScore: row.averageScore,
      meanScore: row.meanScore,
      popularity: row.popularity,
      favourites: row.favourites,
      coverImageLarge: row.coverImageLarge,
      coverImageExtraLarge: row.coverImageExtraLarge,
      bannerImage: row.bannerImage,
      siteUrl: row.siteUrl,
      genres: row.genres ? row.genres.split(',').filter(Boolean) : [],
      recommendationScore: computeRecommendationScore(row, stats),
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore || (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, limit);

  return {
    stats,
    items: scoredItems,
  };
}
