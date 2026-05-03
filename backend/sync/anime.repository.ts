import { PoolConnection } from 'mysql2/promise';
import { pool } from '../config/db';
import { AniListAnime } from './anilist.client';

function fromUnixTimestampToMySQLDateTime(unixTs?: number | null): string | null {
  if (!unixTs) return null;

  const date = new Date(unixTs * 1000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function dedupeAnimeTags(tags: NonNullable<AniListAnime['tags']>) {
  const uniqueTags = new Map<string, {
    name: string;
    rank: number | null;
    isMediaSpoiler: boolean;
  }>();

  for (const tag of tags) {
    const name = tag.name?.trim();

    if (!name) {
      continue;
    }

    const existing = uniqueTags.get(name);

    if (!existing) {
      uniqueTags.set(name, {
        name,
        rank: tag.rank ?? null,
        isMediaSpoiler: tag.isMediaSpoiler ?? false,
      });
      continue;
    }

    uniqueTags.set(name, {
      name,
      rank: Math.max(existing.rank ?? 0, tag.rank ?? 0) || null,
      isMediaSpoiler: existing.isMediaSpoiler || (tag.isMediaSpoiler ?? false),
    });
  }

  return Array.from(uniqueTags.values());
}

export async function upsertAnimeFull(anime: AniListAnime): Promise<void> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ anime upsert
    await conn.execute(
      `
      INSERT INTO anime (
        anilist_id,
        title_romaji,
        title_english,
        title_native,
        title_user_preferred,
        description,
        episodes,
        duration,
        season,
        season_year,
        format,
        status,
        source,
        country_of_origin,
        is_adult,
        average_score,
        mean_score,
        popularity,
        favourites,
        cover_image_large,
        cover_image_extra_large,
        banner_image,
        site_url,
        source_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title_romaji = VALUES(title_romaji),
        title_english = VALUES(title_english),
        title_native = VALUES(title_native),
        title_user_preferred = VALUES(title_user_preferred),
        description = VALUES(description),
        episodes = VALUES(episodes),
        duration = VALUES(duration),
        season = VALUES(season),
        season_year = VALUES(season_year),
        format = VALUES(format),
        status = VALUES(status),
        source = VALUES(source),
        country_of_origin = VALUES(country_of_origin),
        is_adult = VALUES(is_adult),
        average_score = VALUES(average_score),
        mean_score = VALUES(mean_score),
        popularity = VALUES(popularity),
        favourites = VALUES(favourites),
        cover_image_large = VALUES(cover_image_large),
        cover_image_extra_large = VALUES(cover_image_extra_large),
        banner_image = VALUES(banner_image),
        site_url = VALUES(site_url),
        source_updated_at = VALUES(source_updated_at)
      `,
      [
        anime.id,
        anime.title?.romaji ?? null,
        anime.title?.english ?? null,
        anime.title?.native ?? null,
        anime.title?.userPreferred ?? null,
        anime.description ?? null,
        anime.episodes ?? null,
        anime.duration ?? null,
        anime.season ?? null,
        anime.seasonYear ?? null,
        anime.format ?? null,
        anime.status ?? null,
        anime.source ?? null,
        anime.countryOfOrigin ?? null,
        anime.isAdult ?? false,
        anime.averageScore ?? null,
        anime.meanScore ?? null,
        anime.popularity ?? null,
        anime.favourites ?? null,
        anime.coverImage?.large ?? null,
        anime.coverImage?.extraLarge ?? null,
        anime.bannerImage ?? null,
        anime.siteUrl ?? null,
        fromUnixTimestampToMySQLDateTime(anime.updatedAt),
      ]
    );

    // 2️⃣ 내부 anime.id 조회
    const [rows]: any = await conn.query(
      `SELECT id FROM anime WHERE anilist_id = ? LIMIT 1`,
      [anime.id]
    );

    const animeId = rows[0].id;

    // ==========================
    // 3️⃣ GENRES
    // ==========================

    await conn.execute(`DELETE FROM anime_genres WHERE anime_id = ?`, [animeId]);

    if (anime.genres && anime.genres.length > 0) {
      const genreValues = anime.genres.map((g) => [animeId, g]);

      await conn.query(
        `INSERT INTO anime_genres (anime_id, genre) VALUES ?`,
        [genreValues]
      );
    }

    // ==========================
    // 4️⃣ TAGS
    // ==========================

    await conn.execute(`DELETE FROM anime_tags WHERE anime_id = ?`, [animeId]);

    if (anime.tags && anime.tags.length > 0) {
      const dedupedTags = dedupeAnimeTags(anime.tags);

      const tagValues = dedupedTags.map((t) => [
        animeId,
        t.name,
        t.rank ?? null,
        t.isMediaSpoiler
      ]);

      await conn.query(
        `INSERT INTO anime_tags (anime_id, tag_name, rank_value, is_spoiler) VALUES ?`,
        [tagValues]
      );
    }

    // ==========================
    // 5️⃣ SYNONYMS
    // ==========================

    // await conn.execute(`DELETE FROM anime_synonyms WHERE anime_id = ?`, [animeId]);

    // if (anime.synonyms && anime.synonyms.length > 0) {
    //   const synonymValues = anime.synonyms.map((s) => [animeId, s]);

    //   await conn.query(
    //     `INSERT INTO anime_synonyms (anime_id, synonym) VALUES ?`,
    //     [synonymValues]
    //   );
    // }

    await conn.commit();

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
