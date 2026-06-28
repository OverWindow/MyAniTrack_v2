import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { getUserAnimeStats, UserAnimeStats } from './recommendation.service';

type BadgeCategory = 'WATCH' | 'EPISODE' | 'TIME' | 'RATING' | 'GENRE' | 'SPECIAL';
type BadgeConditionType =
  | 'TOTAL_COUNT'
  | 'COMPLETED_COUNT'
  | 'TOTAL_WATCHED_EPISODES'
  | 'TOTAL_WATCH_MINUTES'
  | 'AVG_SCORE'
  | 'FAVORITE_GENRE'
  | 'CUSTOM';
type BadgeRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

interface BadgeRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: BadgeCategory;
  conditionType: BadgeConditionType;
  conditionValue: string;
  rarity: BadgeRarity;
  isActive: number | boolean;
  hidden: number | boolean;
  createdAt: string;
  earnedAt: string | null;
  progressSnapshot: string | Record<string, unknown> | null;
}

interface BadgeUserRow extends RowDataPacket {
  userId: number;
}

function getSupabasePublicObjectUrl(objectKey: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'myanitrack_v2';

  if (!supabaseUrl) {
    return `badges/${objectKey.split('/').pop()}`;
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
}

const INITIAL_BADGES = [
  {
    code: 'ANIME_TOTAL_100',
    name: '100편 시청',
    description: '애니를 100개 이상 보았을 때 획득합니다.',
    imageUrl: getSupabasePublicObjectUrl('badges/watch-badge100.png'),
    category: 'WATCH',
    conditionType: 'COMPLETED_COUNT',
    conditionValue: '100',
    rarity: 'COMMON',
  },
  {
    code: 'ANIME_TOTAL_200',
    name: '200편 시청',
    description: '애니를 200개 이상 보았을 때 획득합니다.',
    imageUrl: getSupabasePublicObjectUrl('badges/watch-badge200.png'),
    category: 'WATCH',
    conditionType: 'COMPLETED_COUNT',
    conditionValue: '200',
    rarity: 'RARE',
  },
  {
    code: 'ANIME_TOTAL_300',
    name: '300편 시청',
    description: '애니를 300개 이상 보았을 때 획득합니다.',
    imageUrl: getSupabasePublicObjectUrl('badges/watch-badge300.png'),
    category: 'WATCH',
    conditionType: 'COMPLETED_COUNT',
    conditionValue: '300',
    rarity: 'EPIC',
  },
] as const;

function parseProgressSnapshot(value: BadgeRow['progressSnapshot']) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseTargetValue(value: string) {
  const target = Number(value);
  return Number.isFinite(target) ? target : null;
}

function getConditionCurrentValue(conditionType: BadgeConditionType, stats: UserAnimeStats) {
  if (conditionType === 'TOTAL_COUNT') {
    return stats.totalCount;
  }

  if (conditionType === 'COMPLETED_COUNT') {
    return stats.completedCount;
  }

  if (conditionType === 'TOTAL_WATCHED_EPISODES') {
    return stats.totalWatchedEpisodes;
  }

  if (conditionType === 'TOTAL_WATCH_MINUTES') {
    return stats.totalWatchMinutes;
  }

  if (conditionType === 'AVG_SCORE') {
    return stats.avgScore ?? 0;
  }

  return 0;
}

function isBadgeEarnedByStats(badge: Pick<BadgeRow, 'conditionType' | 'conditionValue'>, stats: UserAnimeStats) {
  if (badge.conditionType === 'FAVORITE_GENRE') {
    return stats.favoriteGenre === badge.conditionValue;
  }

  if (badge.conditionType === 'CUSTOM') {
    return false;
  }

  const target = parseTargetValue(badge.conditionValue);

  if (target === null) {
    return false;
  }

  return getConditionCurrentValue(badge.conditionType, stats) >= target;
}

function buildProgressSnapshot(badge: Pick<BadgeRow, 'conditionType' | 'conditionValue'>, stats: UserAnimeStats) {
  const target = parseTargetValue(badge.conditionValue);
  const current = getConditionCurrentValue(badge.conditionType, stats);

  return {
    conditionType: badge.conditionType,
    conditionValue: badge.conditionValue,
    currentValue: badge.conditionType === 'FAVORITE_GENRE' ? stats.favoriteGenre : current,
    targetValue: badge.conditionType === 'FAVORITE_GENRE' ? badge.conditionValue : target,
    totalCount: stats.totalCount,
    completedCount: stats.completedCount,
    totalWatchedEpisodes: stats.totalWatchedEpisodes,
    totalWatchMinutes: stats.totalWatchMinutes,
    avgScore: stats.avgScore,
    favoriteGenre: stats.favoriteGenre,
    calculatedAt: new Date().toISOString(),
  };
}

function buildProgress(badge: BadgeRow, stats: UserAnimeStats, earned: boolean) {
  if (badge.conditionType === 'FAVORITE_GENRE') {
    return {
      current: stats.favoriteGenre,
      target: badge.conditionValue,
      percent: earned ? 100 : 0,
      isComplete: earned,
    };
  }

  const target = parseTargetValue(badge.conditionValue);
  const current = getConditionCurrentValue(badge.conditionType, stats);
  const percent = target && target > 0
    ? Math.min(100, Math.round((current / target) * 100))
    : earned ? 100 : 0;

  return {
    current,
    target,
    percent,
    isComplete: earned,
  };
}

function mapBadge(row: BadgeRow, stats: UserAnimeStats) {
  const earned = Boolean(row.earnedAt);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    category: row.category,
    conditionType: row.conditionType,
    conditionValue: row.conditionValue,
    rarity: row.rarity,
    hidden: Boolean(row.hidden),
    earned,
    earnedAt: row.earnedAt,
    progressSnapshot: parseProgressSnapshot(row.progressSnapshot),
    progress: buildProgress(row, stats, earned),
  };
}

export async function ensureInitialBadges() {
  for (const badge of INITIAL_BADGES) {
    await pool.execute<ResultSetHeader>(
      `
      INSERT INTO badges (
        code,
        name,
        description,
        image_url,
        category,
        condition_type,
        condition_value,
        rarity,
        is_active,
        hidden
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        image_url = VALUES(image_url),
        category = VALUES(category),
        condition_type = VALUES(condition_type),
        condition_value = VALUES(condition_value),
        rarity = VALUES(rarity),
        is_active = TRUE
      `,
      [
        badge.code,
        badge.name,
        badge.description,
        badge.imageUrl,
        badge.category,
        badge.conditionType,
        badge.conditionValue,
        badge.rarity,
      ]
    );
  }
}

async function getActiveBadgeRows(userId: number) {
  const [rows] = await pool.query<BadgeRow[]>(
    `
    SELECT
      b.id,
      b.code,
      b.name,
      b.description,
      b.image_url AS imageUrl,
      b.category,
      b.condition_type AS conditionType,
      b.condition_value AS conditionValue,
      b.rarity,
      b.is_active AS isActive,
      b.hidden,
      b.created_at AS createdAt,
      ub.earned_at AS earnedAt,
      ub.progress_snapshot AS progressSnapshot
    FROM badges b
    LEFT JOIN user_badges ub
      ON ub.badge_id = b.id
      AND ub.user_id = ?
    WHERE b.is_active = TRUE
    ORDER BY
      FIELD(b.rarity, 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'),
      b.id ASC
    `,
    [userId]
  );

  return rows;
}

export async function recalculateUserBadges(userId: number) {
  await ensureInitialBadges();

  const stats = await getUserAnimeStats(userId);
  const rows = await getActiveBadgeRows(userId);
  const newlyEarned = [];
  let revokedCount = 0;

  for (const badge of rows) {
    const shouldBeEarned = isBadgeEarnedByStats(badge, stats);

    if (badge.earnedAt && !shouldBeEarned) {
      const [result] = await pool.execute<ResultSetHeader>(
        `
        DELETE FROM user_badges
        WHERE user_id = ?
          AND badge_id = ?
        `,
        [userId, badge.id]
      );
      revokedCount += result.affectedRows;
      continue;
    }

    if (badge.earnedAt || !shouldBeEarned) {
      continue;
    }

    const progressSnapshot = buildProgressSnapshot(badge, stats);
    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT IGNORE INTO user_badges (
        user_id,
        badge_id,
        progress_snapshot
      )
      VALUES (?, ?, ?)
      `,
      [userId, badge.id, JSON.stringify(progressSnapshot)]
    );

    if (result.affectedRows > 0) {
      newlyEarned.push({
        ...mapBadge({
          ...badge,
          earnedAt: new Date().toISOString(),
          progressSnapshot,
        }, stats),
      });
    }
  }

  return {
    stats,
    newlyEarned,
    revokedCount,
  };
}

export async function getMyBadgeList(userId: number) {
  const { stats, newlyEarned } = await recalculateUserBadges(userId);
  const rows = await getActiveBadgeRows(userId);
  const items = rows
    .filter((row) => !row.hidden || row.earnedAt)
    .map((row) => mapBadge(row, stats));

  return {
    items,
    newlyEarned,
    earnedCount: items.filter((item) => item.earned).length,
    totalCount: items.length,
  };
}

export async function getPublicUserBadgeList(userId: number) {
  const { stats } = await recalculateUserBadges(userId);
  const rows = await getActiveBadgeRows(userId);
  const items = rows
    .filter((row) => row.earnedAt && !row.hidden)
    .map((row) => mapBadge(row, stats));

  return {
    items,
    earnedCount: items.length,
  };
}

export async function recalculateAllUserBadges() {
  await ensureInitialBadges();

  const [rows] = await pool.query<BadgeUserRow[]>(
    `
    SELECT id AS userId
    FROM users
    ORDER BY id ASC
    `
  );

  let newlyEarnedCount = 0;
  let revokedCount = 0;

  for (const row of rows) {
    const result = await recalculateUserBadges(row.userId);
    newlyEarnedCount += result.newlyEarned.length;
    revokedCount += result.revokedCount;
  }

  return {
    processedUserCount: rows.length,
    newlyEarnedCount,
    revokedCount,
  };
}
