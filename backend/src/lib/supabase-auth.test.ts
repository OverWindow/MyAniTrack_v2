import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeSupabaseAuthTokenClaims,
  hasGoogleOAuthSession,
  validateSupabaseTokenUser,
} from './supabase-auth';

function createToken(payload: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'test-signature',
  ].join('.');
}

test('Supabase token claims normalize audience and authentication methods', () => {
  const claims = decodeSupabaseAuthTokenClaims(createToken({
    sub: 'user-1',
    aud: ['authenticated'],
    amr: [
      { method: 'oauth', timestamp: 1 },
      { method: 'token_refresh', timestamp: 2 },
    ],
  }));

  assert.deepEqual(claims, {
    subject: 'user-1',
    audience: ['authenticated'],
    authenticationMethods: ['oauth', 'token_refresh'],
  });
});

test('only Google OAuth sessions satisfy the Google OAuth policy', () => {
  assert.equal(hasGoogleOAuthSession({
    providers: ['email', 'google'],
    authenticationMethods: ['password'],
  }), false);
  assert.equal(hasGoogleOAuthSession({
    providers: ['google'],
    authenticationMethods: [],
  }), false);
  assert.equal(hasGoogleOAuthSession({
    providers: ['github'],
    authenticationMethods: ['oauth'],
  }), false);
  assert.equal(hasGoogleOAuthSession({
    providers: ['google'],
    authenticationMethods: ['oauth'],
  }), true);
});

test('Supabase token identity and audience must match the verified user', () => {
  const validClaims = decodeSupabaseAuthTokenClaims(createToken({
    sub: 'user-1',
    aud: 'authenticated',
    amr: [{ method: 'oauth', timestamp: 1 }],
  }));

  assert.doesNotThrow(() => validateSupabaseTokenUser(validClaims, 'user-1'));
  assert.throws(() => validateSupabaseTokenUser(validClaims, 'user-2'), /Invalid Supabase token/);
  assert.throws(
    () => validateSupabaseTokenUser({ ...validClaims, audience: ['anon'] }, 'user-1'),
    /Invalid Supabase token/
  );
});

test('malformed or incomplete Supabase tokens are rejected', () => {
  assert.throws(() => decodeSupabaseAuthTokenClaims('not-a-jwt'), /Invalid Supabase token/);
  assert.throws(
    () => decodeSupabaseAuthTokenClaims(createToken({ aud: 'authenticated' })),
    /Invalid Supabase token/
  );
});
