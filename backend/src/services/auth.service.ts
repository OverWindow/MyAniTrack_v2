import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenExpiresInSeconds,
  hashPassword,
  hashRefreshToken,
  verifyPassword,
} from '../lib/auth';

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  passwordHash: string;
  profileImageUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignUpParams {
  email: string;
  username: string;
  password: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  deviceType?: string | null;
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface LoginParams {
  email: string;
  password: string;
  deviceType?: string | null;
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface RefreshSessionParams {
  refreshToken: string;
  deviceType?: string | null;
  deviceName?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

type DeviceType = 'web' | 'android' | 'ios' | 'unknown';

interface RefreshTokenRow extends RowDataPacket {
  id: number;
  userId: number;
  tokenHash: string;
  jti: string;
  deviceType: DeviceType;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  replacedByTokenId: number | null;
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeUsername(username: string): string {
  return username.trim();
}

function validateEmail(email: string) {
  const normalizedEmail = sanitizeEmail(email);

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid email is required');
  }

  return normalizedEmail;
}

function validateUsername(username: string) {
  const normalizedUsername = sanitizeUsername(username);

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
    throw new Error('username must be 3-20 characters using only letters, numbers, and underscore');
  }

  return normalizedUsername;
}

function validatePassword(password: string) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new Error('password must be between 8 and 72 characters');
  }

  return password;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue.slice(0, maxLength);
}

function normalizeDeviceType(value: unknown): DeviceType {
  if (value === 'web' || value === 'android' || value === 'ios' || value === 'unknown') {
    return value;
  }

  return 'unknown';
}

function toMysqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function findUserByEmail(email: string) {
  const [rows] = await pool.query<UserRow[]>(
    `
    SELECT
      id,
      email,
      username,
      password_hash AS passwordHash,
      profile_image_url AS profileImageUrl,
      bio,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [email]
  );

  return rows[0] ?? null;
}

async function findUserById(id: number) {
  const [rows] = await pool.query<UserRow[]>(
    `
    SELECT
      id,
      email,
      username,
      password_hash AS passwordHash,
      profile_image_url AS profileImageUrl,
      bio,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

function mapUserProfile(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    profileImageUrl: user.profileImageUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildAuthResponse(user: UserRow, refreshToken: string) {
  return {
    accessToken: createAccessToken(user),
    refreshToken,
    accessTokenExpiresIn: getAccessTokenExpiresInSeconds(),
    tokenType: 'Bearer',
    user: mapUserProfile(user),
  };
}

async function createRefreshTokenRecord(
  conn: PoolConnection,
  userId: number,
  metadata: {
    deviceType?: string | null;
    deviceName?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
  }
) {
  const refreshTokenValue = createRefreshToken();
  const tokenHash = hashRefreshToken(refreshTokenValue.token);
  const deviceType = normalizeDeviceType(metadata.deviceType);
  const deviceName = normalizeOptionalText(metadata.deviceName, 255);
  const userAgent = normalizeOptionalText(metadata.userAgent, 4000);
  const ipAddress = normalizeOptionalText(metadata.ipAddress, 45);

  const [result] = await conn.execute<ResultSetHeader>(
    `
    INSERT INTO refresh_tokens (
      user_id,
      token_hash,
      jti,
      device_type,
      device_name,
      user_agent,
      ip_address,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      tokenHash,
      refreshTokenValue.jti,
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
      toMysqlDateTime(refreshTokenValue.expiresAt),
    ]
  );

  return {
    id: result.insertId,
    token: refreshTokenValue.token,
  };
}

async function findRefreshTokenByTokenHash(tokenHash: string) {
  const [rows] = await pool.query<RefreshTokenRow[]>(
    `
    SELECT
      id,
      user_id AS userId,
      token_hash AS tokenHash,
      jti,
      device_type AS deviceType,
      device_name AS deviceName,
      user_agent AS userAgent,
      ip_address AS ipAddress,
      issued_at AS issuedAt,
      expires_at AS expiresAt,
      revoked_at AS revokedAt,
      revoke_reason AS revokeReason,
      replaced_by_token_id AS replacedByTokenId
    FROM refresh_tokens
    WHERE token_hash = ?
    LIMIT 1
    `,
    [tokenHash]
  );

  return rows[0] ?? null;
}

export async function signUp(params: SignUpParams) {
  const email = validateEmail(params.email);
  const username = validateUsername(params.username);
  const password = validatePassword(params.password);
  const profileImageUrl = normalizeOptionalText(params.profileImageUrl, 500);
  const bio = normalizeOptionalText(params.bio, 500);

  const passwordHash = await hashPassword(password);

  try {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [result] = await conn.execute<ResultSetHeader>(
        `
        INSERT INTO users (
          email,
          username,
          password_hash,
          profile_image_url,
          bio
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [email, username, passwordHash, profileImageUrl, bio]
      );

      const [userRows] = await conn.query<UserRow[]>(
        `
        SELECT
          id,
          email,
          username,
          password_hash AS passwordHash,
          profile_image_url AS profileImageUrl,
          bio,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [result.insertId]
      );

      const user = userRows[0];

      if (!user) {
        throw new Error('Failed to create user');
      }

      const refreshTokenRecord = await createRefreshTokenRecord(conn, user.id, params);

      await conn.commit();

      return buildAuthResponse(user, refreshTokenRecord.token);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Email or username already exists');
    }

    throw error;
  }
}

export async function login(params: LoginParams) {
  const normalizedEmail = validateEmail(params.email);
  const normalizedPassword = validatePassword(params.password);
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValidPassword = await verifyPassword(normalizedPassword, user.passwordHash);

  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const refreshTokenRecord = await createRefreshTokenRecord(conn, user.id, params);
    await conn.commit();

    return buildAuthResponse(user, refreshTokenRecord.token);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getMyProfile(userId: number) {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return mapUserProfile(user);
}

export async function refreshSession(params: RefreshSessionParams) {
  const incomingRefreshToken = normalizeOptionalText(params.refreshToken, 5000);

  if (!incomingRefreshToken) {
    throw new Error('refreshToken is required');
  }

  const tokenHash = hashRefreshToken(incomingRefreshToken);
  const existingToken = await findRefreshTokenByTokenHash(tokenHash);

  if (!existingToken) {
    throw new Error('Invalid refresh token');
  }

  if (existingToken.revokedAt) {
    throw new Error('Refresh token has been revoked');
  }

  if (new Date(existingToken.expiresAt).getTime() <= Date.now()) {
    throw new Error('Refresh token has expired');
  }

  const user = await findUserById(existingToken.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const newRefreshTokenRecord = await createRefreshTokenRecord(conn, user.id, {
      deviceType: params.deviceType ?? existingToken.deviceType,
      deviceName: params.deviceName ?? existingToken.deviceName,
      userAgent: params.userAgent ?? existingToken.userAgent,
      ipAddress: params.ipAddress ?? existingToken.ipAddress,
    });

    await conn.execute(
      `
      UPDATE refresh_tokens
      SET
        revoked_at = CURRENT_TIMESTAMP,
        revoke_reason = ?,
        replaced_by_token_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      ['rotated', newRefreshTokenRecord.id, existingToken.id]
    );

    await conn.commit();

    return buildAuthResponse(user, newRefreshTokenRecord.token);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function logout(refreshToken: string) {
  const normalizedToken = normalizeOptionalText(refreshToken, 5000);

  if (!normalizedToken) {
    throw new Error('refreshToken is required');
  }

  const tokenHash = hashRefreshToken(normalizedToken);
  const [result] = await pool.execute<ResultSetHeader>(
    `
    UPDATE refresh_tokens
    SET
      revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
      revoke_reason = COALESCE(revoke_reason, 'logout'),
      updated_at = CURRENT_TIMESTAMP
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    `,
    [tokenHash]
  );

  if (result.affectedRows === 0) {
    throw new Error('Invalid refresh token');
  }
}

export async function logoutAll(userId: number) {
  await pool.execute(
    `
    UPDATE refresh_tokens
    SET
      revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
      revoke_reason = COALESCE(revoke_reason, 'logout_all'),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND revoked_at IS NULL
    `,
    [userId]
  );
}
