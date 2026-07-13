import crypto from 'crypto';
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
import { sendPasswordResetEmail, sendVerifyEmail } from '../lib/mail';
import { deleteSupabaseAuthUser, getSupabaseAuthUser, SupabaseAuthUser } from '../lib/supabase-auth';
import { deleteProfileImageByUrl, normalizeProfileImageUrl } from '../lib/supabase-storage';

type UserRole = 'USER' | 'ADMIN';
type EmailTokenPurpose = 'SIGNUP_VERIFY' | 'PASSWORD_RESET';

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  profileImageUrl: string | null;
  bio: string | null;
  emailVerified: number | boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EmailVerificationTokenRow extends RowDataPacket {
  id: number;
  userId: number | null;
  email: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
}

interface PasswordResetRateRow extends RowDataPacket {
  lastMinute: number | string;
  lastHour: number | string;
  lastDay: number | string;
}

interface UserDeletionRow extends RowDataPacket {
  id: number;
  email: string;
  profileImageUrl: string | null;
  supabaseUserId: string | null;
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

export interface SendVerificationEmailParams {
  email: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface RequestPasswordResetParams {
  email: string;
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
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ');
}

function hashEmailToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createEmailTokenValue() {
  return crypto.randomBytes(32).toString('base64url');
}

function getSignupVerifyExpiresAt() {
  const hours = Number(process.env.EMAIL_SIGNUP_VERIFY_EXPIRES_HOURS || 24);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function getPasswordResetExpiresAt() {
  const minutes = Number(process.env.EMAIL_PASSWORD_RESET_EXPIRES_MINUTES || 60);
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function findUserByEmail(email: string) {
  const [rows] = await pool.query<UserRow[]>(
    `
    SELECT
      id,
      email,
      username,
      role,
      password_hash AS passwordHash,
      profile_image_url AS profileImageUrl,
      bio,
      email_verified AS emailVerified,
      email_verified_at AS emailVerifiedAt,
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

async function findUserByUsername(username: string) {
  const [rows] = await pool.query<UserRow[]>(
    `
    SELECT
      id,
      email,
      username,
      role,
      password_hash AS passwordHash,
      profile_image_url AS profileImageUrl,
      bio,
      email_verified AS emailVerified,
      email_verified_at AS emailVerifiedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE username = ?
    LIMIT 1
    `,
    [username]
  );

  return rows[0] ?? null;
}

async function findUserBySupabaseUserId(supabaseUserId: string) {
  const [rows] = await pool.query<UserRow[]>(
    `
    SELECT
      id,
      email,
      username,
      role,
      password_hash AS passwordHash,
      profile_image_url AS profileImageUrl,
      bio,
      email_verified AS emailVerified,
      email_verified_at AS emailVerifiedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE supabase_user_id = ?
    LIMIT 1
    `,
    [supabaseUserId]
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
      role,
      password_hash AS passwordHash,
      profile_image_url AS profileImageUrl,
      bio,
      email_verified AS emailVerified,
      email_verified_at AS emailVerifiedAt,
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

async function findUserDeletionTargetById(id: number) {
  const [rows] = await pool.query<UserDeletionRow[]>(
    `
    SELECT
      id,
      email,
      profile_image_url AS profileImageUrl,
      supabase_user_id AS supabaseUserId
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

async function findEmailTokenByHash(tokenHash: string, purpose: EmailTokenPurpose) {
  const [rows] = await pool.query<EmailVerificationTokenRow[]>(
    `
    SELECT
      id,
      user_id AS userId,
      email,
      purpose,
      token_hash AS tokenHash,
      expires_at AS expiresAt,
      used_at AS usedAt
    FROM email_verification_tokens
    WHERE token_hash = ?
      AND purpose = ?
    LIMIT 1
    `,
    [tokenHash, purpose]
  );

  return rows[0] ?? null;
}

function mapUserProfile(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isAdmin: user.role === 'ADMIN',
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt,
    profileImageUrl: normalizeProfileImageUrl(user.profileImageUrl),
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getSupabaseProvider(user: SupabaseAuthUser) {
  const provider = user.appMetadata.provider;

  return typeof provider === 'string' && provider.trim()
    ? provider.trim().slice(0, 30)
    : user.providers[0]
      ? user.providers[0].slice(0, 30)
    : 'supabase';
}

function getSupabaseMetadataText(user: SupabaseAuthUser, keys: string[]) {
  for (const key of keys) {
    const value = user.userMetadata[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildUsernameBase(user: SupabaseAuthUser) {
  const metadataName = getSupabaseMetadataText(user, ['user_name', 'preferred_username', 'name', 'full_name']);
  const rawBase = metadataName || user.email.split('@')[0] || 'user';
  const normalizedBase = rawBase
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);

  return normalizedBase.length >= 3 ? normalizedBase : `user_${normalizedBase}`.slice(0, 16);
}

async function createUniqueUsername(user: SupabaseAuthUser) {
  const base = buildUsernameBase(user);
  const baseCandidate = base.slice(0, 20);

  if (!await findUserByUsername(baseCandidate)) {
    return baseCandidate;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${base.slice(0, Math.max(3, 20 - suffix.length - 1))}_${suffix}`;

    if (!await findUserByUsername(candidate)) {
      return candidate;
    }
  }

  throw new Error('Failed to create unique username');
}

function isSupabaseEmailVerified(user: SupabaseAuthUser) {
  return Boolean(user.emailConfirmedAt) || user.providers.includes('google');
}

async function linkExistingUserToSupabase(user: UserRow, supabaseUser: SupabaseAuthUser) {
  await pool.execute(
    `
    UPDATE users
    SET
      supabase_user_id = ?,
      auth_provider = ?,
      email_verified = TRUE,
      email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [supabaseUser.id, getSupabaseProvider(supabaseUser), user.id]
  );

  const linkedUser = await findUserById(user.id);

  if (!linkedUser) {
    throw new Error('User not found');
  }

  return linkedUser;
}

async function createUserFromSupabase(supabaseUser: SupabaseAuthUser) {
  const username = await createUniqueUsername(supabaseUser);
  const provider = getSupabaseProvider(supabaseUser);
  const conn = await pool.getConnection();
  let createdUserId = 0;

  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `
      INSERT INTO users (
        email,
        username,
        password_hash,
        role,
        email_verified,
        email_verified_at,
        supabase_user_id,
        auth_provider
      )
      VALUES (?, ?, ?, 'USER', TRUE, CURRENT_TIMESTAMP, ?, ?)
      `,
      [
        supabaseUser.email,
        username,
        `SUPABASE_AUTH:${supabaseUser.id}`,
        supabaseUser.id,
        provider,
      ]
    );

    createdUserId = result.insertId;
    await conn.commit();
  } catch (error) {
    await conn.rollback();

    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      const existingUser = await findUserByEmail(supabaseUser.email);

      if (existingUser) {
        return linkExistingUserToSupabase(existingUser, supabaseUser);
      }
    }

    throw error;
  } finally {
    conn.release();
  }

  const createdUser = await findUserById(createdUserId);

  if (!createdUser) {
    throw new Error('Failed to create user');
  }

  return createdUser;
}

export async function findOrCreateUserFromSupabaseToken(accessToken: string) {
  const supabaseUser = await getSupabaseAuthUser(accessToken);

  if (!isSupabaseEmailVerified(supabaseUser)) {
    throw new Error('Supabase email verification required');
  }

  const existingLinkedUser = await findUserBySupabaseUserId(supabaseUser.id);

  if (existingLinkedUser) {
    return existingLinkedUser;
  }

  const existingEmailUser = await findUserByEmail(supabaseUser.email);

  if (existingEmailUser) {
    return linkExistingUserToSupabase(existingEmailUser, supabaseUser);
  }

  return createUserFromSupabase(supabaseUser);
}

export async function loginWithSupabaseAccessToken(accessToken: string) {
  const normalizedToken = normalizeOptionalText(accessToken, 5000);

  if (!normalizedToken) {
    throw new Error('accessToken is required');
  }

  const user = await findOrCreateUserFromSupabaseToken(normalizedToken);

  return {
    tokenType: 'Bearer',
    authProvider: 'supabase',
    user: mapUserProfile(user),
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

async function createEmailTokenRecord(
  conn: PoolConnection,
  params: {
    userId: number | null;
    email: string;
    purpose: EmailTokenPurpose;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
) {
  const token = createEmailTokenValue();
  const tokenHash = hashEmailToken(token);
  const requestIp = normalizeOptionalText(params.ipAddress, 45);
  const userAgent = normalizeOptionalText(params.userAgent, 500);

  await conn.execute<ResultSetHeader>(
    `
    INSERT INTO email_verification_tokens (
      user_id,
      email,
      purpose,
      token_hash,
      expires_at,
      request_ip,
      user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      params.userId,
      params.email,
      params.purpose,
      tokenHash,
      toMysqlDateTime(params.expiresAt),
      requestIp,
      userAgent,
    ]
  );

  return token;
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
  const profileImageUrl = normalizeProfileImageUrl(normalizeOptionalText(params.profileImageUrl, 500));
  const bio = normalizeOptionalText(params.bio, 500);

  const passwordHash = await hashPassword(password);
  const conn = await pool.getConnection();
  let user: UserRow | null = null;
  let verifyToken = '';

  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `
      INSERT INTO users (
        email,
        username,
        password_hash,
        profile_image_url,
        bio,
        role,
        email_verified,
        email_verified_at
      )
      VALUES (?, ?, ?, ?, ?, 'USER', FALSE, NULL)
      `,
      [email, username, passwordHash, profileImageUrl, bio]
    );

    const [userRows] = await conn.query<UserRow[]>(
      `
      SELECT
        id,
        email,
        username,
        role,
        password_hash AS passwordHash,
        profile_image_url AS profileImageUrl,
        bio,
        email_verified AS emailVerified,
        email_verified_at AS emailVerifiedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    user = userRows[0] ?? null;

    if (!user) {
      throw new Error('Failed to create user');
    }

    verifyToken = await createEmailTokenRecord(conn, {
      userId: user.id,
      email: user.email,
      purpose: 'SIGNUP_VERIFY',
      expiresAt: getSignupVerifyExpiresAt(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await conn.commit();
  } catch (error) {
    await conn.rollback();

    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Email or username already exists');
    }

    throw error;
  } finally {
    conn.release();
  }

  if (!user) {
    throw new Error('Failed to create user');
  }

  await sendVerifyEmail({
    to: user.email,
    token: verifyToken,
  });

  return {
    requiresEmailVerification: true,
    user: mapUserProfile(user),
  };
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

  if (!user.emailVerified) {
    throw new Error('Email verification required');
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

export async function checkUsernameAvailability(username: string) {
  const normalizedUsername = validateUsername(username);
  const user = await findUserByUsername(normalizedUsername);

  return {
    username: normalizedUsername,
    available: !user,
  };
}

export async function getMyProfile(userId: number) {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return mapUserProfile(user);
}

export async function sendSignupVerificationEmail(params: SendVerificationEmailParams) {
  const email = validateEmail(params.email);
  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.emailVerified) {
    throw new Error('Email already verified');
  }

  const conn = await pool.getConnection();
  let token = '';

  try {
    await conn.beginTransaction();
    token = await createEmailTokenRecord(conn, {
      userId: user.id,
      email: user.email,
      purpose: 'SIGNUP_VERIFY',
      expiresAt: getSignupVerifyExpiresAt(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await sendVerifyEmail({
    to: user.email,
    token,
  });

  return {
    email: user.email,
    requiresEmailVerification: true,
  };
}

export async function verifySignupEmail(token: string) {
  const normalizedToken = normalizeOptionalText(token, 5000);

  if (!normalizedToken) {
    throw new Error('token is required');
  }

  const tokenHash = hashEmailToken(normalizedToken);
  const verificationToken = await findEmailTokenByHash(tokenHash, 'SIGNUP_VERIFY');

  if (!verificationToken) {
    throw new Error('Invalid verification token');
  }

  if (verificationToken.usedAt) {
    throw new Error('Verification token has already been used');
  }

  if (new Date(verificationToken.expiresAt).getTime() <= Date.now()) {
    throw new Error('Verification token has expired');
  }

  if (!verificationToken.userId) {
    throw new Error('Invalid verification token');
  }

  const user = await findUserById(verificationToken.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `
      UPDATE users
      SET
        email_verified = TRUE,
        email_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [user.id]
    );

    await conn.execute(
      `
      UPDATE email_verification_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [verificationToken.id]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const verifiedUser = await findUserById(user.id);

  if (!verifiedUser) {
    throw new Error('User not found');
  }

  return {
    user: mapUserProfile(verifiedUser),
  };
}

export async function requestPasswordReset(params: RequestPasswordResetParams) {
  const email = validateEmail(params.email);

  // Do not await account lookup, token creation, or mail delivery. The public
  // response must be the same for existing and non-existing accounts, including
  // when the mail provider is unavailable.
  void processPasswordResetRequest(email, params).catch((error) => {
    console.error('Password reset email processing failed', error);
  });
}

async function processPasswordResetRequest(
  email: string,
  params: RequestPasswordResetParams
) {
  const user = await findUserByEmail(email);

  if (!user || !user.emailVerified) {
    return;
  }

  const conn = await pool.getConnection();
  let token = '';
  let shouldSend = false;

  try {
    await conn.beginTransaction();

    // Serialize requests for the same account so concurrent calls cannot all
    // pass the quota check before any of them inserts a token.
    await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);

    const [rateRows] = await conn.query<PasswordResetRateRow[]>(
      `
      SELECT
        SUM(created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE)) AS lastMinute,
        SUM(created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)) AS lastHour,
        SUM(created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)) AS lastDay
      FROM email_verification_tokens
      WHERE user_id = ?
        AND purpose = 'PASSWORD_RESET'
      `,
      [user.id]
    );

    const rate = rateRows[0];
    const lastMinute = Number(rate?.lastMinute || 0);
    const lastHour = Number(rate?.lastHour || 0);
    const lastDay = Number(rate?.lastDay || 0);

    if (lastMinute < 1 && lastHour < 3 && lastDay < 5) {
      // Only the most recently issued password reset link remains valid.
      await conn.execute(
        `
        UPDATE email_verification_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND purpose = 'PASSWORD_RESET'
          AND used_at IS NULL
        `,
        [user.id]
      );

      token = await createEmailTokenRecord(conn, {
        userId: user.id,
        email: user.email,
        purpose: 'PASSWORD_RESET',
        expiresAt: getPasswordResetExpiresAt(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      shouldSend = true;
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  if (shouldSend) {
    await sendPasswordResetEmail({
      to: user.email,
      token,
      email: user.email,
    });
  }
}

export async function resetPasswordWithEmailToken(token: string, newPassword: string) {
  const normalizedToken = normalizeOptionalText(token, 5000);

  if (!normalizedToken) {
    throw new Error('token is required');
  }

  const password = validatePassword(newPassword);
  const passwordHash = await hashPassword(password);
  const tokenHash = hashEmailToken(normalizedToken);
  const resetToken = await findEmailTokenByHash(tokenHash, 'PASSWORD_RESET');

  if (!resetToken) {
    throw new Error('Invalid password reset token');
  }

  if (resetToken.usedAt) {
    throw new Error('Password reset token has already been used');
  }

  if (new Date(resetToken.expiresAt).getTime() <= Date.now()) {
    throw new Error('Password reset token has expired');
  }

  if (!resetToken.userId) {
    throw new Error('Invalid password reset token');
  }

  const user = await findUserById(resetToken.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Serialize reset confirmation with new reset-email issuance for this user.
    await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);

    const [claimResult] = await conn.execute<ResultSetHeader>(
      `
      UPDATE email_verification_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      `,
      [resetToken.id]
    );

    if (claimResult.affectedRows !== 1) {
      throw new Error('Invalid password reset token');
    }

    await conn.execute(
      `
      UPDATE users
      SET
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [passwordHash, user.id]
    );

    await conn.execute(
      `
      UPDATE refresh_tokens
      SET
        revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
        revoke_reason = COALESCE(revoke_reason, 'password_reset'),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND revoked_at IS NULL
      `,
      [user.id]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return {
    email: user.email,
    reset: true,
  };
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

  if (!user.emailVerified) {
    throw new Error('Email verification required');
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

export async function deleteMyAccount(userId: number) {
  const user = await findUserDeletionTargetById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.supabaseUserId) {
    await deleteSupabaseAuthUser(user.supabaseUserId);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `
    DELETE FROM users
    WHERE id = ?
    `,
    [user.id]
  );

  if (result.affectedRows === 0) {
    throw new Error('User not found');
  }

  deleteProfileImageByUrl(user.profileImageUrl).catch((error) => {
    console.error('Failed to delete profile image during account deletion', error);
  });

  return {
    deleted: true,
    userId: user.id,
    email: user.email,
  };
}

