import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import { deleteObjectByKey, deleteProfileImageByUrl, getObjectKeyFromPublicUrl, uploadProfileImage } from '../lib/r2';

interface UserProfileRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UploadedProfileImageFile {
  buffer: Buffer;
  mimetype: string;
}

export interface UpdateUserProfileParams {
  userId: number;
  username?: unknown;
  removeProfileImage?: unknown;
  profileImage?: UploadedProfileImageFile;
}

function normalizeOptionalUsername(username: unknown) {
  if (username === undefined) {
    return undefined;
  }

  if (typeof username !== 'string') {
    throw new Error('username must be a string');
  }

  const normalizedUsername = username.trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
    throw new Error('username must be 3-20 characters using only letters, numbers, and underscore');
  }

  return normalizedUsername;
}

function normalizeRemoveProfileImage(value: unknown) {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  return false;
}

function validateProfileImage(file?: UploadedProfileImageFile) {
  if (!file) {
    return;
  }

  if (!file.mimetype.startsWith('image/')) {
    throw new Error('profileImage must be an image file');
  }
}

async function findUserById(userId: number) {
  const [rows] = await pool.query<UserProfileRow[]>(
    `
    SELECT
      id,
      email,
      username,
      profile_image_url AS profileImageUrl,
      bio,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

function mapUserProfile(user: UserProfileRow) {
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

export async function updateUserProfile(params: UpdateUserProfileParams) {
  const user = await findUserById(params.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const username = normalizeOptionalUsername(params.username);
  const removeProfileImage = normalizeRemoveProfileImage(params.removeProfileImage);
  validateProfileImage(params.profileImage);

  if (username === undefined && !params.profileImage && !removeProfileImage) {
    throw new Error('At least one profile field is required');
  }

  let newProfileImageUrl = user.profileImageUrl;
  let uploadedObjectKey: string | null = null;
  let oldProfileImageUrlToDelete: string | null = null;

  if (params.profileImage) {
    const uploadedImage = await uploadProfileImage({
      userId: params.userId,
      buffer: params.profileImage.buffer,
      contentType: params.profileImage.mimetype,
    });

    uploadedObjectKey = uploadedImage.objectKey;
    newProfileImageUrl = uploadedImage.publicUrl;
    oldProfileImageUrlToDelete = user.profileImageUrl;
  } else if (removeProfileImage && user.profileImageUrl) {
    newProfileImageUrl = null;
    oldProfileImageUrlToDelete = user.profileImageUrl;
  }

  const nextUsername = username ?? user.username;

  try {
    await pool.execute<ResultSetHeader>(
      `
      UPDATE users
      SET
        username = ?,
        profile_image_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [nextUsername, newProfileImageUrl, params.userId]
    );
  } catch (error) {
    if (uploadedObjectKey) {
      await deleteObjectByKey(uploadedObjectKey).catch(() => undefined);
    }

    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Username already exists');
    }

    throw error;
  }

  if (oldProfileImageUrlToDelete && oldProfileImageUrlToDelete !== newProfileImageUrl) {
    await deleteProfileImageByUrl(oldProfileImageUrlToDelete).catch(() => undefined);
  }

  const updatedUser = await findUserById(params.userId);

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return mapUserProfile(updatedUser);
}

export function getUserProfileImageKey(imageUrl: string) {
  return getObjectKeyFromPublicUrl(imageUrl);
}
