import {
  UserAnimeListSortOption,
  UserAnimeListTitleLanguage,
} from './user-anime-list.service';
import type { StudioStatsSort } from './user-studio-stats.service';

type SampleStatus = 'planned' | 'watching' | 'completed' | 'paused' | 'dropped';

interface SampleAnimeItem {
  id: number;
  userId: number;
  animeId: number;
  status: SampleStatus;
  score: number | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  genres: string[];
  studio: {
    id: number;
    name: string;
  };
  anime: {
    id: number;
    anilistId: number;
    title: string;
    titles: {
      korean: string | null;
      english: string | null;
      native: string | null;
      romaji: string | null;
      userPreferred: string | null;
    };
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
    isAdult: boolean;
  };
}

interface SampleListParams {
  sort: UserAnimeListSortOption;
  titleLanguage: UserAnimeListTitleLanguage;
  genre?: string;
  year?: number;
  score?: number;
  limit: number;
}

const SAMPLE_USER_ID = 0;
const SAMPLE_UPDATED_AT = '2026-07-07T00:00:00.000Z';

export const guestSampleUser = {
  id: SAMPLE_USER_ID,
  username: 'sample_viewer',
  profileImageUrl: null,
  bio: 'Guest sample profile for previewing MyAniTrack collection and analytics.',
  createdAt: SAMPLE_UPDATED_AT,
};

const sampleItems: SampleAnimeItem[] = [
  {
    id: 1,
    userId: SAMPLE_USER_ID,
    animeId: 101,
    status: 'completed',
    score: 9.4,
    progress: 25,
    startedAt: '2024-01-05',
    completedAt: '2024-01-28',
    notes: 'Dense political drama with a memorable final arc.',
    createdAt: '2024-01-05T12:00:00.000Z',
    updatedAt: '2024-01-28T21:30:00.000Z',
    genres: ['Action', 'Drama', 'Fantasy'],
    studio: { id: 1, name: 'WIT Studio' },
    anime: {
      id: 101,
      anilistId: 16498,
      title: 'Attack on Titan',
      titles: {
        korean: '진격의 거인',
        english: 'Attack on Titan',
        native: '進撃の巨人',
        romaji: 'Shingeki no Kyojin',
        userPreferred: 'Attack on Titan',
      },
      episodes: 25,
      duration: 24,
      season: 'SPRING',
      seasonYear: 2013,
      format: 'TV',
      status: 'FINISHED',
      averageScore: 84,
      meanScore: 84,
      popularity: 860000,
      favourites: 71000,
      coverImageLarge: null,
      coverImageExtraLarge: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/anime/16498',
      isAdult: false,
    },
  },
  {
    id: 2,
    userId: SAMPLE_USER_ID,
    animeId: 102,
    status: 'completed',
    score: 9.1,
    progress: 12,
    startedAt: '2024-03-01',
    completedAt: '2024-03-15',
    notes: 'Quiet, emotional, and beautifully paced.',
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2024-03-15T22:10:00.000Z',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    studio: { id: 2, name: 'Madhouse' },
    anime: {
      id: 102,
      anilistId: 154587,
      title: 'Frieren: Beyond Journey\'s End',
      titles: {
        korean: '장송의 프리렌',
        english: 'Frieren: Beyond Journey\'s End',
        native: '葬送のフリーレン',
        romaji: 'Sousou no Frieren',
        userPreferred: 'Frieren: Beyond Journey\'s End',
      },
      episodes: 28,
      duration: 24,
      season: 'FALL',
      seasonYear: 2023,
      format: 'TV',
      status: 'FINISHED',
      averageScore: 89,
      meanScore: 89,
      popularity: 410000,
      favourites: 39000,
      coverImageLarge: null,
      coverImageExtraLarge: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/anime/154587',
      isAdult: false,
    },
  },
  {
    id: 3,
    userId: SAMPLE_USER_ID,
    animeId: 103,
    status: 'watching',
    score: 8.7,
    progress: 8,
    startedAt: '2026-06-21',
    completedAt: null,
    notes: 'Great week-to-week watch.',
    createdAt: '2026-06-21T18:20:00.000Z',
    updatedAt: '2026-07-06T20:00:00.000Z',
    genres: ['Action', 'Supernatural'],
    studio: { id: 3, name: 'MAPPA' },
    anime: {
      id: 103,
      anilistId: 113415,
      title: 'Jujutsu Kaisen',
      titles: {
        korean: '주술회전',
        english: 'Jujutsu Kaisen',
        native: '呪術廻戦',
        romaji: 'Jujutsu Kaisen',
        userPreferred: 'Jujutsu Kaisen',
      },
      episodes: 24,
      duration: 24,
      season: 'FALL',
      seasonYear: 2020,
      format: 'TV',
      status: 'FINISHED',
      averageScore: 84,
      meanScore: 84,
      popularity: 640000,
      favourites: 46000,
      coverImageLarge: null,
      coverImageExtraLarge: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/anime/113415',
      isAdult: false,
    },
  },
  {
    id: 4,
    userId: SAMPLE_USER_ID,
    animeId: 104,
    status: 'completed',
    score: 8.9,
    progress: 13,
    startedAt: '2025-02-01',
    completedAt: '2025-02-12',
    notes: 'Stylish character drama with sharp direction.',
    createdAt: '2025-02-01T09:00:00.000Z',
    updatedAt: '2025-02-12T23:00:00.000Z',
    genres: ['Drama', 'Music'],
    studio: { id: 4, name: 'Doga Kobo' },
    anime: {
      id: 104,
      anilistId: 150672,
      title: 'Oshi no Ko',
      titles: {
        korean: '최애의 아이',
        english: 'Oshi no Ko',
        native: '【推しの子】',
        romaji: 'Oshi no Ko',
        userPreferred: 'Oshi no Ko',
      },
      episodes: 11,
      duration: 24,
      season: 'SPRING',
      seasonYear: 2023,
      format: 'TV',
      status: 'FINISHED',
      averageScore: 84,
      meanScore: 84,
      popularity: 330000,
      favourites: 26000,
      coverImageLarge: null,
      coverImageExtraLarge: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/anime/150672',
      isAdult: false,
    },
  },
  {
    id: 5,
    userId: SAMPLE_USER_ID,
    animeId: 105,
    status: 'completed',
    score: 8.5,
    progress: 1,
    startedAt: '2023-12-08',
    completedAt: '2023-12-08',
    notes: 'Movie slot for format distribution preview.',
    createdAt: '2023-12-08T15:00:00.000Z',
    updatedAt: '2023-12-08T17:30:00.000Z',
    genres: ['Drama', 'Romance', 'Supernatural'],
    studio: { id: 5, name: 'CoMix Wave Films' },
    anime: {
      id: 105,
      anilistId: 21519,
      title: 'Your Name.',
      titles: {
        korean: '너의 이름은.',
        english: 'Your Name.',
        native: '君の名は。',
        romaji: 'Kimi no Na wa.',
        userPreferred: 'Your Name.',
      },
      episodes: 1,
      duration: 107,
      season: 'SUMMER',
      seasonYear: 2016,
      format: 'MOVIE',
      status: 'FINISHED',
      averageScore: 84,
      meanScore: 84,
      popularity: 580000,
      favourites: 40000,
      coverImageLarge: null,
      coverImageExtraLarge: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/anime/21519',
      isAdult: false,
    },
  },
  {
    id: 6,
    userId: SAMPLE_USER_ID,
    animeId: 106,
    status: 'planned',
    score: null,
    progress: 0,
    startedAt: null,
    completedAt: null,
    notes: 'Pinned as a planned show.',
    createdAt: '2026-07-01T11:00:00.000Z',
    updatedAt: '2026-07-01T11:00:00.000Z',
    genres: ['Adventure', 'Fantasy'],
    studio: { id: 6, name: 'Kyoto Animation' },
    anime: {
      id: 106,
      anilistId: 21827,
      title: 'Violet Evergarden',
      titles: {
        korean: '바이올렛 에버가든',
        english: 'Violet Evergarden',
        native: 'ヴァイオレット・エヴァーガーデン',
        romaji: 'Violet Evergarden',
        userPreferred: 'Violet Evergarden',
      },
      episodes: 13,
      duration: 24,
      season: 'WINTER',
      seasonYear: 2018,
      format: 'TV',
      status: 'FINISHED',
      averageScore: 84,
      meanScore: 84,
      popularity: 360000,
      favourites: 32000,
      coverImageLarge: null,
      coverImageExtraLarge: null,
      bannerImage: null,
      siteUrl: 'https://anilist.co/anime/21827',
      isAdult: false,
    },
  },
];

function pickTitle(item: SampleAnimeItem, titleLanguage: UserAnimeListTitleLanguage) {
  if (titleLanguage === 'ko') {
    return item.anime.titles.korean || item.anime.title;
  }

  if (titleLanguage === 'ja') {
    return item.anime.titles.native || item.anime.title;
  }

  return item.anime.titles.english || item.anime.title;
}

function toPublicItem(item: SampleAnimeItem, titleLanguage: UserAnimeListTitleLanguage) {
  const { genres: _genres, studio: _studio, ...publicItem } = item;

  return {
    ...publicItem,
    anime: {
      ...item.anime,
      title: pickTitle(item, titleLanguage),
    },
  };
}

function roundMetric(value: number | null, fractionDigits = 2) {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(fractionDigits));
}

function getWatchedEpisodes(item: SampleAnimeItem) {
  if (item.status === 'completed' && item.anime.episodes) {
    return item.anime.episodes;
  }

  return item.progress;
}

function getWatchMinutes(item: SampleAnimeItem) {
  return getWatchedEpisodes(item) * (item.anime.duration ?? 0);
}

function getFormatLabel(format: string) {
  const labels: Record<string, string> = {
    TV: 'TV',
    MOVIE: 'Movie',
    OVA: 'OVA',
    ONA: 'ONA',
    SPECIAL: 'Special',
    TV_SHORT: 'TV Short',
    MUSIC: 'Music',
  };

  return labels[format] ?? format;
}

function countBy<T extends string | number>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[String(value)] = (acc[String(value)] ?? 0) + 1;
    return acc;
  }, {});
}

function getRatedItems(status: 'all' | 'completed' = 'completed') {
  return sampleItems.filter((item) => (
    item.score !== null
    && (status === 'all' || item.status === 'completed')
  ));
}

export function getGuestSampleAnimeList(params: SampleListParams) {
  const filteredItems = sampleItems
    .filter((item) => !params.genre || item.genres.includes(params.genre))
    .filter((item) => !params.year || item.anime.seasonYear === params.year)
    .filter((item) => !params.score || Math.floor(item.score ?? 0) === params.score);

  const sortedItems = filteredItems.slice().sort((a, b) => {
    if (params.sort === 'score') {
      return (b.score ?? -1) - (a.score ?? -1) || b.updatedAt.localeCompare(a.updatedAt);
    }

    if (params.sort === 'scoreAsc') {
      return (a.score ?? 999) - (b.score ?? 999) || b.updatedAt.localeCompare(a.updatedAt);
    }

    if (params.sort === 'added') {
      return b.createdAt.localeCompare(a.createdAt);
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return {
    user: guestSampleUser,
    items: sortedItems.slice(0, params.limit).map((item) => toPublicItem(item, params.titleLanguage)),
    pageInfo: {
      hasNext: false,
      nextCursor: null,
      limit: params.limit,
      sort: params.sort,
      titleLanguage: params.titleLanguage,
      genre: params.genre ?? null,
      year: params.year ?? null,
      score: params.score ?? null,
    },
  };
}

export function getGuestSampleAnimeStats() {
  const completedItems = sampleItems.filter((item) => item.status === 'completed');
  const watchingItems = sampleItems.filter((item) => item.status === 'watching');
  const droppedItems = sampleItems.filter((item) => item.status === 'dropped');
  const ratedItems = sampleItems.filter((item) => item.score !== null);
  const genres = sampleItems.flatMap((item) => item.genres);
  const genreDistribution = countBy(genres);
  const releaseYearDistribution = countBy(
    sampleItems
      .map((item) => item.anime.seasonYear)
      .filter((year): year is number => typeof year === 'number')
  );
  const scoreDistribution = countBy(
    ratedItems.map((item) => Math.floor(item.score ?? 0))
  );
  const genreWatchMinutes = sampleItems.reduce<Record<string, number>>((acc, item) => {
    for (const genre of item.genres) {
      acc[genre] = (acc[genre] ?? 0) + getWatchMinutes(item);
    }

    return acc;
  }, {});
  const genreAvgScore = Object.fromEntries(
    Object.keys(genreDistribution).map((genre) => {
      const genreRatedItems = ratedItems.filter((item) => item.genres.includes(genre));
      const average = genreRatedItems.length > 0
        ? genreRatedItems.reduce((sum, item) => sum + (item.score ?? 0), 0) / genreRatedItems.length
        : 0;

      return [genre, roundMetric(average)];
    })
  );
  const favoriteGenre = Object.entries(genreDistribution)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const avgReleaseYear = sampleItems.length > 0
    ? roundMetric(
      sampleItems.reduce((sum, item) => sum + (item.anime.seasonYear ?? 0), 0) / sampleItems.length,
      0
    )
    : null;

  return {
    userId: SAMPLE_USER_ID,
    totalCount: sampleItems.length,
    completedCount: completedItems.length,
    watchingCount: watchingItems.length,
    droppedCount: droppedItems.length,
    totalWatchedEpisodes: sampleItems.reduce((sum, item) => sum + getWatchedEpisodes(item), 0),
    totalWatchMinutes: sampleItems.reduce((sum, item) => sum + getWatchMinutes(item), 0),
    avgScore: ratedItems.length > 0
      ? roundMetric(ratedItems.reduce((sum, item) => sum + (item.score ?? 0), 0) / ratedItems.length)
      : null,
    favoriteGenre,
    favoriteReleasePeriod: '2020s',
    genreDistribution,
    genreWatchMinutes,
    genreAvgScore,
    releaseYearDistribution,
    avgReleaseYear,
    scoreDistribution,
    topWatchedGenreTopAnime: sampleItems
      .filter((item) => favoriteGenre && item.genres.includes(favoriteGenre))
      .slice(0, 3)
      .map((item) => ({
        animeId: item.animeId,
        title: item.anime.title,
        coverImageLarge: item.anime.coverImageLarge,
        score: item.score,
        genre: favoriteGenre ?? '',
      })),
    topRatedGenreTopAnime: ratedItems
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3)
      .map((item) => ({
        animeId: item.animeId,
        title: item.anime.title,
        coverImageLarge: item.anime.coverImageLarge,
        score: item.score,
        genre: item.genres[0] ?? '',
      })),
    preferenceSummary: 'Sample viewer prefers drama-heavy fantasy and action shows with strong production identity.',
    recommendationContext: 'Guest sample data for previewing collection analytics before signup.',
    updatedAt: SAMPLE_UPDATED_AT,
  };
}

export function getGuestSampleGenreBubbleChart() {
  const stats = getGuestSampleAnimeStats();
  const totalGenreCount = Object.values(stats.genreDistribution).reduce((sum, count) => sum + count, 0);
  const items = Object.entries(stats.genreDistribution)
    .map(([genre, animeCount]) => ({
      genre,
      animeCount,
      percentage: totalGenreCount > 0 ? roundMetric((animeCount / totalGenreCount) * 100) : 0,
      watchMinutes: stats.genreWatchMinutes[genre] ?? 0,
      watchHours: roundMetric((stats.genreWatchMinutes[genre] ?? 0) / 60),
      averageScore: stats.genreAvgScore[genre] ?? null,
      communityAverageScore: genre === 'Drama' ? 8.1 : genre === 'Fantasy' ? 8.0 : 7.8,
      preferenceScore: roundMetric((stats.genreAvgScore[genre] ?? 0) * animeCount),
      topAnime: sampleItems
        .filter((item) => item.genres.includes(genre))
        .slice(0, 3)
        .map((item) => ({
          animeId: item.animeId,
          title: item.anime.title,
          coverImageLarge: item.anime.coverImageLarge,
          score: item.score,
        })),
    }))
    .sort((a, b) => (b.preferenceScore ?? 0) - (a.preferenceScore ?? 0) || b.animeCount - a.animeCount);

  return {
    userId: SAMPLE_USER_ID,
    status: 'completed',
    weighting: 'fractional',
    communityScore: 'average',
    minCount: 1,
    topLimit: 3,
    items,
    summary: {
      genreCount: items.length,
      topGenre: items[0]?.genre ?? null,
      totalGenreCount,
    },
  };
}

export function getGuestSampleYearlyScoreStats(status: 'all' | 'completed' = 'completed', minRatedAnimeCount = 1) {
  const ratedItems = getRatedItems(status);
  const byYear = new Map<number, SampleAnimeItem[]>();

  for (const item of ratedItems) {
    const year = item.anime.seasonYear;

    if (!year) {
      continue;
    }

    byYear.set(year, [...(byYear.get(year) ?? []), item]);
  }

  const items = Array.from(byYear.entries())
    .map(([year, yearItems]) => {
      const averageScore = roundMetric(
        yearItems.reduce((sum, item) => sum + (item.score ?? 0), 0) / yearItems.length
      );
      const communityAverageScore = roundMetric(
        yearItems.reduce((sum, item) => sum + ((item.anime.averageScore ?? 0) / 10), 0) / yearItems.length
      );

      return {
        year,
        animeCount: yearItems.length,
        ratedAnimeCount: yearItems.length,
        averageScore,
        communityAverageScore,
        preferenceDelta: averageScore !== null && communityAverageScore !== null
          ? roundMetric(averageScore - communityAverageScore)
          : null,
      };
    })
    .filter((item) => item.ratedAnimeCount >= minRatedAnimeCount)
    .sort((a, b) => a.year - b.year);
  const scoredItems = items.filter((item) => item.averageScore !== null);
  const bestItem = scoredItems.slice().sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))[0];
  const worstItem = scoredItems.slice().sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0))[0];

  return {
    userId: SAMPLE_USER_ID,
    status,
    minRatedAnimeCount,
    items,
    summary: {
      yearCount: items.length,
      bestYear: bestItem?.year ?? null,
      worstYear: worstItem?.year ?? null,
      averageScore: scoredItems.length > 0
        ? roundMetric(scoredItems.reduce((sum, item) => sum + (item.averageScore ?? 0), 0) / scoredItems.length)
        : null,
    },
  };
}

export function getGuestSampleFormatStats(status: 'all' | 'completed' = 'completed', minCount = 1) {
  const sourceItems = sampleItems.filter((item) => status === 'all' || item.status === 'completed');
  const byFormat = new Map<string, SampleAnimeItem[]>();

  for (const item of sourceItems) {
    const format = item.anime.format ?? 'UNKNOWN';
    byFormat.set(format, [...(byFormat.get(format) ?? []), item]);
  }

  const totalAnimeCount = sourceItems.length;
  const totalWatchMinutes = sourceItems.reduce((sum, item) => sum + getWatchMinutes(item), 0);
  const items = Array.from(byFormat.entries())
    .map(([format, formatItems]) => {
      const ratedItems = formatItems.filter((item) => item.score !== null);
      const watchMinutes = formatItems.reduce((sum, item) => sum + getWatchMinutes(item), 0);

      return {
        format,
        label: getFormatLabel(format),
        animeCount: formatItems.length,
        percentage: totalAnimeCount > 0 ? roundMetric((formatItems.length / totalAnimeCount) * 100) : 0,
        ratedAnimeCount: ratedItems.length,
        averageScore: ratedItems.length > 0
          ? roundMetric(ratedItems.reduce((sum, item) => sum + (item.score ?? 0), 0) / ratedItems.length)
          : null,
        watchedEpisodes: formatItems.reduce((sum, item) => sum + getWatchedEpisodes(item), 0),
        watchMinutes,
        watchHours: roundMetric(watchMinutes / 60),
      };
    })
    .filter((item) => item.animeCount >= minCount)
    .sort((a, b) => b.animeCount - a.animeCount || a.format.localeCompare(b.format));

  return {
    userId: SAMPLE_USER_ID,
    status,
    minCount,
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

export function getGuestSampleStudioRanking(sort: StudioStatsSort = 'count', limit = 20) {
  const byStudio = new Map<number, SampleAnimeItem[]>();

  for (const item of sampleItems) {
    byStudio.set(item.studio.id, [...(byStudio.get(item.studio.id) ?? []), item]);
  }

  const allItems = Array.from(byStudio.entries())
    .map(([studioId, studioItems]) => {
      const ratedItems = studioItems.filter((item) => item.score !== null);
      const watchMinutes = studioItems.reduce((sum, item) => sum + getWatchMinutes(item), 0);
      const releaseYears = studioItems
        .map((item) => item.anime.seasonYear)
        .filter((year): year is number => typeof year === 'number');
      const scoreSum = ratedItems.length > 0
        ? ratedItems.reduce((sum, item) => sum + (item.score ?? 0), 0)
        : null;

      return {
        studio: {
          id: studioId,
          anilistId: studioId,
          name: studioItems[0]?.studio.name ?? 'Unknown Studio',
          isAnimationStudio: true,
          siteUrl: null,
        },
        animeCount: studioItems.length,
        completedAnimeCount: studioItems.filter((item) => item.status === 'completed').length,
        ratedAnimeCount: ratedItems.length,
        scoreSum: roundMetric(scoreSum),
        averageScore: ratedItems.length > 0
          ? roundMetric((scoreSum ?? 0) / ratedItems.length)
          : null,
        communityAverageScore: null,
        totalWatchedEpisodes: studioItems.reduce((sum, item) => sum + getWatchedEpisodes(item), 0),
        totalWatchMinutes: watchMinutes,
        totalWatchHours: roundMetric(watchMinutes / 60),
        firstReleaseYear: releaseYears.length > 0 ? Math.min(...releaseYears) : null,
        latestReleaseYear: releaseYears.length > 0 ? Math.max(...releaseYears) : null,
      };
    });

  allItems.sort((a, b) => {
    if (sort === 'score') {
      return (
        (b.averageScore ?? -1) - (a.averageScore ?? -1)
        || b.ratedAnimeCount - a.ratedAnimeCount
        || b.animeCount - a.animeCount
        || b.studio.id - a.studio.id
      );
    }

    if (sort === 'watchTime') {
      return (
        b.totalWatchMinutes - a.totalWatchMinutes
        || b.animeCount - a.animeCount
        || b.studio.id - a.studio.id
      );
    }

    return b.animeCount - a.animeCount || b.studio.id - a.studio.id;
  });

  return {
    success: true,
    items: allItems.slice(0, limit),
    pageInfo: {
      hasNext: false,
      nextCursor: null,
      limit,
      sort,
      status: 'all',
      mainOnly: true,
      minAnimeCount: 1,
      minRatedAnimeCount: 1,
    },
    summary: {
      studioCount: allItems.length,
      source: {
        status: 'all',
        mainOnly: true,
      },
    },
  };
}

export function getGuestSampleOverview() {
  return {
    user: guestSampleUser,
    collection: getGuestSampleAnimeList({
      sort: 'latest',
      titleLanguage: 'ko',
      limit: 6,
    }),
    stats: getGuestSampleAnimeStats(),
    genreBubble: getGuestSampleGenreBubbleChart(),
    yearlyScores: getGuestSampleYearlyScoreStats('completed', 1),
    formatDistribution: getGuestSampleFormatStats('completed', 1),
    studios: getGuestSampleStudioRanking('count', 10),
  };
}
