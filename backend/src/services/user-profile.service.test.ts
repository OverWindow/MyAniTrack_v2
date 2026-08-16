import assert from 'node:assert/strict';
import test from 'node:test';
import { SupabaseStorageError } from '../lib/supabase-storage';
import {
  ProfileUpdateStage,
  updateUserProfile,
  UserProfileDependencies,
  UserProfileRecord,
} from './user-profile.service';

interface ProfileOverrides {
  id?: number;
  email?: string;
  username?: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function profile(overrides: ProfileOverrides = {}) {
  return {
    id: 7,
    email: 'user@example.com',
    username: 'tester',
    profileImageUrl: 'https://cdn.example.com/old.jpg',
    bio: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as UserProfileRecord;
}

function fixture(options: {
  uploadError?: Error;
  updateError?: Error;
  deleteNewError?: Error;
  deleteOldError?: Error;
} = {}) {
  let current = profile();
  const deletedObjectKeys: string[] = [];
  const deletedImageUrls: string[] = [];
  const stages: ProfileUpdateStage[] = [];
  let uploadCount = 0;
  let updateCount = 0;

  const dependencies: UserProfileDependencies = {
    findUserById: async () => current,
    updateUser: async (_userId, username, profileImageUrl) => {
      updateCount += 1;
      if (options.updateError) throw options.updateError;
      current = profile({ username, profileImageUrl });
    },
    uploadProfileImage: async () => {
      uploadCount += 1;
      if (options.uploadError) throw options.uploadError;
      return {
        objectKey: 'profile-images/user-7/new.jpg',
        publicUrl: 'https://cdn.example.com/new.jpg',
      };
    },
    deleteObjectByKey: async (objectKey) => {
      deletedObjectKeys.push(objectKey);
      if (options.deleteNewError) throw options.deleteNewError;
    },
    deleteProfileImageByUrl: async (imageUrl) => {
      if (imageUrl) deletedImageUrls.push(imageUrl);
      if (options.deleteOldError) throw options.deleteOldError;
    },
  };

  return {
    dependencies,
    deletedObjectKeys,
    deletedImageUrls,
    stages,
    get uploadCount() {
      return uploadCount;
    },
    get updateCount() {
      return updateCount;
    },
  };
}

test('profile image upload stores the new URL and deletes the old object', async () => {
  const state = fixture();
  const result = await updateUserProfile(
    {
      userId: 7,
      username: 'next_user',
      profileImage: { buffer: Buffer.from('jpeg'), mimetype: 'image/jpeg' },
      trace: (stage) => state.stages.push(stage),
    },
    state.dependencies,
  );

  assert.equal(result.username, 'next_user');
  assert.equal(result.profileImageUrl, 'https://cdn.example.com/new.jpg');
  assert.deepEqual(state.deletedImageUrls, ['https://cdn.example.com/old.jpg']);
  assert.ok(state.stages.includes('storage_upload_succeeded'));
  assert.ok(state.stages.includes('database_update_succeeded'));
  assert.ok(state.stages.includes('old_object_delete_succeeded'));
});

test('storage failure does not update the database', async () => {
  const state = fixture({ uploadError: new SupabaseStorageError('upload', 503) });

  await assert.rejects(
    updateUserProfile(
      {
        userId: 7,
        profileImage: { buffer: Buffer.from('jpeg'), mimetype: 'image/jpeg' },
        trace: (stage) => state.stages.push(stage),
      },
      state.dependencies,
    ),
    SupabaseStorageError,
  );

  assert.equal(state.updateCount, 0);
  assert.ok(state.stages.includes('storage_upload_failed'));
});

test('database failure removes the newly uploaded object', async () => {
  const state = fixture({ updateError: new Error('database unavailable') });

  await assert.rejects(
    updateUserProfile(
      {
        userId: 7,
        profileImage: { buffer: Buffer.from('jpeg'), mimetype: 'image/jpeg' },
        trace: (stage) => state.stages.push(stage),
      },
      state.dependencies,
    ),
    /database unavailable/,
  );

  assert.deepEqual(state.deletedObjectKeys, ['profile-images/user-7/new.jpg']);
  assert.ok(state.stages.includes('new_object_cleanup_succeeded'));
});

test('profile image removal clears the URL and deletes the old object', async () => {
  const state = fixture();
  const result = await updateUserProfile(
    { userId: 7, removeProfileImage: 'true' },
    state.dependencies,
  );

  assert.equal(result.profileImageUrl, null);
  assert.equal(state.uploadCount, 0);
  assert.deepEqual(state.deletedImageUrls, ['https://cdn.example.com/old.jpg']);
});

test('old object deletion failure does not roll back a saved profile', async () => {
  const state = fixture({ deleteOldError: new Error('delete unavailable') });
  const result = await updateUserProfile(
    {
      userId: 7,
      profileImage: { buffer: Buffer.from('jpeg'), mimetype: 'image/jpeg' },
      trace: (stage) => state.stages.push(stage),
    },
    state.dependencies,
  );

  assert.equal(result.profileImageUrl, 'https://cdn.example.com/new.jpg');
  assert.ok(state.stages.includes('old_object_delete_failed'));
});

test('invalid MIME type and files over 5MB are rejected before upload', async () => {
  const invalidMime = fixture();
  await assert.rejects(
    updateUserProfile(
      {
        userId: 7,
        profileImage: { buffer: Buffer.from('text'), mimetype: 'text/plain' },
      },
      invalidMime.dependencies,
    ),
    /must be an image file/,
  );
  assert.equal(invalidMime.uploadCount, 0);

  const oversized = fixture();
  await assert.rejects(
    updateUserProfile(
      {
        userId: 7,
        profileImage: {
          buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
          mimetype: 'image/jpeg',
        },
      },
      oversized.dependencies,
    ),
    /5MB or smaller/,
  );
  assert.equal(oversized.uploadCount, 0);
});
