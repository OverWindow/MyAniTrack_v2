import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

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

export type FriendRequestAction = 'accept' | 'reject' | 'cancel';

export interface SendFriendRequestInput {
  receiverId?: number;
  username?: string;
}

function mapUser(row: Pick<FriendUserRow, 'id' | 'username' | 'profileImageUrl' | 'bio' | 'animeListCount'>) {
  return {
    id: row.id,
    username: row.username,
    profileImageUrl: row.profileImageUrl,
    bio: row.bio,
    animeListCount: row.animeListCount,
  };
}

function mapRequestUser(row: FriendRequestListRow) {
  return {
    id: row.userId,
    username: row.username,
    profileImageUrl: row.profileImageUrl,
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
        INSERT INTO friendships (user_id, friend_user_id)
        VALUES (?, ?), (?, ?)
        ON DUPLICATE KEY UPDATE created_at = created_at
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
      profileImageUrl: row.profileImageUrl,
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
