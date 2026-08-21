import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import {
  deleteObjectByKey,
  deleteProfileImageByUrl,
  getObjectKeyFromPublicUrl,
  normalizeProfileImageUrl,
  uploadProfileImage,
} from '../lib/supabase-storage';

export interface UserProfileRecord extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PublicUserProfileRow extends RowDataPacket {
  id: number;
  username: string;
  profileImageUrl: string | null;
  bio: string | null;
  animeListCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UploadedProfileImageFile {
  buffer: Buffer;
  mimetype: string;
}

export type ProfileUpdateStage =
  | 'file_validated'
  | 'storage_upload_started'
  | 'storage_upload_succeeded'
  | 'storage_upload_failed'
  | 'database_update_started'
  | 'database_update_succeeded'
  | 'database_update_failed'
  | 'new_object_cleanup_succeeded'
  | 'new_object_cleanup_failed'
  | 'old_object_delete_started'
  | 'old_object_delete_succeeded'
  | 'old_object_delete_failed';

export type ProfileUpdateTrace = (
  stage: ProfileUpdateStage,
  details?: Record<string, unknown>,
) => void;

export interface UserProfileDependencies {
  findUserById(userId: number): Promise<UserProfileRecord | null>;
  updateUser(
    userId: number,
    username: string,
    profileImageUrl: string | null,
  ): Promise<void>;
  uploadProfileImage: typeof uploadProfileImage;
  deleteObjectByKey: typeof deleteObjectByKey;
  deleteProfileImageByUrl: typeof deleteProfileImageByUrl;
}

export interface UpdateUserProfileParams {
  userId: number;
  username?: unknown;
  removeProfileImage?: unknown;
  profileImage?: UploadedProfileImageFile;
  trace?: ProfileUpdateTrace;
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

  if (file.buffer.length > 5 * 1024 * 1024) {
    throw new Error('profileImage must be 5MB or smaller');
  }
}

async function findUserById(userId: number) {
  const [rows] = await pool.query<UserProfileRecord[]>(
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

async function updateUser(
  userId: number,
  username: string,
  profileImageUrl: string | null,
) {
  await pool.execute<ResultSetHeader>(
    `
    UPDATE users
    SET
      username = ?,
      profile_image_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [username, profileImageUrl, userId],
  );
}

async function findPublicUserById(userId: number) {
  const [rows] = await pool.query<PublicUserProfileRow[]>(
    `
    SELECT
      u.id,
      u.username,
      u.profile_image_url AS profileImageUrl,
      u.bio,
      (
        SELECT COUNT(*)
        FROM user_anime_lists ual
        INNER JOIN anime a
          ON a.id = ual.anime_id
          AND a.is_adult = FALSE
          AND a.app_visible = TRUE
        WHERE ual.user_id = u.id
      ) AS animeListCount,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt
    FROM users u
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

function mapUserProfile(user: UserProfileRecord) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    profileImageUrl: normalizeProfileImageUrl(user.profileImageUrl),
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapPublicUserProfile(user: PublicUserProfileRow) {
  return {
    id: user.id,
    username: user.username,
    profileImageUrl: normalizeProfileImageUrl(user.profileImageUrl),
    bio: user.bio,
    animeListCount: user.animeListCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getPublicUserProfile(userId: number) {
  const user = await findPublicUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return mapPublicUserProfile(user);
}

const defaultDependencies: UserProfileDependencies = {
  findUserById,
  updateUser,
  uploadProfileImage,
  deleteObjectByKey,
  deleteProfileImageByUrl,
};

export async function updateUserProfile(
  params: UpdateUserProfileParams,
  dependencies: UserProfileDependencies = defaultDependencies,
) {
  const user = await dependencies.findUserById(params.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const username = normalizeOptionalUsername(params.username);
  const removeProfileImage = normalizeRemoveProfileImage(params.removeProfileImage);
  validateProfileImage(params.profileImage);
  params.trace?.('file_validated', {
    hasImage: Boolean(params.profileImage),
    removeProfileImage,
    mimeType: params.profileImage?.mimetype,
    size: params.profileImage?.buffer.length,
  });

  if (username === undefined && !params.profileImage && !removeProfileImage) {
    throw new Error('At least one profile field is required');
  }

  let newProfileImageUrl = normalizeProfileImageUrl(user.profileImageUrl);
  let uploadedObjectKey: string | null = null;
  let oldProfileImageUrlToDelete: string | null = null;

  if (params.profileImage) {
    params.trace?.('storage_upload_started');
    let uploadedImage: Awaited<ReturnType<typeof uploadProfileImage>>;

    try {
      uploadedImage = await dependencies.uploadProfileImage({
        userId: params.userId,
        buffer: params.profileImage.buffer,
        contentType: params.profileImage.mimetype,
      });
      params.trace?.('storage_upload_succeeded', {
        objectKey: uploadedImage.objectKey,
      });
    } catch (error) {
      params.trace?.('storage_upload_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }

    uploadedObjectKey = uploadedImage.objectKey;
    newProfileImageUrl = uploadedImage.publicUrl;
    oldProfileImageUrlToDelete = user.profileImageUrl;
  } else if (removeProfileImage && user.profileImageUrl) {
    newProfileImageUrl = null;
    oldProfileImageUrlToDelete = user.profileImageUrl;
  }

  const nextUsername = username ?? user.username;

  params.trace?.('database_update_started');
  try {
    await dependencies.updateUser(
      params.userId,
      nextUsername,
      newProfileImageUrl,
    );
    params.trace?.('database_update_succeeded');
  } catch (error) {
    params.trace?.('database_update_failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    if (uploadedObjectKey) {
      try {
        await dependencies.deleteObjectByKey(uploadedObjectKey);
        params.trace?.('new_object_cleanup_succeeded');
      } catch (cleanupError) {
        params.trace?.('new_object_cleanup_failed', {
          errorName:
            cleanupError instanceof Error
              ? cleanupError.name
              : 'UnknownError',
        });
      }
    }

    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error('Username already exists');
    }

    throw error;
  }

  if (oldProfileImageUrlToDelete && oldProfileImageUrlToDelete !== newProfileImageUrl) {
    params.trace?.('old_object_delete_started');
    try {
      await dependencies.deleteProfileImageByUrl(oldProfileImageUrlToDelete);
      params.trace?.('old_object_delete_succeeded');
    } catch (error) {
      params.trace?.('old_object_delete_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  const updatedUser = await dependencies.findUserById(params.userId);

  if (!updatedUser) {
    throw new Error('User not found');
  }

  return mapUserProfile(updatedUser);
}

export function getUserProfileImageKey(imageUrl: string) {
  return getObjectKeyFromPublicUrl(imageUrl);
}
