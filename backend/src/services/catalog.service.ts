import crypto from 'crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import {
  calculateImageSha256,
  deleteObjectByKey,
  getCatalogImagesPrefix,
  getImageFileExtension,
  getObjectKeyFromPublicUrl,
  isSupportedImageContentType,
  uploadPublicObject,
} from '../lib/image-storage';
import { rebuildAnimeSeries } from './admin-anime-series.service';

export const CATALOG_ENTITY_TYPES = ['ANIME', 'CHARACTER', 'VOICE_ACTOR', 'STUDIO'] as const;
export const CATALOG_CHANGE_KINDS = ['CREATE_ENTITY', 'UPDATE_ENTITY', 'LINK_TO_ANIME'] as const;
export const CATALOG_CHANGE_SOURCES = ['USER', 'AI'] as const;
export const CATALOG_CHANGE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;

export type CatalogEntityType = typeof CATALOG_ENTITY_TYPES[number];
export type CatalogChangeKind = typeof CATALOG_CHANGE_KINDS[number];
export type CatalogChangeSource = typeof CATALOG_CHANGE_SOURCES[number];
export type CatalogChangeStatus = typeof CATALOG_CHANGE_STATUSES[number];

type JsonObject = Record<string, unknown>;

interface CatalogRequestRow extends RowDataPacket {
  id: number;
  source: CatalogChangeSource;
  kind: CatalogChangeKind;
  entityType: CatalogEntityType;
  targetEntityId: number | null;
  submittedByUserId: number | null;
  submitterUsername: string | null;
  status: CatalogChangeStatus;
  displayName: string;
  normalizedName: string;
  sourceUrl: string;
  description: string;
  payload: string | JsonObject;
  baseUpdatedAt: Date | string | null;
  confidenceOverall: number | null;
  confidenceBasic: number | null;
  confidenceAiring: number | null;
  confidenceStudios: number | null;
  confidenceCharacters: number | null;
  confidenceVoiceActors: number | null;
  confidenceRelations: number | null;
  warnings: string | unknown[] | null;
  reviewedByUserId: number | null;
  reviewedAt: Date | string | null;
  rejectionReason: string | null;
  approvedEntityId: number | null;
  duplicateResolution: 'USE_EXISTING' | 'CREATE_NEW' | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface IdRow extends RowDataPacket { id: number; updatedAt?: Date | string }

export class CatalogConflictError extends Error {
  constructor(message: string, public readonly candidates: unknown[] = []) {
    super(message);
    this.name = 'CatalogConflictError';
  }
}

function asObject(value: unknown, field = 'payload'): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as JsonObject;
}

function parseJsonObject(value: string | JsonObject): JsonObject {
  return typeof value === 'string' ? asObject(JSON.parse(value)) : asObject(value);
}

function parseJsonArray(value: string | unknown[] | null) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function cleanText(value: unknown, field: string, max: number, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (required && !cleaned) throw new Error(`${field} is required`);
  if (cleaned.length > max) throw new Error(`${field} must be ${max} characters or fewer`);
  return cleaned || null;
}

function optionalInteger(value: unknown, field: string, min = 0, max = 999999) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function cleanBoolean(value: unknown, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'boolean') throw new Error('boolean value expected');
  return value;
}

function cleanHttpsUrl(value: unknown, field: string, required = false) {
  const cleaned = cleanText(value, field, 1000, required);
  if (!cleaned) return null;
  let url: URL;
  try { url = new URL(cleaned); } catch { throw new Error(`${field} must be a valid HTTPS URL`); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${field} must be a valid HTTPS URL`);
  }
  return url.toString();
}

export function normalizeCatalogName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function validateCatalogEntityType(value: unknown): CatalogEntityType {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!CATALOG_ENTITY_TYPES.includes(normalized as CatalogEntityType)) {
    throw new Error('type must be one of ANIME, CHARACTER, VOICE_ACTOR, STUDIO');
  }
  return normalized as CatalogEntityType;
}

function validateChangeKind(value: unknown): CatalogChangeKind {
  if (!CATALOG_CHANGE_KINDS.includes(value as CatalogChangeKind)) {
    throw new Error('kind must be one of CREATE_ENTITY, UPDATE_ENTITY, LINK_TO_ANIME');
  }
  return value as CatalogChangeKind;
}

function positiveId(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

function stringArray(value: unknown, field: string, limit = 100) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  if (value.length > limit) throw new Error(`${field} has too many items`);
  return Array.from(new Set(value.map((item) => cleanText(item, field, 255, true)!)));
}

function normalizeRequestRow(row: CatalogRequestRow) {
  return {
    ...row,
    payload: parseJsonObject(row.payload),
    warnings: parseJsonArray(row.warnings),
    confidence: row.source === 'AI' ? {
      overall: row.confidenceOverall,
      basic: row.confidenceBasic,
      airing: row.confidenceAiring,
      studios: row.confidenceStudios,
      characters: row.confidenceCharacters,
      voiceActors: row.confidenceVoiceActors,
      relations: row.confidenceRelations,
    } : null,
  };
}

const REQUEST_SELECT = `
  SELECT
    ccr.id,
    ccr.source,
    ccr.kind,
    ccr.entity_type AS entityType,
    ccr.target_entity_id AS targetEntityId,
    ccr.submitted_by_user_id AS submittedByUserId,
    submitter.username AS submitterUsername,
    ccr.status,
    ccr.display_name AS displayName,
    ccr.normalized_name AS normalizedName,
    ccr.source_url AS sourceUrl,
    ccr.description,
    ccr.payload,
    ccr.base_updated_at AS baseUpdatedAt,
    ccr.confidence_overall AS confidenceOverall,
    ccr.confidence_basic AS confidenceBasic,
    ccr.confidence_airing AS confidenceAiring,
    ccr.confidence_studios AS confidenceStudios,
    ccr.confidence_characters AS confidenceCharacters,
    ccr.confidence_voice_actors AS confidenceVoiceActors,
    ccr.confidence_relations AS confidenceRelations,
    ccr.warnings,
    ccr.reviewed_by_user_id AS reviewedByUserId,
    ccr.reviewed_at AS reviewedAt,
    ccr.rejection_reason AS rejectionReason,
    ccr.approved_entity_id AS approvedEntityId,
    ccr.duplicate_resolution AS duplicateResolution,
    ccr.created_at AS createdAt,
    ccr.updated_at AS updatedAt
  FROM catalog_change_requests ccr
  LEFT JOIN users submitter ON submitter.id = ccr.submitted_by_user_id
`;

export async function searchCatalogEntities(params: { type: CatalogEntityType; query: string; limit?: number; includeHidden?: boolean }) {
  const query = cleanText(params.query, 'q', 100, true)!;
  const limit = Number(params.limit ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('limit must be an integer between 1 and 50');
  const like = `%${query.replace(/[\\%_]/g, '\\$&')}%`;

  if (params.type === 'ANIME') {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        a.id,
        'ANIME' AS type,
        COALESCE(akt.full_title, a.title_english, a.title_romaji, a.title_native, a.title_user_preferred) AS displayName,
        CONCAT_WS(' · ', a.season_year, a.format) AS subtitle,
        COALESCE(a.cover_image_extra_large, a.cover_image_large) AS imageUrl
      FROM anime a
      LEFT JOIN anime_korean_titles akt ON akt.anime_id = a.id AND akt.is_primary = TRUE
      WHERE ${params.includeHidden ? '1 = 1' : 'a.is_adult = FALSE AND a.app_visible = TRUE'}
        AND (
          a.title_english LIKE ? ESCAPE '\\\\'
          OR a.title_romaji LIKE ? ESCAPE '\\\\'
          OR a.title_native LIKE ? ESCAPE '\\\\'
          OR a.title_user_preferred LIKE ? ESCAPE '\\\\'
          OR akt.full_title LIKE ? ESCAPE '\\\\'
          OR EXISTS (SELECT 1 FROM anime_synonyms s WHERE s.anime_id = a.id AND s.synonym LIKE ? ESCAPE '\\\\')
        )
      ORDER BY a.app_visible DESC, displayName ASC, a.id ASC
      LIMIT ?
    `, [like, like, like, like, like, like, limit]);
    return rows;
  }

  const definition = params.type === 'CHARACTER'
    ? { table: 'characters', full: 'name_full', native: 'name_native', preferred: 'name_user_preferred', image: 'COALESCE(image_large, image_medium)' }
    : params.type === 'VOICE_ACTOR'
      ? { table: 'voice_actors', full: 'name_full', native: 'name_native', preferred: 'name_user_preferred', image: 'COALESCE(image_large, image_medium)' }
      : { table: 'studios', full: 'name', native: 'name', preferred: 'name', image: 'NULL' };
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT id, ? AS type,
      COALESCE(${definition.full}, ${definition.preferred}, ${definition.native}) AS displayName,
      ${definition.native} AS subtitle,
      ${definition.image} AS imageUrl
    FROM ${definition.table}
    WHERE ${definition.full} LIKE ? ESCAPE '\\\\'
       OR ${definition.native} LIKE ? ESCAPE '\\\\'
       OR ${definition.preferred} LIKE ? ESCAPE '\\\\'
    ORDER BY displayName ASC, id ASC
    LIMIT ?
  `, [params.type, like, like, like, limit]);
  return rows;
}

export async function getCatalogTaxonomy() {
  const [[genres], [tags]] = await Promise.all([
    pool.query<RowDataPacket[]>(`
      SELECT genre AS value, COUNT(*) AS usageCount
      FROM anime_genres
      GROUP BY genre
      ORDER BY usageCount DESC, value ASC
    `),
    pool.query<RowDataPacket[]>(`
      SELECT tag_name AS value, COUNT(*) AS usageCount
      FROM anime_tags
      GROUP BY tag_name
      ORDER BY usageCount DESC, value ASC
    `),
  ]);
  const normalize = (rows: RowDataPacket[]) => rows.map((row) => ({
    value: String(row.value),
    usageCount: Number(row.usageCount),
  }));
  return { genres: normalize(genres), tags: normalize(tags) };
}

export async function getAdminCatalogEntity(type: CatalogEntityType, rawId: unknown) {
  const id = positiveId(rawId, 'id');
  if (type === 'ANIME') {
    const [[rows], [koreanTitles], [genres], [tags], [synonyms], [studios], [cast], [actors], [relations]] = await Promise.all([
      pool.query<RowDataPacket[]>(`
        SELECT
          id,
          title_romaji AS titleRomaji,
          title_english AS titleEnglish,
          title_native AS titleNative,
          title_user_preferred AS titleUserPreferred,
          description,
          episodes,
          duration,
          season,
          season_year AS seasonYear,
          format,
          status,
          source,
          country_of_origin AS countryOfOrigin,
          is_adult AS isAdult,
          app_visible AS appVisible,
          official_site_url AS officialSiteUrl,
          cover_image_large AS coverLarge,
          cover_image_extra_large AS coverExtraLarge,
          banner_image AS banner,
          updated_at AS updatedAt
        FROM anime
        WHERE id = ?
        LIMIT 1
      `, [id]),
      pool.query<RowDataPacket[]>(`
        SELECT title, subtitle
        FROM anime_korean_titles
        WHERE anime_id = ? AND is_primary = TRUE
        ORDER BY id ASC
        LIMIT 1
      `, [id]),
      pool.query<RowDataPacket[]>('SELECT genre FROM anime_genres WHERE anime_id = ? ORDER BY genre ASC', [id]),
      pool.query<RowDataPacket[]>(`
        SELECT tag_name AS name, rank_value AS tagRank, is_spoiler AS isSpoiler
        FROM anime_tags
        WHERE anime_id = ?
        ORDER BY rank_value DESC, tag_name ASC
      `, [id]),
      pool.query<RowDataPacket[]>('SELECT synonym FROM anime_synonyms WHERE anime_id = ? ORDER BY synonym ASC', [id]),
      pool.query<RowDataPacket[]>(`
        SELECT ast.studio_id AS studioId, ast.is_main AS isMain, s.name AS studioName
        FROM anime_studios ast
        INNER JOIN studios s ON s.id = ast.studio_id
        WHERE ast.anime_id = ?
        ORDER BY ast.is_main DESC, s.name ASC
      `, [id]),
      pool.query<RowDataPacket[]>(`
        SELECT
          ac.character_id AS characterId,
          ac.role,
          ac.edge_name AS edgeName,
          ac.sort_order AS sortOrder,
          COALESCE(c.name_user_preferred, c.name_full, c.name_native) AS characterName
        FROM anime_characters ac
        INNER JOIN characters c ON c.id = ac.character_id
        WHERE ac.anime_id = ?
        ORDER BY ac.sort_order ASC, ac.character_id ASC
      `, [id]),
      pool.query<RowDataPacket[]>(`
        SELECT
          acva.character_id AS characterId,
          acva.voice_actor_id AS voiceActorId,
          acva.language_v2 AS languageV2,
          acva.sort_order AS sortOrder,
          COALESCE(va.name_user_preferred, va.name_full, va.name_native) AS voiceActorName
        FROM anime_character_voice_actors acva
        INNER JOIN voice_actors va ON va.id = acva.voice_actor_id
        WHERE acva.anime_id = ?
        ORDER BY acva.character_id ASC, acva.sort_order ASC, acva.voice_actor_id ASC
      `, [id]),
      pool.query<RowDataPacket[]>(`
        SELECT
          ar.target_anime_id AS targetAnimeId,
          ar.relation_type AS relationType,
          COALESCE(akt.full_title, target.title_user_preferred, target.title_english, target.title_romaji, target.title_native) AS targetTitle
        FROM anime_relations ar
        INNER JOIN anime target ON target.id = ar.target_anime_id
        LEFT JOIN anime_korean_titles akt ON akt.anime_id = target.id AND akt.is_primary = TRUE
        WHERE ar.source_anime_id = ?
        ORDER BY ar.relation_type ASC, targetTitle ASC
      `, [id]),
    ]);
    const anime = rows[0];
    if (!anime) throw new Error('Anime not found');
    const primaryKorean = koreanTitles[0];
    const castPayload = cast.map((row) => ({
      character: { existingId: Number(row.characterId) },
      characterName: row.characterName,
      role: row.role,
      edgeName: row.edgeName,
      sortOrder: row.sortOrder === null ? null : Number(row.sortOrder),
      voiceActors: actors
        .filter((actor) => Number(actor.characterId) === Number(row.characterId))
        .map((actor) => ({
          voiceActor: { existingId: Number(actor.voiceActorId) },
          voiceActorName: actor.voiceActorName,
          languageV2: actor.languageV2,
          sortOrder: actor.sortOrder === null ? null : Number(actor.sortOrder),
        })),
    }));
    const payload = {
      titleKorean: primaryKorean?.title ?? null,
      titleKoreanSubtitle: primaryKorean?.subtitle ?? null,
      titleRomaji: anime.titleRomaji,
      titleEnglish: anime.titleEnglish,
      titleNative: anime.titleNative,
      titleUserPreferred: anime.titleUserPreferred,
      description: anime.description,
      episodes: anime.episodes === null ? null : Number(anime.episodes),
      duration: anime.duration === null ? null : Number(anime.duration),
      season: anime.season,
      seasonYear: anime.seasonYear === null ? null : Number(anime.seasonYear),
      format: anime.format,
      status: anime.status,
      source: anime.source,
      countryOfOrigin: anime.countryOfOrigin,
      isAdult: Boolean(anime.isAdult),
      appVisible: Boolean(anime.appVisible),
      officialSiteUrl: anime.officialSiteUrl,
      genres: genres.map((row) => String(row.genre)),
      tags: tags.map((row) => ({
        name: String(row.name), rank: row.tagRank === null ? null : Number(row.tagRank), isSpoiler: Boolean(row.isSpoiler),
      })),
      synonyms: synonyms.map((row) => String(row.synonym)),
      studios: studios.map((row) => ({
        studio: { existingId: Number(row.studioId) }, studioName: row.studioName, isMain: Boolean(row.isMain),
      })),
      cast: castPayload,
      relations: relations.map((row) => ({
        targetAnimeId: Number(row.targetAnimeId), relationType: row.relationType, targetTitle: row.targetTitle,
      })),
    };
    return {
      id,
      type,
      displayName: primaryKorean?.title ?? anime.titleUserPreferred ?? anime.titleEnglish ?? anime.titleRomaji ?? anime.titleNative,
      updatedAt: anime.updatedAt,
      payload,
      images: { coverLarge: anime.coverLarge, coverExtraLarge: anime.coverExtraLarge, banner: anime.banner },
    };
  }

  const definition = type === 'CHARACTER'
    ? { table: 'characters', extra: 'gender, age, NULL AS languageV2, NULL AS isAnimationStudio' }
    : type === 'VOICE_ACTOR'
      ? { table: 'voice_actors', extra: 'NULL AS gender, NULL AS age, language_v2 AS languageV2, NULL AS isAnimationStudio' }
      : { table: 'studios', extra: 'NULL AS gender, NULL AS age, NULL AS languageV2, is_animation_studio AS isAnimationStudio' };
  const identity = type === 'STUDIO'
    ? 'name, NULL AS nameFull, NULL AS nameNative, NULL AS nameUserPreferred, NULL AS description, NULL AS imageLarge, NULL AS imageMedium'
    : 'NULL AS name, name_full AS nameFull, name_native AS nameNative, name_user_preferred AS nameUserPreferred, description, image_large AS imageLarge, image_medium AS imageMedium';
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT id, ${identity}, official_site_url AS officialSiteUrl, updated_at AS updatedAt, ${definition.extra}
    FROM ${definition.table}
    WHERE id = ?
    LIMIT 1
  `, [id]);
  const entity = rows[0];
  if (!entity) throw new Error('Catalog entity not found');
  const payload = type === 'STUDIO'
    ? { name: entity.name, officialSiteUrl: entity.officialSiteUrl, isAnimationStudio: Boolean(entity.isAnimationStudio) }
    : {
      nameFull: entity.nameFull,
      nameNative: entity.nameNative,
      nameUserPreferred: entity.nameUserPreferred,
      description: entity.description,
      officialSiteUrl: entity.officialSiteUrl,
      ...(type === 'CHARACTER' ? { gender: entity.gender, age: entity.age } : { languageV2: entity.languageV2 }),
    };
  return {
    id,
    type,
    displayName: entity.name ?? entity.nameUserPreferred ?? entity.nameFull ?? entity.nameNative,
    updatedAt: entity.updatedAt,
    payload,
    images: type === 'STUDIO' ? {} : { large: entity.imageLarge, medium: entity.imageMedium },
  };
}

export async function createUserCatalogSubmission(userId: number, input: unknown) {
  const body = asObject(input);
  const type = validateCatalogEntityType(body.entityType);
  const kind = validateChangeKind(body.kind ?? 'CREATE_ENTITY');
  const displayName = cleanText(body.displayName, 'displayName', 255, true)!;
  const sourceUrl = cleanHttpsUrl(body.sourceUrl, 'sourceUrl', true)!;
  const description = cleanText(body.description, 'description', 2000, true)!;
  const payload = { ...asObject(body.payload ?? {}) };
  if (type === 'ANIME' && ![
    payload.titleKorean, payload.titleEnglish, payload.titleRomaji,
    payload.titleNative, payload.titleUserPreferred,
  ].some(Boolean)) payload.titleUserPreferred = displayName;
  if (type === 'STUDIO' && !payload.name) payload.name = displayName;
  if ((type === 'CHARACTER' || type === 'VOICE_ACTOR') && !payload.nameFull) payload.nameFull = displayName;
  const targetEntityId = body.targetEntityId === undefined || body.targetEntityId === null
    ? null
    : positiveId(body.targetEntityId, 'targetEntityId');
  if (kind !== 'CREATE_ENTITY' && !targetEntityId) throw new Error('targetEntityId is required for this request kind');

  let baseUpdatedAt: Date | string | null = null;
  if (targetEntityId) {
    const table = type === 'ANIME' ? 'anime' : type === 'CHARACTER' ? 'characters' : type === 'VOICE_ACTOR' ? 'voice_actors' : 'studios';
    const [targets] = await pool.query<IdRow[]>(`SELECT id, updated_at AS updatedAt FROM ${table} WHERE id = ? LIMIT 1`, [targetEntityId]);
    if (!targets[0]) throw new Error('Catalog entity not found');
    baseUpdatedAt = targets[0].updatedAt ?? null;
  }

  const [rateRows] = await pool.query<RowDataPacket[]>(`
    SELECT COUNT(*) AS count
    FROM catalog_change_requests
    WHERE submitted_by_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
  `, [userId]);
  if (Number(rateRows[0]?.count ?? 0) >= 10) throw new Error('Catalog submission rate limit exceeded');

  const normalizedName = normalizeCatalogName(displayName);
  const [duplicates] = await pool.query<RowDataPacket[]>(`
    SELECT id FROM catalog_change_requests
    WHERE entity_type = ? AND normalized_name = ? AND source_url = ? AND status = 'PENDING'
    LIMIT 1
  `, [type, normalizedName, sourceUrl]);
  if (duplicates[0]) throw new CatalogConflictError('An equivalent catalog request is already pending');

  const [result] = await pool.execute<ResultSetHeader>(`
    INSERT INTO catalog_change_requests (
      source, kind, entity_type, target_entity_id, submitted_by_user_id,
      display_name, normalized_name, source_url, description, payload, base_updated_at
    ) VALUES ('USER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [kind, type, targetEntityId, userId, displayName, normalizedName, sourceUrl, description, JSON.stringify(payload), baseUpdatedAt]);
  await pool.execute(`
    INSERT IGNORE INTO catalog_change_request_sources (request_id, section_name, source_url)
    VALUES (?, 'user', ?)
  `, [result.insertId, sourceUrl]);
  return getCatalogSubmission(result.insertId, userId);
}

export async function listMyCatalogSubmissions(userId: number) {
  const [rows] = await pool.query<CatalogRequestRow[]>(`
    ${REQUEST_SELECT}
    WHERE ccr.submitted_by_user_id = ?
    ORDER BY ccr.created_at DESC, ccr.id DESC
    LIMIT 100
  `, [userId]);
  return rows.map(normalizeRequestRow);
}

export async function withdrawMyCatalogSubmission(userId: number, requestId: number) {
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE catalog_change_requests
    SET status = 'WITHDRAWN'
    WHERE id = ? AND submitted_by_user_id = ? AND status = 'PENDING'
  `, [positiveId(requestId, 'requestId'), userId]);
  if (result.affectedRows === 0) throw new Error('Pending catalog request not found');
}

export async function getCatalogSubmission(requestId: number, ownerUserId?: number) {
  const params: number[] = [positiveId(requestId, 'requestId')];
  const ownerWhere = ownerUserId ? 'AND ccr.submitted_by_user_id = ?' : '';
  if (ownerUserId) params.push(ownerUserId);
  const [rows] = await pool.query<CatalogRequestRow[]>(`
    ${REQUEST_SELECT}
    WHERE ccr.id = ? ${ownerWhere}
    LIMIT 1
  `, params);
  if (!rows[0]) throw new Error('Catalog request not found');
  const [sources] = await pool.query<RowDataPacket[]>(`
    SELECT section_name AS sectionName, source_url AS sourceUrl, source_title AS sourceTitle
    FROM catalog_change_request_sources WHERE request_id = ? ORDER BY id
  `, [requestId]);
  return { ...normalizeRequestRow(rows[0]), sources };
}

export async function listAdminCatalogSubmissions(filters: {
  status?: CatalogChangeStatus;
  source?: CatalogChangeSource;
  entityType?: CatalogEntityType;
  confidence?: 'high' | 'medium' | 'low';
}) {
  const where: string[] = ['1 = 1'];
  const values: Array<string | number> = [];
  if (filters.status) { where.push('ccr.status = ?'); values.push(filters.status); }
  if (filters.source) { where.push('ccr.source = ?'); values.push(filters.source); }
  if (filters.entityType) { where.push('ccr.entity_type = ?'); values.push(filters.entityType); }
  if (filters.confidence === 'high') where.push('ccr.confidence_overall >= 0.85');
  if (filters.confidence === 'medium') where.push('ccr.confidence_overall >= 0.60 AND ccr.confidence_overall < 0.85');
  if (filters.confidence === 'low') where.push('ccr.confidence_overall < 0.60');
  const [rows] = await pool.query<CatalogRequestRow[]>(`
    ${REQUEST_SELECT}
    WHERE ${where.join(' AND ')}
    ORDER BY CASE ccr.status WHEN 'PENDING' THEN 0 ELSE 1 END, ccr.created_at DESC
    LIMIT 200
  `, values);
  return rows.map(normalizeRequestRow);
}

export async function updateCatalogSubmission(requestId: number, input: unknown) {
  const body = asObject(input);
  const current = await getCatalogSubmission(requestId);
  if (current.status !== 'PENDING') throw new CatalogConflictError('Only pending requests can be edited');
  const displayName = body.displayName === undefined ? current.displayName : cleanText(body.displayName, 'displayName', 255, true)!;
  const sourceUrl = body.sourceUrl === undefined ? current.sourceUrl : cleanHttpsUrl(body.sourceUrl, 'sourceUrl', true)!;
  const description = body.description === undefined ? current.description : cleanText(body.description, 'description', 2000, true)!;
  const payload = body.payload === undefined ? current.payload : asObject(body.payload);
  const kind = body.kind === undefined ? current.kind : validateChangeKind(body.kind);
  const targetEntityId = body.targetEntityId === undefined
    ? current.targetEntityId
    : body.targetEntityId === null ? null : positiveId(body.targetEntityId, 'targetEntityId');
  if (kind !== 'CREATE_ENTITY' && !targetEntityId) throw new Error('targetEntityId is required for this request kind');
  const duplicateResolution = body.duplicateResolution === undefined ? current.duplicateResolution
    : body.duplicateResolution === null ? null
      : body.duplicateResolution === 'USE_EXISTING' || body.duplicateResolution === 'CREATE_NEW'
        ? body.duplicateResolution : (() => { throw new Error('duplicateResolution must be USE_EXISTING or CREATE_NEW'); })();
  let baseUpdatedAt = current.baseUpdatedAt;
  if (targetEntityId && targetEntityId !== current.targetEntityId) {
    const table = current.entityType === 'ANIME' ? 'anime' : current.entityType === 'CHARACTER' ? 'characters' : current.entityType === 'VOICE_ACTOR' ? 'voice_actors' : 'studios';
    const [targets] = await pool.query<IdRow[]>(`SELECT id, updated_at AS updatedAt FROM ${table} WHERE id = ? LIMIT 1`, [targetEntityId]);
    if (!targets[0]) throw new Error('Catalog entity not found');
    baseUpdatedAt = targets[0].updatedAt ?? null;
  }
  await pool.execute(`
    UPDATE catalog_change_requests SET
      display_name = ?, normalized_name = ?, source_url = ?, description = ?, payload = ?,
      kind = ?, target_entity_id = ?, base_updated_at = ?, duplicate_resolution = ?
    WHERE id = ? AND status = 'PENDING'
  `, [displayName, normalizeCatalogName(displayName), sourceUrl, description, JSON.stringify(payload),
    kind, targetEntityId, baseUpdatedAt, duplicateResolution, requestId]);
  return getCatalogSubmission(requestId);
}

function getAnimeDisplayName(payload: JsonObject) {
  return cleanText(
    payload.titleKorean ?? payload.titleEnglish ?? payload.titleRomaji ?? payload.titleNative ?? payload.titleUserPreferred,
    'anime title',
    255,
    true,
  )!;
}

async function createSimpleEntity(connection: PoolConnection, type: Exclude<CatalogEntityType, 'ANIME'>, payload: JsonObject) {
  if (type === 'STUDIO') {
    const name = cleanText(payload.name, 'name', 255, true)!;
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO studios (name, is_animation_studio, official_site_url) VALUES (?, ?, ?)
    `, [name, cleanBoolean(payload.isAnimationStudio, true), cleanHttpsUrl(payload.officialSiteUrl, 'officialSiteUrl')]);
    return result.insertId;
  }
  const nameFull = cleanText(payload.nameFull, 'nameFull', 255, true)!;
  const common = [
    nameFull,
    cleanText(payload.nameNative, 'nameNative', 255),
    cleanText(payload.nameUserPreferred, 'nameUserPreferred', 255),
    cleanHttpsUrl(payload.officialSiteUrl, 'officialSiteUrl'),
    cleanText(payload.description, 'description', 65000),
  ];
  if (type === 'CHARACTER') {
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO characters (
        name_full, name_native, name_user_preferred, official_site_url, description, gender, age
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [...common, cleanText(payload.gender, 'gender', 50), cleanText(payload.age, 'age', 50)]);
    return result.insertId;
  }
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO voice_actors (
      name_full, name_native, name_user_preferred, official_site_url, description, language_v2
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [...common, cleanText(payload.languageV2, 'languageV2', 100)]);
  return result.insertId;
}

async function resolveEntityRef(
  connection: PoolConnection,
  expectedType: Exclude<CatalogEntityType, 'ANIME'>,
  value: unknown,
) {
  const ref = asObject(value, 'entity reference');
  if (ref.existingId !== undefined) return positiveId(ref.existingId, 'existingId');
  const create = asObject(ref.create, 'create');
  return createSimpleEntity(connection, expectedType, create);
}

async function requireExistingTaxonomyValues(
  connection: PoolConnection,
  table: 'anime_genres' | 'anime_tags',
  column: 'genre' | 'tag_name',
  values: string[],
  field: string,
) {
  if (values.length === 0) return;
  const placeholders = values.map(() => '?').join(', ');
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT DISTINCT ${column} AS value
    FROM ${table}
    WHERE ${column} IN (${placeholders})
  `, values);
  const existing = new Set(rows.map((row) => String(row.value)));
  const missing = values.filter((value) => !existing.has(value));
  if (missing.length > 0) throw new Error(`${field} must use existing taxonomy values: ${missing.join(', ')}`);
}

async function replaceAnimeDetails(connection: PoolConnection, animeId: number, payload: JsonObject) {
  if (payload.titleKorean !== undefined) {
    const title = cleanText(payload.titleKorean, 'titleKorean', 255);
    if (!title) {
      await connection.execute('DELETE FROM anime_korean_titles WHERE anime_id = ? AND is_primary = TRUE', [animeId]);
    } else {
      const [currentRows] = await connection.query<RowDataPacket[]>(`
        SELECT subtitle FROM anime_korean_titles WHERE anime_id = ? AND is_primary = TRUE ORDER BY id ASC LIMIT 1
      `, [animeId]);
      const subtitle = payload.titleKoreanSubtitle === undefined
        ? currentRows[0]?.subtitle ?? ''
        : cleanText(payload.titleKoreanSubtitle, 'titleKoreanSubtitle', 255) ?? '';
      await connection.execute('UPDATE anime_korean_titles SET is_primary = FALSE WHERE anime_id = ?', [animeId]);
      await connection.execute(`
        INSERT INTO anime_korean_titles (
          anime_id, title, subtitle, is_primary, is_locked, locked_at, source
        ) VALUES (?, ?, ?, TRUE, TRUE, CURRENT_TIMESTAMP, 'MANUAL')
        ON DUPLICATE KEY UPDATE is_primary = TRUE, is_locked = TRUE, locked_at = CURRENT_TIMESTAMP, source = 'MANUAL'
      `, [animeId, title, subtitle]);
    }
  } else if (payload.titleKoreanSubtitle !== undefined) {
    await connection.execute(`
      UPDATE anime_korean_titles
      SET subtitle = ?, is_locked = TRUE, locked_at = CURRENT_TIMESTAMP, source = 'MANUAL'
      WHERE anime_id = ? AND is_primary = TRUE
    `, [cleanText(payload.titleKoreanSubtitle, 'titleKoreanSubtitle', 255) ?? '', animeId]);
  }
  const genres = stringArray(payload.genres, 'genres');
  if (genres) {
    await requireExistingTaxonomyValues(connection, 'anime_genres', 'genre', genres, 'genres');
    await connection.execute('DELETE FROM anime_genres WHERE anime_id = ?', [animeId]);
    for (const genre of genres) await connection.execute('INSERT INTO anime_genres (anime_id, genre) VALUES (?, ?)', [animeId, genre]);
  }
  const synonyms = stringArray(payload.synonyms, 'synonyms');
  if (synonyms) {
    await connection.execute('DELETE FROM anime_synonyms WHERE anime_id = ?', [animeId]);
    for (const synonym of synonyms) await connection.execute('INSERT INTO anime_synonyms (anime_id, synonym) VALUES (?, ?)', [animeId, synonym]);
  }
  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) throw new Error('tags must be an array');
    const normalizedTags = payload.tags.slice(0, 100).map((raw) => {
      const tag = asObject(raw, 'tag');
      return { tag, name: cleanText(tag.name, 'tag.name', 100, true)! };
    });
    await requireExistingTaxonomyValues(connection, 'anime_tags', 'tag_name', normalizedTags.map(({ name }) => name), 'tags');
    await connection.execute('DELETE FROM anime_tags WHERE anime_id = ?', [animeId]);
    for (const { tag, name } of normalizedTags) {
      await connection.execute(`
        INSERT INTO anime_tags (anime_id, tag_name, rank_value, is_spoiler) VALUES (?, ?, ?, ?)
      `, [animeId, name, optionalInteger(tag.rank, 'tag.rank', 0, 100), cleanBoolean(tag.isSpoiler)]);
    }
  }
  if (payload.studios !== undefined) {
    if (!Array.isArray(payload.studios)) throw new Error('studios must be an array');
    await connection.execute('DELETE FROM anime_studios WHERE anime_id = ?', [animeId]);
    for (const raw of payload.studios.slice(0, 30)) {
      const item = asObject(raw, 'studio link');
      const studioId = await resolveEntityRef(connection, 'STUDIO', item.studio ?? item);
      await connection.execute('INSERT INTO anime_studios (anime_id, studio_id, is_main) VALUES (?, ?, ?)', [animeId, studioId, cleanBoolean(item.isMain)]);
    }
  }
  if (payload.cast !== undefined) {
    if (!Array.isArray(payload.cast)) throw new Error('cast must be an array');
    await connection.execute('DELETE FROM anime_character_voice_actors WHERE anime_id = ?', [animeId]);
    await connection.execute('DELETE FROM anime_characters WHERE anime_id = ?', [animeId]);
    let castOrder = 0;
    for (const raw of payload.cast.slice(0, 500)) {
      const item = asObject(raw, 'cast link');
      const characterId = await resolveEntityRef(connection, 'CHARACTER', item.character);
      const role = cleanText(item.role, 'role', 50) ?? 'BACKGROUND';
      await connection.execute(`
        INSERT INTO anime_characters (anime_id, character_id, role, edge_name, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `, [animeId, characterId, role, cleanText(item.edgeName, 'edgeName', 255), castOrder]);
      const actors = Array.isArray(item.voiceActors) ? item.voiceActors.slice(0, 20) : [];
      let actorOrder = 0;
      for (const actorRaw of actors) {
        const actor = asObject(actorRaw, 'voice actor link');
        const voiceActorId = await resolveEntityRef(connection, 'VOICE_ACTOR', actor.voiceActor ?? actor);
        await connection.execute(`
          INSERT INTO anime_character_voice_actors (
            anime_id, character_id, voice_actor_id, language_v2, sort_order
          ) VALUES (?, ?, ?, ?, ?)
        `, [animeId, characterId, voiceActorId, cleanText(actor.languageV2, 'languageV2', 100), actorOrder]);
        actorOrder += 1;
      }
      castOrder += 1;
    }
  }
  if (payload.relations !== undefined) {
    if (!Array.isArray(payload.relations)) throw new Error('relations must be an array');
    await connection.execute('DELETE FROM anime_relations WHERE source_anime_id = ?', [animeId]);
    for (const raw of payload.relations.slice(0, 100)) {
      const relation = asObject(raw, 'relation');
      const targetAnimeId = positiveId(relation.targetAnimeId, 'targetAnimeId');
      if (targetAnimeId === animeId) throw new Error('An anime cannot relate to itself');
      await connection.execute(`
        INSERT INTO anime_relations (source_anime_id, target_anime_id, relation_type)
        VALUES (?, ?, ?)
      `, [animeId, targetAnimeId, cleanText(relation.relationType, 'relationType', 30, true)]);
    }
  }
}

async function createAnime(connection: PoolConnection, payload: JsonObject) {
  getAnimeDisplayName(payload);
  if (payload.appVisible === true) throw new Error('A new anime must have an administrator-uploaded cover before publishing');
  const [result] = await connection.execute<ResultSetHeader>(`
    INSERT INTO anime (
      title_romaji, title_english, title_native, title_user_preferred, description,
      episodes, duration, season, season_year, format, status, source,
      country_of_origin, is_adult, app_visible, cover_image_large,
      cover_image_extra_large, banner_image, official_site_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cleanText(payload.titleRomaji, 'titleRomaji', 255),
    cleanText(payload.titleEnglish, 'titleEnglish', 255),
    cleanText(payload.titleNative, 'titleNative', 255),
    cleanText(payload.titleUserPreferred, 'titleUserPreferred', 255),
    cleanText(payload.description, 'description', 65000),
    optionalInteger(payload.episodes, 'episodes', 0, 100000),
    optionalInteger(payload.duration, 'duration', 0, 100000),
    cleanText(payload.season, 'season', 20),
    optionalInteger(payload.seasonYear, 'seasonYear', 1900, 2200),
    cleanText(payload.format, 'format', 50),
    cleanText(payload.status, 'status', 50),
    cleanText(payload.source, 'source', 50),
    cleanText(payload.countryOfOrigin, 'countryOfOrigin', 10),
    cleanBoolean(payload.isAdult),
    false,
    null,
    null,
    null,
    cleanHttpsUrl(payload.officialSiteUrl, 'officialSiteUrl'),
  ]);
  await connection.execute('INSERT INTO anime_community_metrics (anime_id) VALUES (?)', [result.insertId]);
  await replaceAnimeDetails(connection, result.insertId, payload);
  return result.insertId;
}

const ANIME_FIELDS: Record<string, { column: string; value: (value: unknown) => unknown }> = {
  titleRomaji: { column: 'title_romaji', value: (value) => cleanText(value, 'titleRomaji', 255) },
  titleEnglish: { column: 'title_english', value: (value) => cleanText(value, 'titleEnglish', 255) },
  titleNative: { column: 'title_native', value: (value) => cleanText(value, 'titleNative', 255) },
  titleUserPreferred: { column: 'title_user_preferred', value: (value) => cleanText(value, 'titleUserPreferred', 255) },
  description: { column: 'description', value: (value) => cleanText(value, 'description', 65000) },
  episodes: { column: 'episodes', value: (value) => optionalInteger(value, 'episodes', 0, 100000) },
  duration: { column: 'duration', value: (value) => optionalInteger(value, 'duration', 0, 100000) },
  season: { column: 'season', value: (value) => cleanText(value, 'season', 20) },
  seasonYear: { column: 'season_year', value: (value) => optionalInteger(value, 'seasonYear', 1900, 2200) },
  format: { column: 'format', value: (value) => cleanText(value, 'format', 50) },
  status: { column: 'status', value: (value) => cleanText(value, 'status', 50) },
  source: { column: 'source', value: (value) => cleanText(value, 'source', 50) },
  countryOfOrigin: { column: 'country_of_origin', value: (value) => cleanText(value, 'countryOfOrigin', 10) },
  isAdult: { column: 'is_adult', value: (value) => cleanBoolean(value) },
  appVisible: { column: 'app_visible', value: (value) => cleanBoolean(value) },
  officialSiteUrl: { column: 'official_site_url', value: (value) => cleanHttpsUrl(value, 'officialSiteUrl') },
};

async function updateAnime(connection: PoolConnection, animeId: number, payload: JsonObject) {
  if (payload.appVisible === true) {
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT id FROM anime
      WHERE id = ? AND (cover_image_large IS NOT NULL OR cover_image_extra_large IS NOT NULL)
      LIMIT 1
    `, [animeId]);
    if (!rows[0]) throw new Error('An administrator-uploaded cover is required before publishing');
  }
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, definition] of Object.entries(ANIME_FIELDS)) {
    if (payload[key] === undefined) continue;
    fields.push(`${definition.column} = ?`);
    values.push(definition.value(payload[key]));
  }
  if (fields.length > 0) {
    values.push(animeId);
    const [result] = await connection.execute<ResultSetHeader>(`
      UPDATE anime SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, values);
    if (result.affectedRows === 0) throw new Error('Anime not found');
  }
  await replaceAnimeDetails(connection, animeId, payload);
  return animeId;
}

async function mutateCatalogEntity(
  connection: PoolConnection,
  type: CatalogEntityType,
  payload: JsonObject,
  targetEntityId?: number | null,
) {
  if (type === 'ANIME') return targetEntityId ? updateAnime(connection, targetEntityId, payload) : createAnime(connection, payload);
  if (!targetEntityId) return createSimpleEntity(connection, type, payload);
  const definitions = type === 'STUDIO'
    ? { table: 'studios', allowed: { name: 'name', isAnimationStudio: 'is_animation_studio', officialSiteUrl: 'official_site_url' } }
    : type === 'CHARACTER'
      ? { table: 'characters', allowed: { nameFull: 'name_full', nameNative: 'name_native', nameUserPreferred: 'name_user_preferred', description: 'description', gender: 'gender', age: 'age', officialSiteUrl: 'official_site_url' } }
      : { table: 'voice_actors', allowed: { nameFull: 'name_full', nameNative: 'name_native', nameUserPreferred: 'name_user_preferred', description: 'description', languageV2: 'language_v2', officialSiteUrl: 'official_site_url' } };
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, column] of Object.entries(definitions.allowed)) {
    if (payload[key] === undefined) continue;
    fields.push(`${column} = ?`);
    values.push(key === 'isAnimationStudio'
      ? cleanBoolean(payload[key])
      : key === 'officialSiteUrl'
        ? cleanHttpsUrl(payload[key], key)
        : cleanText(payload[key], key, key === 'description' ? 65000 : 255));
  }
  if (fields.length === 0) return targetEntityId;
  values.push(targetEntityId);
  const [result] = await connection.execute<ResultSetHeader>(`
    UPDATE ${definitions.table} SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, values);
  if (result.affectedRows === 0) throw new Error('Catalog entity not found');
  return targetEntityId;
}

async function linkEntityToAnime(
  connection: PoolConnection,
  type: CatalogEntityType,
  entityId: number,
  payload: JsonObject,
) {
  const animeId = positiveId(payload.animeId, 'animeId');
  if (type === 'STUDIO') {
    await connection.execute(`
      INSERT INTO anime_studios (anime_id, studio_id, is_main) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_main = VALUES(is_main)
    `, [animeId, entityId, cleanBoolean(payload.isMain)]);
  } else if (type === 'CHARACTER') {
    await connection.execute(`
      INSERT INTO anime_characters (anime_id, character_id, role, edge_name, sort_order)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE role = VALUES(role), edge_name = VALUES(edge_name), sort_order = VALUES(sort_order)
    `, [animeId, entityId, cleanText(payload.role, 'role', 50) ?? 'BACKGROUND', cleanText(payload.edgeName, 'edgeName', 255), optionalInteger(payload.sortOrder, 'sortOrder', 0, 10000)]);
  } else if (type === 'VOICE_ACTOR') {
    const characterId = positiveId(payload.characterId, 'characterId');
    const [cast] = await connection.query<RowDataPacket[]>('SELECT character_id FROM anime_characters WHERE anime_id = ? AND character_id = ? LIMIT 1', [animeId, characterId]);
    if (!cast[0]) throw new Error('The selected character is not linked to this anime');
    await connection.execute(`
      INSERT INTO anime_character_voice_actors (anime_id, character_id, voice_actor_id, language_v2, sort_order)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE language_v2 = VALUES(language_v2), sort_order = VALUES(sort_order)
    `, [animeId, characterId, entityId, cleanText(payload.languageV2, 'languageV2', 100), optionalInteger(payload.sortOrder, 'sortOrder', 0, 10000)]);
  } else {
    if (animeId === entityId) throw new Error('An anime cannot relate to itself');
    await connection.execute(`
      INSERT INTO anime_relations (source_anime_id, target_anime_id, relation_type)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
    `, [animeId, entityId, cleanText(payload.relationType, 'relationType', 30, true)]);
  }
  return entityId;
}

export async function writeCatalogEntity(params: {
  type: CatalogEntityType;
  payload: unknown;
  targetEntityId?: number | null;
  actorUserId: number;
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const payload = asObject(params.payload);
    const entityId = await mutateCatalogEntity(connection, params.type, payload, params.targetEntityId);
    await connection.execute(`
      INSERT INTO catalog_change_audit_logs (actor_user_id, action, entity_type, entity_id, after_payload)
      VALUES (?, ?, ?, ?, ?)
    `, [params.actorUserId, params.targetEntityId ? 'UPDATE' : 'CREATE', params.type, entityId, JSON.stringify(params.payload)]);
    await connection.commit();
    if (params.type === 'ANIME' && payload.relations !== undefined) void rebuildAnimeSeries('all').catch((error) => console.error('[catalog-series]', error));
    return { entityId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function approveCatalogSubmission(requestId: number, reviewerUserId: number) {
  const connection = await pool.getConnection();
  let approvalLockName: string | null = null;
  try {
    await connection.beginTransaction();
    const id = positiveId(requestId, 'requestId');
    const [lockedRows] = await connection.query<RowDataPacket[]>('SELECT id FROM catalog_change_requests WHERE id = ? FOR UPDATE', [id]);
    if (!lockedRows[0]) throw new Error('Catalog request not found');
    const [rows] = await connection.query<CatalogRequestRow[]>(`${REQUEST_SELECT} WHERE ccr.id = ?`, [id]);
    const request = rows[0];
    if (!request) throw new Error('Catalog request not found');
    if (request.status !== 'PENDING') throw new CatalogConflictError('Catalog request is no longer pending');
    approvalLockName = `myanitrack:catalog-approve:${crypto.createHash('sha256').update(`${request.entityType}:${request.normalizedName}`).digest('hex').slice(0, 32)}`;
    const [lockRows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 5) AS acquired', [approvalLockName]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new CatalogConflictError('Another matching catalog request is being approved');

    if (request.targetEntityId && request.baseUpdatedAt) {
      const table = request.entityType === 'ANIME' ? 'anime'
        : request.entityType === 'CHARACTER' ? 'characters'
          : request.entityType === 'VOICE_ACTOR' ? 'voice_actors' : 'studios';
      const [targetRows] = await connection.query<IdRow[]>(`SELECT id, updated_at AS updatedAt FROM ${table} WHERE id = ? FOR UPDATE`, [request.targetEntityId]);
      if (!targetRows[0]) throw new Error('Catalog entity not found');
      if (new Date(targetRows[0].updatedAt!).getTime() !== new Date(request.baseUpdatedAt).getTime()) {
        throw new CatalogConflictError('Catalog entity changed after this request was created');
      }
    }

    if (request.kind === 'CREATE_ENTITY' && request.duplicateResolution !== 'CREATE_NEW') {
      const candidates = await searchCatalogEntities({ type: request.entityType, query: request.displayName.slice(0, 100), limit: 5, includeHidden: true });
      const exact = candidates.filter((candidate) => normalizeCatalogName(String(candidate.displayName ?? '')) === request.normalizedName);
      if (exact.length > 0) throw new CatalogConflictError('A matching catalog entity already exists', exact);
    }

    const requestPayload = parseJsonObject(request.payload);
    const entityId = request.kind === 'LINK_TO_ANIME'
      ? await linkEntityToAnime(connection, request.entityType, positiveId(request.targetEntityId, 'targetEntityId'), requestPayload)
      : await mutateCatalogEntity(connection, request.entityType, requestPayload, request.targetEntityId);
    await connection.execute(`
      UPDATE catalog_change_requests SET
        status = 'APPROVED', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP,
        approved_entity_id = ?, rejection_reason = NULL
      WHERE id = ?
    `, [reviewerUserId, entityId, request.id]);
    await connection.execute(`
      INSERT INTO catalog_change_audit_logs (
        request_id, actor_user_id, action, entity_type, entity_id, after_payload
      ) VALUES (?, ?, 'APPROVE', ?, ?, ?)
    `, [request.id, reviewerUserId, request.entityType, entityId, JSON.stringify(parseJsonObject(request.payload))]);
    await connection.commit();
    if (request.entityType === 'ANIME' && (request.kind === 'LINK_TO_ANIME' || requestPayload.relations !== undefined)) {
      void rebuildAnimeSeries('all').catch((error) => console.error('[catalog-series]', error));
    }
    return { entityId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (approvalLockName) await connection.query('SELECT RELEASE_LOCK(?)', [approvalLockName]).catch(() => undefined);
    connection.release();
  }
}

export async function rejectCatalogSubmission(requestId: number, reviewerUserId: number, reason: unknown) {
  const rejectionReason = cleanText(reason, 'reason', 1000, true)!;
  const [result] = await pool.execute<ResultSetHeader>(`
    UPDATE catalog_change_requests SET
      status = 'REJECTED', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP,
      rejection_reason = ?
    WHERE id = ? AND status = 'PENDING'
  `, [reviewerUserId, rejectionReason, positiveId(requestId, 'requestId')]);
  if (result.affectedRows === 0) throw new CatalogConflictError('Pending catalog request not found');
  await pool.execute(`
    INSERT INTO catalog_change_audit_logs (request_id, actor_user_id, action, entity_type, before_payload)
    SELECT id, ?, 'REJECT', entity_type, payload FROM catalog_change_requests WHERE id = ?
  `, [reviewerUserId, requestId]);
}

export async function recalculateAnimeCommunityMetrics(animeId: number) {
  await pool.execute(`
    INSERT INTO anime_community_metrics (anime_id, community_average_score, rating_count, collection_count)
    SELECT a.id, AVG(ual.score), COUNT(ual.score), COUNT(ual.id)
    FROM anime a LEFT JOIN user_anime_lists ual ON ual.anime_id = a.id
    WHERE a.id = ? GROUP BY a.id
    ON DUPLICATE KEY UPDATE
      community_average_score = VALUES(community_average_score),
      rating_count = VALUES(rating_count),
      collection_count = VALUES(collection_count),
      updated_at = CURRENT_TIMESTAMP
  `, [positiveId(animeId, 'animeId')]);
}

const IMAGE_TARGETS: Record<CatalogEntityType, Record<string, { table: string; column: string }>> = {
  ANIME: {
    cover_large: { table: 'anime', column: 'cover_image_large' },
    cover_extra_large: { table: 'anime', column: 'cover_image_extra_large' },
    banner: { table: 'anime', column: 'banner_image' },
  },
  CHARACTER: {
    image_large: { table: 'characters', column: 'image_large' },
    image_medium: { table: 'characters', column: 'image_medium' },
  },
  VOICE_ACTOR: {
    image_large: { table: 'voice_actors', column: 'image_large' },
    image_medium: { table: 'voice_actors', column: 'image_medium' },
  },
  STUDIO: {},
};

export async function uploadCatalogEntityImage(params: {
  type: CatalogEntityType;
  entityId: number;
  variant: string;
  buffer: Buffer;
  contentType: string;
}) {
  if (!isSupportedImageContentType(params.contentType)) throw new Error('Unsupported image content type');
  if (params.buffer.length === 0 || params.buffer.length > 10 * 1024 * 1024) throw new Error('Image must be between 1 byte and 10MB');
  const target = IMAGE_TARGETS[params.type]?.[params.variant];
  if (!target) throw new Error('Unsupported catalog image variant');
  const entityId = positiveId(params.entityId, 'entityId');
  const checksum = calculateImageSha256(params.buffer);
  const extension = getImageFileExtension(params.contentType);
  const objectKey = `${getCatalogImagesPrefix()}/${params.type.toLowerCase()}/${entityId}/${params.variant}-${checksum.slice(0, 16)}.${extension}`;
  const uploaded = await uploadPublicObject({ objectKey, buffer: params.buffer, contentType: params.contentType });
  const connection = await pool.getConnection();
  let oldObjectKey: string | null = null;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT ${target.column} AS imageUrl FROM ${target.table} WHERE id = ? FOR UPDATE`, [entityId]);
    if (!rows[0]) throw new Error('Catalog entity not found');
    oldObjectKey = rows[0].imageUrl ? getObjectKeyFromPublicUrl(String(rows[0].imageUrl)) : null;
    await connection.execute(`UPDATE ${target.table} SET ${target.column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [uploaded.publicUrl, entityId]);
    await connection.execute(`
      INSERT INTO catalog_image_assets (
        entity_type, entity_id, variant, source_url, source_hash, source_provider,
        object_key, public_url, storage_provider, content_type, content_size_bytes,
        content_sha256, status, synced_at
      ) VALUES (?, ?, ?, ?, ?, 'admin_upload', ?, ?, 's3', ?, ?, ?, 'success', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        source_url = VALUES(source_url), source_hash = VALUES(source_hash), source_provider = 'admin_upload',
        object_key = VALUES(object_key), public_url = VALUES(public_url), storage_provider = 's3',
        content_type = VALUES(content_type), content_size_bytes = VALUES(content_size_bytes),
        content_sha256 = VALUES(content_sha256), status = 'success', synced_at = CURRENT_TIMESTAMP
    `, [params.type.toLowerCase(), entityId, params.variant, uploaded.publicUrl, checksum, objectKey, uploaded.publicUrl, params.contentType, params.buffer.length, checksum]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    await deleteObjectByKey(objectKey).catch(() => undefined);
    throw error;
  } finally { connection.release(); }
  if (oldObjectKey && oldObjectKey !== objectKey) await deleteObjectByKey(oldObjectKey).catch(() => undefined);
  return uploaded;
}

export function createManualScheduleKey() {
  return `manual:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
}
