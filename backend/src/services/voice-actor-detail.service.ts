import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { AnimeTitleLanguage } from './anime.service';

interface VoiceActorDetailRow extends RowDataPacket {
  id: number;
  anilistId: number;
  nameFull: string | null;
  nameNative: string | null;
  nameUserPreferred: string | null;
  languageV2: string | null;
  imageLarge: string | null;
  imageMedium: string | null;
  description: string | null;
  siteUrl: string | null;
}

interface VoiceActorCreditRow extends RowDataPacket {
  animeId: number;
  animeAnilistId: number;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  titleUserPreferred: string | null;
  titleKorean: string | null;
  coverImageLarge: string | null;
  coverImageExtraLarge: string | null;
  bannerImage: string | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  animeStatus: string | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  siteUrl: string | null;
  isAdult: number | boolean;
  characterId: number;
  characterAnilistId: number;
  characterNameFull: string | null;
  characterNameNative: string | null;
  characterNameUserPreferred: string | null;
  characterImageLarge: string | null;
  characterImageMedium: string | null;
  characterGender: string | null;
  characterAge: string | null;
  characterDescription: string | null;
  characterSiteUrl: string | null;
  role: string | null;
  edgeName: string | null;
  characterSortOrder: number | null;
  voiceLanguageV2: string | null;
  voiceActorSortOrder: number | null;
}

interface VoiceActorCreditSummaryRow extends RowDataPacket {
  animeCount: number;
  characterCount: number;
  creditCount: number;
}

interface VoiceActorCreditCursorPayload {
  seasonYear: number | null;
  animeId: number;
  characterId: number;
}

export interface VoiceActorDetailParams {
  voiceActorId: number;
  titleLanguage: AnimeTitleLanguage;
  limit: number;
  cursor?: string;
}

function encodeCursor(payload: VoiceActorCreditCursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string) {
  if (!cursor) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as VoiceActorCreditCursorPayload;
  } catch {
    throw new Error('Invalid cursor');
  }
}

function pickTitle(row: VoiceActorCreditRow, titleLanguage: AnimeTitleLanguage) {
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

export function validateVoiceActorDetailId(value: unknown) {
  const voiceActorId = Number(value);

  if (!Number.isInteger(voiceActorId) || voiceActorId <= 0) {
    throw new Error('voiceActorId must be a positive integer');
  }

  return voiceActorId;
}

export function validateVoiceActorDetailLimit(value: unknown) {
  const limit = Number(value ?? 20);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }

  return limit;
}

export async function getVoiceActorDetail(params: VoiceActorDetailParams) {
  const [voiceActorRows] = await pool.query<VoiceActorDetailRow[]>(
    `
    SELECT
      id,
      anilist_id AS anilistId,
      name_full AS nameFull,
      name_native AS nameNative,
      name_user_preferred AS nameUserPreferred,
      language_v2 AS languageV2,
      image_large AS imageLarge,
      image_medium AS imageMedium,
      description,
      site_url AS siteUrl
    FROM voice_actors
    WHERE id = ?
    LIMIT 1
    `,
    [params.voiceActorId]
  );

  const voiceActor = voiceActorRows[0];

  if (!voiceActor) {
    throw new Error('Voice actor not found');
  }

  const [summaryRows] = await pool.query<VoiceActorCreditSummaryRow[]>(
    `
    SELECT
      COUNT(DISTINCT anime_id) AS animeCount,
      COUNT(DISTINCT character_id) AS characterCount,
      COUNT(*) AS creditCount
    FROM anime_character_voice_actors acva
    INNER JOIN anime a
      ON a.id = acva.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    WHERE acva.voice_actor_id = ?
    `,
    [params.voiceActorId]
  );

  const cursor = decodeCursor(params.cursor);
  const queryParams: Array<number | string> = [params.voiceActorId];
  let cursorWhere = '';

  if (cursor) {
    cursorWhere = `
      AND (
        COALESCE(a.season_year, 0) < ?
        OR (COALESCE(a.season_year, 0) = ? AND a.id < ?)
        OR (COALESCE(a.season_year, 0) = ? AND a.id = ? AND c.id < ?)
      )
    `;
    queryParams.push(
      cursor.seasonYear ?? 0,
      cursor.seasonYear ?? 0,
      cursor.animeId,
      cursor.seasonYear ?? 0,
      cursor.animeId,
      cursor.characterId
    );
  }

  queryParams.push(params.limit + 1);

  const [creditRows] = await pool.query<VoiceActorCreditRow[]>(
    `
    SELECT
      a.id AS animeId,
      a.anilist_id AS animeAnilistId,
      a.title_romaji AS titleRomaji,
      a.title_english AS titleEnglish,
      a.title_native AS titleNative,
      a.title_user_preferred AS titleUserPreferred,
      akt.full_title AS titleKorean,
      a.cover_image_large AS coverImageLarge,
      a.cover_image_extra_large AS coverImageExtraLarge,
      a.banner_image AS bannerImage,
      a.season,
      a.season_year AS seasonYear,
      a.format,
      a.status AS animeStatus,
      a.average_score AS averageScore,
      a.mean_score AS meanScore,
      a.popularity,
      a.favourites,
      a.site_url AS siteUrl,
      a.is_adult AS isAdult,
      c.id AS characterId,
      c.anilist_id AS characterAnilistId,
      c.name_full AS characterNameFull,
      c.name_native AS characterNameNative,
      c.name_user_preferred AS characterNameUserPreferred,
      c.image_large AS characterImageLarge,
      c.image_medium AS characterImageMedium,
      c.gender AS characterGender,
      c.age AS characterAge,
      c.description AS characterDescription,
      c.site_url AS characterSiteUrl,
      ac.role,
      ac.edge_name AS edgeName,
      ac.sort_order AS characterSortOrder,
      acva.language_v2 AS voiceLanguageV2,
      acva.sort_order AS voiceActorSortOrder
    FROM anime_character_voice_actors acva
    INNER JOIN anime a
      ON a.id = acva.anime_id
      AND a.is_adult = FALSE
      AND a.app_visible = TRUE
    INNER JOIN characters c
      ON c.id = acva.character_id
    INNER JOIN anime_characters ac
      ON ac.anime_id = acva.anime_id
      AND ac.character_id = acva.character_id
    LEFT JOIN anime_korean_titles akt
      ON akt.anime_id = a.id
      AND akt.is_primary = TRUE
    WHERE acva.voice_actor_id = ?
      ${cursorWhere}
    ORDER BY
      CASE ac.role
        WHEN 'MAIN' THEN 1
        WHEN 'SUPPORTING' THEN 2
        WHEN 'SUPPORT' THEN 2
        WHEN 'BACKGROUND' THEN 3
        ELSE 4
      END ASC,
      COALESCE(a.season_year, 0) DESC,
      a.id DESC,
      c.id DESC
    LIMIT ?
    `,
    queryParams
  );

  const hasNext = creditRows.length > params.limit;
  const pageRows = hasNext ? creditRows.slice(0, params.limit) : creditRows;
  const lastRow = pageRows[pageRows.length - 1];
  const summary = summaryRows[0] ?? {
    animeCount: 0,
    characterCount: 0,
    creditCount: 0,
  };

  return {
    voiceActor: {
      id: voiceActor.id,
      anilistId: voiceActor.anilistId,
      name: {
        full: voiceActor.nameFull,
        native: voiceActor.nameNative,
        userPreferred: voiceActor.nameUserPreferred,
      },
      image: {
        large: voiceActor.imageLarge,
        medium: voiceActor.imageMedium,
      },
      languageV2: voiceActor.languageV2,
      description: voiceActor.description,
      siteUrl: voiceActor.siteUrl,
    },
    summary: {
      animeCount: summary.animeCount,
      characterCount: summary.characterCount,
      creditCount: summary.creditCount,
    },
    items: pageRows.map((row) => ({
      character: {
        id: row.characterId,
        anilistId: row.characterAnilistId,
        role: row.role,
        edgeName: row.edgeName,
        sortOrder: row.characterSortOrder,
        name: {
          full: row.characterNameFull,
          native: row.characterNameNative,
          userPreferred: row.characterNameUserPreferred,
        },
        image: {
          large: row.characterImageLarge,
          medium: row.characterImageMedium,
        },
        gender: row.characterGender,
        age: row.characterAge,
        description: row.characterDescription,
        siteUrl: row.characterSiteUrl,
      },
      anime: {
        id: row.animeId,
        anilistId: row.animeAnilistId,
        title: pickTitle(row, params.titleLanguage),
        titles: {
          korean: row.titleKorean,
          english: row.titleEnglish,
          native: row.titleNative,
          romaji: row.titleRomaji,
          userPreferred: row.titleUserPreferred,
        },
        coverImageLarge: row.coverImageLarge,
        coverImageExtraLarge: row.coverImageExtraLarge,
        bannerImage: row.bannerImage,
        season: row.season,
        seasonYear: row.seasonYear,
        format: row.format,
        status: row.animeStatus,
        averageScore: row.averageScore,
        meanScore: row.meanScore,
        popularity: row.popularity,
        favourites: row.favourites,
        siteUrl: row.siteUrl,
        isAdult: Boolean(row.isAdult),
      },
      voiceActing: {
        languageV2: row.voiceLanguageV2,
        sortOrder: row.voiceActorSortOrder,
      },
    })),
    pageInfo: {
      limit: params.limit,
      titleLanguage: params.titleLanguage,
      hasNext,
      nextCursor: hasNext && lastRow
        ? encodeCursor({
          seasonYear: lastRow.seasonYear,
          animeId: lastRow.animeId,
          characterId: lastRow.characterId,
        })
        : null,
    },
  };
}
