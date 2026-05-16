import { pool } from '../config/db';

export interface AnimeTitleTranslationSource {
  animeId: number;
  sourceTitle: string;
}

export interface KoreanTitleRecord {
  animeId: number;
  title: string;
  subtitle?: string | null;
  isPrimary?: boolean;
}

interface LockedAnimeTitleRow {
  animeId: number;
}

export async function findAnimeWithoutKoreanTitles(limit = 100): Promise<AnimeTitleTranslationSource[]> {
  const [rows] = await pool.query(
    `
    SELECT
      a.id AS animeId,
      COALESCE(
        NULLIF(a.title_english, ''),
        NULLIF(a.title_romaji, ''),
        NULLIF(a.title_user_preferred, ''),
        NULLIF(a.title_native, '')
      ) AS sourceTitle
    FROM anime a
    WHERE NOT EXISTS (
      SELECT 1
      FROM anime_korean_titles akt
      WHERE akt.anime_id = a.id
    )
      AND COALESCE(
        NULLIF(a.title_english, ''),
        NULLIF(a.title_romaji, ''),
        NULLIF(a.title_user_preferred, ''),
        NULLIF(a.title_native, '')
      ) IS NOT NULL
    ORDER BY a.id ASC
    LIMIT ?
    `,
    [limit]
  );

  return (rows as AnimeTitleTranslationSource[]).filter((row) => row.sourceTitle?.trim());
}

export async function saveKoreanTitles(records: KoreanTitleRecord[]): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const animeIds = Array.from(new Set(records.map((record) => record.animeId)));
  const [lockedRows] = await pool.query(
    `
    SELECT DISTINCT anime_id AS animeId
    FROM anime_korean_titles
    WHERE is_locked = TRUE
      AND anime_id IN (?)
    `,
    [animeIds]
  );
  const lockedAnimeIds = new Set((lockedRows as LockedAnimeTitleRow[]).map((row) => row.animeId));
  const unlockedRecords = records.filter((record) => !lockedAnimeIds.has(record.animeId));

  if (unlockedRecords.length === 0) {
    return 0;
  }

  const values = unlockedRecords.map((record) => [
    record.animeId,
    record.title.trim(),
    (record.subtitle ?? '').trim(),
    record.isPrimary ?? true,
    'AUTO',
  ]);

  await pool.query(
    `
    INSERT INTO anime_korean_titles (
      anime_id,
      title,
      subtitle,
      is_primary,
      source
    )
    VALUES ?
    ON DUPLICATE KEY UPDATE
      title = IF(is_locked, title, VALUES(title)),
      subtitle = IF(is_locked, subtitle, VALUES(subtitle)),
      is_primary = IF(is_locked, is_primary, VALUES(is_primary)),
      source = IF(is_locked, source, VALUES(source)),
      updated_at = IF(is_locked, updated_at, CURRENT_TIMESTAMP)
    `,
    [values]
  );

  return unlockedRecords.length;
}
