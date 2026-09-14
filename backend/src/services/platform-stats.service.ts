import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface PlatformStatsRow extends RowDataPacket {
  registeredUserCount: number; storedAnimeCount: number; koreanTitleCount: number;
  studioCount: number; mappedAnimeCount: number; animeRelationCount: number;
  characterCount: number; voiceActorCount: number; pendingSubmissionCount: number;
}

interface PopularAnimeRow extends RowDataPacket {
  id: number; titleRomaji: string | null; titleEnglish: string | null; titleNative: string | null;
  titleUserPreferred: string | null; titleKorean: string | null; coverImageLarge: string;
  collectionCount: number; communityAverageScore: number | null; ratingCount: number;
}

export async function getPlatformStats() {
  const [rows] = await pool.query<PlatformStatsRow[]>(`
    SELECT
      (SELECT COUNT(*) FROM users) AS registeredUserCount,
      (SELECT COUNT(*) FROM anime) AS storedAnimeCount,
      (SELECT COUNT(*) FROM anime_korean_titles) AS koreanTitleCount,
      (SELECT COUNT(*) FROM studios) AS studioCount,
      (SELECT COUNT(DISTINCT anime_id) FROM anime_studios) AS mappedAnimeCount,
      (SELECT COUNT(*) FROM anime_relations) AS animeRelationCount,
      (SELECT COUNT(*) FROM characters) AS characterCount,
      (SELECT COUNT(*) FROM voice_actors) AS voiceActorCount,
      (SELECT COUNT(*) FROM catalog_change_requests WHERE status = 'PENDING') AS pendingSubmissionCount
  `);
  const row = rows[0];
  return {
    registeredUserCount: Number(row?.registeredUserCount ?? 0), storedAnimeCount: Number(row?.storedAnimeCount ?? 0),
    koreanTitleCount: Number(row?.koreanTitleCount ?? 0), studioCount: Number(row?.studioCount ?? 0),
    mappedAnimeCount: Number(row?.mappedAnimeCount ?? 0), animeRelationCount: Number(row?.animeRelationCount ?? 0),
    characterCount: Number(row?.characterCount ?? 0), voiceActorCount: Number(row?.voiceActorCount ?? 0),
    pendingSubmissionCount: Number(row?.pendingSubmissionCount ?? 0),
  };
}

export async function getTopPopularAnime(limit = 10) {
  const [rows] = await pool.query<PopularAnimeRow[]>(`
    SELECT a.id, a.title_romaji AS titleRomaji, a.title_english AS titleEnglish,
      a.title_native AS titleNative, a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean, COALESCE(a.cover_image_extra_large, a.cover_image_large) AS coverImageLarge,
      COALESCE(acm.collection_count, 0) AS collectionCount,
      acm.community_average_score AS communityAverageScore, COALESCE(acm.rating_count, 0) AS ratingCount
    FROM anime a
    LEFT JOIN anime_korean_titles akt ON akt.anime_id = a.id AND akt.is_primary = TRUE
    LEFT JOIN anime_community_metrics acm ON acm.anime_id = a.id
    WHERE a.is_adult = FALSE AND a.app_visible = TRUE
      AND (a.cover_image_extra_large IS NOT NULL OR a.cover_image_large IS NOT NULL)
    ORDER BY acm.collection_count DESC, acm.community_average_score DESC, a.id DESC
    LIMIT ?
  `, [limit]);
  return rows.map((row) => ({
    id: row.id,
    title: row.titleKorean ?? row.titleEnglish ?? row.titleRomaji ?? row.titleUserPreferred ?? row.titleNative ?? 'Unknown title',
    titles: { korean: row.titleKorean, english: row.titleEnglish, native: row.titleNative, romaji: row.titleRomaji, userPreferred: row.titleUserPreferred },
    coverImageLarge: row.coverImageLarge, collectionCount: Number(row.collectionCount),
    communityAverageScore: row.communityAverageScore === null ? null : Number(row.communityAverageScore), ratingCount: Number(row.ratingCount),
  }));
}
