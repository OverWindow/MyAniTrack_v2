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

  const values = records.map((record) => [
    record.animeId,
    record.title.trim(),
    (record.subtitle ?? '').trim(),
    record.isPrimary ?? true,
  ]);

  await pool.query(
    `
    INSERT INTO anime_korean_titles (
      anime_id,
      title,
      subtitle,
      is_primary
    )
    VALUES ?
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      subtitle = VALUES(subtitle),
      is_primary = VALUES(is_primary),
      updated_at = CURRENT_TIMESTAMP
    `,
    [values]
  );

  return records.length;
}
