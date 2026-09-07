import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';
import {
  deleteObjectByKey,
  deleteProfileImageByUrl,
  getObjectKeyFromPublicUrl,
  getS3ObjectKeyFromPublicUrl,
  isSupportedImageContentType,
  normalizeProfileImageUrl,
  uploadProfileImage,
} from '../lib/image-storage';
import { queueLegacySupabaseObjectWithPool } from './legacy-image-cleanup.service';

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

interface ProfileImageMutation {
  removed?: boolean;
  objectKey?: string;
  contentType?: string;
  contentSizeBytes?: number;
  contentSha256?: string;
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
    imageMutation?: ProfileImageMutation,
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

  if (!isSupportedImageContentType(file.mimetype)) {
    throw new Error('profileImage must be JPEG, PNG, WebP, GIF, or AVIF');
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
  imageMutation?: ProfileImageMutation,
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
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

    const objectKey = imageMutation?.objectKey
      ?? (imageMutation && profileImageUrl ? getS3ObjectKeyFromPublicUrl(profileImageUrl) : null);

    if (imageMutation && objectKey && profileImageUrl) {
      await connection.execute(
        `
        INSERT INTO catalog_image_assets (
          entity_type,
          entity_id,
          anilist_id,
          variant,
          source_url,
          source_hash,
          source_provider,
          object_key,
          public_url,
          storage_provider,
          content_type,
          content_size_bytes,
          content_sha256,
          status,
          synced_at
        )
        VALUES (
          'user_profile', ?, ?, 'profile_image', ?, SHA2(?, 256),
          'cloudfront', ?, ?, 's3', ?, ?, ?, 'success', CURRENT_TIMESTAMP
        )
        ON DUPLICATE KEY UPDATE
          entity_id = VALUES(entity_id),
          source_url = VALUES(source_url),
          source_hash = VALUES(source_hash),
          source_provider = VALUES(source_provider),
          object_key = VALUES(object_key),
          public_url = VALUES(public_url),
          storage_provider = VALUES(storage_provider),
          content_type = VALUES(content_type),
          content_size_bytes = VALUES(content_size_bytes),
          content_sha256 = VALUES(content_sha256),
          status = 'success',
          attempt_count = 0,
          last_error = NULL,
          job_id = NULL,
          synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          userId,
          userId,
          profileImageUrl,
          profileImageUrl,
          objectKey,
          profileImageUrl,
          imageMutation.contentType ?? null,
          imageMutation.contentSizeBytes ?? null,
          imageMutation.contentSha256 ?? null,
        ],
      );
    } else if (imageMutation?.removed) {
      await connection.execute(
        `
        DELETE FROM catalog_image_assets
        WHERE entity_type = 'user_profile'
          AND entity_id = ?
          AND variant = 'profile_image'
        `,
        [userId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  deleteProfileImageByUrl: async (imageUrl) => {
    if (imageUrl && !getS3ObjectKeyFromPublicUrl(imageUrl)) {
      await queueLegacySupabaseObjectWithPool({ publicUrl: imageUrl });
      return;
    }

    await deleteProfileImageByUrl(imageUrl);
  },
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
  let imageMutation: ProfileImageMutation | undefined;

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
    imageMutation = {
      objectKey: uploadedImage.objectKey,
      contentType: params.profileImage.mimetype,
      contentSizeBytes: uploadedImage.contentSizeBytes,
      contentSha256: uploadedImage.contentSha256,
    };
  } else if (removeProfileImage && user.profileImageUrl) {
    newProfileImageUrl = null;
    oldProfileImageUrlToDelete = user.profileImageUrl;
    imageMutation = { removed: true };
  }

  const nextUsername = username ?? user.username;

  params.trace?.('database_update_started');
  try {
    await dependencies.updateUser(
      params.userId,
      nextUsername,
      newProfileImageUrl,
      imageMutation,
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
