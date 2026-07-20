import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { normalizeProfileImageUrl } from '../lib/supabase-storage';

interface FriendUserRow extends RowDataPacket {
  id: number;
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  animeListCount: number;
}

interface FriendRequestStatusRow extends RowDataPacket {
  id: number;
  requesterId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  respondedAt: string | null;
}

interface FriendRequestListRow extends RowDataPacket {
  requestId: number;
  requesterId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  respondedAt: string | null;
  userId: number;
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  animeListCount: number;
}

interface FriendListRow extends RowDataPacket {
  friendshipId: number;
  createdAt: string;
  userId: number;
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  animeListCount: number;
}

interface UserSearchRow extends FriendUserRow {
  relationship: 'none' | 'incoming' | 'outgoing' | 'friend';
  requestId: number | null;
}

export type FriendRequestAction = 'accept' | 'reject' | 'cancel';

export interface SendFriendRequestInput {
  receiverId?: number;
  username?: string;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function decodeUserSearchCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      query?: unknown;
      username?: unknown;
      userId?: unknown;
    };
    if (
      typeof value.query !== 'string' ||
      typeof value.username !== 'string' ||
      !Number.isInteger(value.userId) ||
      Number(value.userId) <= 0
    ) {
      throw new Error('Invalid cursor');
    }
    return { query: value.query, username: value.username, userId: Number(value.userId) };
  } catch {
    throw new Error('Invalid cursor');
  }
}

export async function searchUsers(
  currentUserId: number,
  rawQuery: string,
  limit: number,
  encodedCursor?: string
) {
  const query = rawQuery.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (query.length < 2 || query.length > 50) {
    throw new Error('query must be between 2 and 50 characters');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
    throw new Error('limit must be an integer between 1 and 30');
  }

  const cursor = decodeUserSearchCursor(encodedCursor);
  if (cursor && cursor.query !== query) {
    throw new Error('Cursor query does not match requested query');
  }

  const params: Array<string | number> = [currentUserId, currentUserId, currentUserId, currentUserId];
  const cursorWhere = cursor
    ? 'AND (LOWER(u.username) > ? OR (LOWER(u.username) = ? AND u.id > ?))'
    : '';
  params.push(`%${escapeLike(query)}%`);
  if (cursor) params.push(cursor.username, cursor.username, cursor.userId);
  params.push(limit + 1);

  const [rows] = await pool.query<UserSearchRow[]>(
    `
    SELECT
      u.id,
      u.username,
      u.profile_image_url AS profileImageUrl,
      u.bio,
      (SELECT COUNT(*) FROM user_anime_lists ual WHERE ual.user_id = u.id) AS animeListCount,
      CASE
        WHEN f.id IS NOT NULL THEN 'friend'
        WHEN incoming.id IS NOT NULL THEN 'incoming'
        WHEN outgoing.id IS NOT NULL THEN 'outgoing'
        ELSE 'none'
      END AS relationship,
      COALESCE(incoming.id, outgoing.id) AS requestId
    FROM users u
    LEFT JOIN friendships f
      ON f.user_id = ? AND f.friend_user_id = u.id
    LEFT JOIN friend_requests incoming
      ON incoming.requester_id = u.id AND incoming.receiver_id = ? AND incoming.status = 'pending'
    LEFT JOIN friend_requests outgoing
      ON outgoing.requester_id = ? AND outgoing.receiver_id = u.id AND outgoing.status = 'pending'
    WHERE u.id <> ?
      AND LOWER(u.username) LIKE ? ESCAPE '\\\\'
      ${cursorWhere}
    ORDER BY LOWER(u.username) ASC, u.id ASC
    LIMIT ?
    `,
    params
  );

  const hasNext = rows.length > limit;
  const pageRows = hasNext ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    items: pageRows.map((row) => ({
      user: mapUser(row),
      relationship: row.relationship,
      requestId: row.requestId,
    })),
    pageInfo: {
      limit,
      hasNext,
      nextCursor: hasNext && last
        ? Buffer.from(JSON.stringify({ query, username: last.username.toLocaleLowerCase(), userId: last.id }))
            .toString('base64url')
        : null,
    },
  };
}

function mapUser(row: Pick<FriendUserRow, 'id' | 'username' | 'profileImageUrl' | 'bio' | 'animeListCount'>) {
  return {
    id: row.id,
    username: row.username,
    profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl),
    bio: row.bio,
    animeListCount: row.animeListCount,
  };
}

function mapRequestUser(row: FriendRequestListRow) {
  return {
    id: row.userId,
    username: row.username,
    profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl),
    bio: row.bio,
    animeListCount: row.animeListCount,
  };
}

async function findUserById(userId: number) {
  const [rows] = await pool.query<FriendUserRow[]>(
    `
    SELECT
      id,
      username,
      profile_image_url AS profileImageUrl,
      bio,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = users.id
      ) AS animeListCount
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

async function findUserByUsername(username: string) {
  const [rows] = await pool.query<FriendUserRow[]>(
    `
    SELECT
      id,
      username,
      profile_image_url AS profileImageUrl,
      bio,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = users.id
      ) AS animeListCount
    FROM users
    WHERE username = ?
    LIMIT 1
    `,
    [username]
  );

  return rows[0] ?? null;
}

async function findFriendRequestById(requestId: number) {
  const [rows] = await pool.query<FriendRequestStatusRow[]>(
    `
    SELECT
      id,
      requester_id AS requesterId,
      receiver_id AS receiverId,
      status,
      created_at AS createdAt,
      responded_at AS respondedAt
    FROM friend_requests
    WHERE id = ?
    LIMIT 1
    `,
    [requestId]
  );

  return rows[0] ?? null;
}

async function findSameDirectionRequest(requesterId: number, receiverId: number) {
  const [rows] = await pool.query<FriendRequestStatusRow[]>(
    `
    SELECT
      id,
      requester_id AS requesterId,
      receiver_id AS receiverId,
      status,
      created_at AS createdAt,
      responded_at AS respondedAt
    FROM friend_requests
    WHERE requester_id = ?
      AND receiver_id = ?
    LIMIT 1
    `,
    [requesterId, receiverId]
  );

  return rows[0] ?? null;
}

async function findReverseDirectionPendingRequest(requesterId: number, receiverId: number) {
  const [rows] = await pool.query<FriendRequestStatusRow[]>(
    `
    SELECT
      id,
      requester_id AS requesterId,
      receiver_id AS receiverId,
      status,
      created_at AS createdAt,
      responded_at AS respondedAt
    FROM friend_requests
    WHERE requester_id = ?
      AND receiver_id = ?
      AND status = 'pending'
    LIMIT 1
    `,
    [receiverId, requesterId]
  );

  return rows[0] ?? null;
}

async function areFriends(userId: number, friendUserId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT 1
    FROM friendships
    WHERE user_id = ?
      AND friend_user_id = ?
    LIMIT 1
    `,
    [userId, friendUserId]
  );

  return rows.length > 0;
}

async function backfillAcceptedFriendships(userId: number) {
  await pool.execute<ResultSetHeader>(
    `
    INSERT IGNORE INTO friendships (user_id, friend_user_id)
    SELECT fr.requester_id, fr.receiver_id
    FROM friend_requests fr
    WHERE fr.status = 'accepted'
      AND (fr.requester_id = ? OR fr.receiver_id = ?)
    `,
    [userId, userId]
  );

  await pool.execute<ResultSetHeader>(
    `
    INSERT IGNORE INTO friendships (user_id, friend_user_id)
    SELECT fr.receiver_id, fr.requester_id
    FROM friend_requests fr
    WHERE fr.status = 'accepted'
      AND (fr.requester_id = ? OR fr.receiver_id = ?)
    `,
    [userId, userId]
  );
}

export async function sendFriendRequest(userId: number, input: SendFriendRequestInput) {
  const normalizedUsername = typeof input.username === 'string' ? input.username.trim() : '';
  const hasReceiverId = input.receiverId !== undefined;
  const hasUsername = normalizedUsername.length > 0;

  if (!hasReceiverId && !hasUsername) {
    throw new Error('Either receiverId or username is required');
  }

  if (hasReceiverId && (!Number.isInteger(input.receiverId) || Number(input.receiverId) <= 0)) {
    throw new Error('receiverId must be a positive integer');
  }

  if (hasUsername && !/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
    throw new Error('username must be 3-20 characters using only letters, numbers, and underscore');
  }

  let receiver: FriendUserRow | null = null;

  if (hasReceiverId) {
    receiver = await findUserById(Number(input.receiverId));
  } else {
    receiver = await findUserByUsername(normalizedUsername);
  }

  if (!receiver) {
    throw new Error('Receiver user not found');
  }

  const receiverId = receiver.id;

  if (userId === receiverId) {
    throw new Error('You cannot send a friend request to yourself');
  }

  if (await areFriends(userId, receiverId)) {
    throw new Error('Users are already friends');
  }

  const sameDirectionRequest = await findSameDirectionRequest(userId, receiverId);

  if (sameDirectionRequest?.status === 'pending') {
    throw new Error('Friend request already sent');
  }

  const reversePendingRequest = await findReverseDirectionPendingRequest(userId, receiverId);

  if (reversePendingRequest) {
    throw new Error('Incoming friend request already exists');
  }

  let requestId: number;

  if (sameDirectionRequest) {
    await pool.execute<ResultSetHeader>(
      `
      UPDATE friend_requests
      SET
        status = 'pending',
        responded_at = NULL,
        created_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [sameDirectionRequest.id]
    );

    requestId = sameDirectionRequest.id;
  } else {
    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT INTO friend_requests (
        requester_id,
        receiver_id,
        status
      )
      VALUES (?, ?, 'pending')
      `,
      [userId, receiverId]
    );

    requestId = result.insertId;
  }

  return {
    id: requestId,
    status: 'pending' as const,
    receiver: mapUser(receiver),
  };
}

export async function getFriendRequests(userId: number) {
  const [incomingRows] = await pool.query<FriendRequestListRow[]>(
    `
    SELECT
      fr.id AS requestId,
      fr.requester_id AS requesterId,
      fr.receiver_id AS receiverId,
      fr.status,
      fr.created_at AS createdAt,
      fr.responded_at AS respondedAt,
      u.id AS userId,
      u.username,
      u.profile_image_url AS profileImageUrl,
      u.bio,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = u.id
      ) AS animeListCount
    FROM friend_requests fr
    INNER JOIN users u
      ON u.id = fr.requester_id
    WHERE fr.receiver_id = ?
      AND fr.status = 'pending'
    ORDER BY fr.created_at DESC, fr.id DESC
    `,
    [userId]
  );

  const [outgoingRows] = await pool.query<FriendRequestListRow[]>(
    `
    SELECT
      fr.id AS requestId,
      fr.requester_id AS requesterId,
      fr.receiver_id AS receiverId,
      fr.status,
      fr.created_at AS createdAt,
      fr.responded_at AS respondedAt,
      u.id AS userId,
      u.username,
      u.profile_image_url AS profileImageUrl,
      u.bio,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = u.id
      ) AS animeListCount
    FROM friend_requests fr
    INNER JOIN users u
      ON u.id = fr.receiver_id
    WHERE fr.requester_id = ?
      AND fr.status = 'pending'
    ORDER BY fr.created_at DESC, fr.id DESC
    `,
    [userId]
  );

  return {
    incoming: incomingRows.map((row) => ({
      id: row.requestId,
      requesterId: row.requesterId,
      receiverId: row.receiverId,
      status: row.status,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
      user: mapRequestUser(row),
    })),
    outgoing: outgoingRows.map((row) => ({
      id: row.requestId,
      requesterId: row.requesterId,
      receiverId: row.receiverId,
      status: row.status,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
      user: mapRequestUser(row),
    })),
  };
}

export async function respondToFriendRequest(
  userId: number,
  requestId: number,
  action: FriendRequestAction
) {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw new Error('requestId must be a positive integer');
  }

  const request = await findFriendRequestById(requestId);

  if (!request) {
    throw new Error('Friend request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Friend request is no longer pending');
  }

  if ((action === 'accept' || action === 'reject') && request.receiverId !== userId) {
    throw new Error('Only the receiver can accept or reject this friend request');
  }

  if (action === 'cancel' && request.requesterId !== userId) {
    throw new Error('Only the requester can cancel this friend request');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const nextStatus = action === 'accept'
      ? 'accepted'
      : action === 'reject'
        ? 'rejected'
        : 'cancelled';

    await connection.execute<ResultSetHeader>(
      `
      UPDATE friend_requests
      SET
        status = ?,
        responded_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [nextStatus, requestId]
    );

    if (action === 'accept') {
      await connection.execute<ResultSetHeader>(
        `
        INSERT IGNORE INTO friendships (user_id, friend_user_id)
        VALUES (?, ?), (?, ?)
        `,
        [request.requesterId, request.receiverId, request.receiverId, request.requesterId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const counterpartUserId = request.requesterId === userId ? request.receiverId : request.requesterId;
  const counterpartUser = await findUserById(counterpartUserId);

  return {
    id: request.id,
    requesterId: request.requesterId,
    receiverId: request.receiverId,
    status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'cancelled',
    user: counterpartUser ? mapUser(counterpartUser) : null,
  };
}

export async function getFriends(userId: number) {
  await backfillAcceptedFriendships(userId);

  const [rows] = await pool.query<FriendListRow[]>(
    `
    SELECT
      f.id AS friendshipId,
      f.created_at AS createdAt,
      u.id AS userId,
      u.username,
      u.profile_image_url AS profileImageUrl,
      u.bio,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        WHERE ual.user_id = u.id
      ) AS animeListCount
    FROM friendships f
    INNER JOIN users u
      ON u.id = f.friend_user_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC, f.id DESC
    `,
    [userId]
  );

  return rows.map((row) => ({
    id: row.friendshipId,
    createdAt: row.createdAt,
    user: {
      id: row.userId,
      username: row.username,
      profileImageUrl: normalizeProfileImageUrl(row.profileImageUrl),
      bio: row.bio,
      animeListCount: row.animeListCount,
    },
  }));
}

export async function removeFriend(userId: number, friendUserId: number) {
  if (!Number.isInteger(friendUserId) || friendUserId <= 0) {
    throw new Error('friendUserId must be a positive integer');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `
      DELETE FROM friendships
      WHERE (user_id = ? AND friend_user_id = ?)
         OR (user_id = ? AND friend_user_id = ?)
      `,
      [userId, friendUserId, friendUserId, userId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Friendship not found');
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
