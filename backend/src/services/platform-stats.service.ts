import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface PlatformStatsRow extends RowDataPacket {
  registeredUserCount: number;
  storedAnimeCount: number;
  translatedKoreanTitleCount: number;
  studioCount: number;
  studioSyncedAnimeCount: number;
  studioMappedAnimeCount: number;
  studioPendingAnimeCount: number;
  studioFailedAnimeCount: number;
  castSyncedAnimeCount: number;
  relationSyncedAnimeCount: number;
  relationPendingAnimeCount: number;
  relationSyncingAnimeCount: number;
  relationFailedAnimeCount: number;
  animeRelationCount: number;
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
      (SELECT COUNT(*) FROM studios) AS studioCount,
      (
        SELECT COUNT(*)
        FROM anime_studio_sync_state
        WHERE status = 'success'
      ) AS studioSyncedAnimeCount,
      (
        SELECT COUNT(DISTINCT anime_id)
        FROM anime_studios
      ) AS studioMappedAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime a
        LEFT JOIN anime_studio_sync_state ass
          ON ass.anime_id = a.id
        WHERE ass.anime_id IS NULL
          OR ass.status = 'pending'
      ) AS studioPendingAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime_studio_sync_state
        WHERE status = 'failed'
      ) AS studioFailedAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime_cast_sync_state
        WHERE status = 'success'
      ) AS castSyncedAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime_relation_sync_state
        WHERE status = 'success'
      ) AS relationSyncedAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime a
        LEFT JOIN anime_relation_sync_state arss
          ON arss.anime_id = a.id
        WHERE arss.anime_id IS NULL
          OR arss.status = 'pending'
      ) AS relationPendingAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime_relation_sync_state
        WHERE status = 'syncing'
      ) AS relationSyncingAnimeCount,
      (
        SELECT COUNT(*)
        FROM anime_relation_sync_state
        WHERE status = 'failed'
      ) AS relationFailedAnimeCount,
      (SELECT COUNT(*) FROM anime_relations) AS animeRelationCount,
      (SELECT COUNT(*) FROM characters) AS characterCount,
      (SELECT COUNT(*) FROM voice_actors) AS voiceActorCount
    `
  );

  const stats = rows[0];
  const storedAnimeCount = stats?.storedAnimeCount ?? 0;
  const translatedKoreanTitleCount = stats?.translatedKoreanTitleCount ?? 0;
  const studioSyncedAnimeCount = stats?.studioSyncedAnimeCount ?? 0;
  const castSyncedAnimeCount = stats?.castSyncedAnimeCount ?? 0;
  const relationSyncedAnimeCount = stats?.relationSyncedAnimeCount ?? 0;

  return {
    registeredUserCount: stats?.registeredUserCount ?? 0,
    storedAnimeCount,
    translatedKoreanTitleCount,
    translationProgressRate: storedAnimeCount > 0
      ? Number(((translatedKoreanTitleCount / storedAnimeCount) * 100).toFixed(2))
      : 0,
    studioCount: stats?.studioCount ?? 0,
    studioSyncedAnimeCount,
    studioMappedAnimeCount: stats?.studioMappedAnimeCount ?? 0,
    studioPendingAnimeCount: stats?.studioPendingAnimeCount ?? 0,
    studioFailedAnimeCount: stats?.studioFailedAnimeCount ?? 0,
    studioSyncProgressRate: storedAnimeCount > 0
      ? Number(((studioSyncedAnimeCount / storedAnimeCount) * 100).toFixed(2))
      : 0,
    castSyncedAnimeCount,
    castSyncProgressRate: storedAnimeCount > 0
      ? Number(((castSyncedAnimeCount / storedAnimeCount) * 100).toFixed(2))
      : 0,
    relationSyncedAnimeCount,
    relationPendingAnimeCount: stats?.relationPendingAnimeCount ?? 0,
    relationSyncingAnimeCount: stats?.relationSyncingAnimeCount ?? 0,
    relationFailedAnimeCount: stats?.relationFailedAnimeCount ?? 0,
    animeRelationCount: stats?.animeRelationCount ?? 0,
    relationSyncProgressRate: storedAnimeCount > 0
      ? Number(((relationSyncedAnimeCount / storedAnimeCount) * 100).toFixed(2))
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
