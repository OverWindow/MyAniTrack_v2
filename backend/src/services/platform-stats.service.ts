import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface PlatformStatsRow extends RowDataPacket {
  registeredUserCount: number;
  storedAnimeCount: number;
  translatedKoreanTitleCount: number;
  castSyncedAnimeCount: number;
  characterCount: number;
  voiceActorCount: number;
}

interface PopularAnimeRow extends RowDataPacket {
  id: number;
  anilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  coverImageLarge: string;
  popularity: number;
}

function pickPopularAnimeTitle(row: PopularAnimeRow) {
  return row.titleKorean
    ?? row.titleEnglish
    ?? row.titleRomaji
    ?? row.titleUserPreferred
    ?? row.titleNative
    ?? 'Unknown title';
}

export async function getPlatformStats() {
  const [rows] = await pool.query<PlatformStatsRow[]>(
    `
    SELECT
      (SELECT COUNT(*) FROM users) AS registeredUserCount,
      (SELECT COUNT(*) FROM anime) AS storedAnimeCount,
      (SELECT COUNT(*) FROM anime_korean_titles) AS translatedKoreanTitleCount,
      (
        SELECT COUNT(*)
        FROM anime_cast_sync_state
        WHERE status = 'success'
      ) AS castSyncedAnimeCount,
      (SELECT COUNT(*) FROM characters) AS characterCount,
      (SELECT COUNT(*) FROM voice_actors) AS voiceActorCount
    `
  );

  const stats = rows[0];
  const storedAnimeCount = stats?.storedAnimeCount ?? 0;
  const translatedKoreanTitleCount = stats?.translatedKoreanTitleCount ?? 0;
  const castSyncedAnimeCount = stats?.castSyncedAnimeCount ?? 0;

  return {
    registeredUserCount: stats?.registeredUserCount ?? 0,
    storedAnimeCount,
    translatedKoreanTitleCount,
    translationProgressRate: storedAnimeCount > 0
      ? Number(((translatedKoreanTitleCount / storedAnimeCount) * 100).toFixed(2))
      : 0,
    castSyncedAnimeCount,
    castSyncProgressRate: storedAnimeCount > 0
      ? Number(((castSyncedAnimeCount / storedAnimeCount) * 100).toFixed(2))
      : 0,
    characterCount: stats?.characterCount ?? 0,
    voiceActorCount: stats?.voiceActorCount ?? 0,
  };
}

export async function getTopPopularAnime(limit = 10) {
  const [rows] = await pool.query<PopularAnimeRow[]>(
    `
    SELECT
      a.id,
      a.anilist_id AS anilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.cover_image_large AS coverImageLarge,
      a.popularity
    FROM anime a
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE a.is_adult = FALSE
      AND a.cover_image_large IS NOT NULL
      AND COALESCE(
        akt.full_title,
        a.title_english,
        a.title_romaji,
        a.title_user_preferred,
        a.title_native
      ) IS NOT NULL
    ORDER BY a.popularity DESC, a.id DESC
    LIMIT ?
    `,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    anilistId: row.anilistId,
    title: pickPopularAnimeTitle(row),
    titles: {
      korean: row.titleKorean,
      english: row.titleEnglish,
      native: row.titleNative,
      romaji: row.titleRomaji,
      userPreferred: row.titleUserPreferred,
    },
    coverImageLarge: row.coverImageLarge,
    popularity: row.popularity,
  }));
}
