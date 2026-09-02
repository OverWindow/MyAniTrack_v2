const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface SupabaseAuthUser {
  id: string;
  email: string;
  emailConfirmedAt: string | null;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  providers: string[];
  authenticationMethods: string[];
}

export interface SupabaseAuthTokenClaims {
  subject: string;
  audience: string[];
  authenticationMethods: string[];
}

export function hasGoogleOAuthSession(user: Pick<SupabaseAuthUser, 'providers' | 'authenticationMethods'>) {
  return user.providers.includes('google') && user.authenticationMethods.includes('oauth');
}

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getSupabaseUrl() {
  const rawUrl = requireEnv(SUPABASE_URL, 'SUPABASE_URL').replace(/\/+$/, '');

  try {
    const url = new URL(rawUrl);

    if (url.hostname.endsWith('.storage.supabase.co')) {
      url.hostname = url.hostname.replace('.storage.supabase.co', '.supabase.co');
    }

    url.pathname = url.pathname
      .replace(/\/storage\/v1\/s3\/?$/, '')
      .replace(/\/storage\/v1\/?$/, '')
      .replace(/\/+$/, '');
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('SUPABASE_URL must be a valid Supabase project URL');
  }
}

function getSupabaseApiKey() {
  return SUPABASE_ANON_KEY || requireEnv(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}

function getSupabaseServiceRoleKey() {
  return requireEnv(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeProviders(appMetadata: Record<string, unknown>) {
  const providers = appMetadata.providers;

  if (Array.isArray(providers)) {
    return providers
      .filter((provider): provider is string => typeof provider === 'string')
      .map((provider) => provider.trim().toLowerCase())
      .filter(Boolean);
  }

  const provider = appMetadata.provider;

  return typeof provider === 'string' && provider.trim()
    ? [provider.trim().toLowerCase()]
    : [];
}

function normalizeAudience(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim().toLowerCase()];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function normalizeAuthenticationMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return '';
      }

      const method = (entry as Record<string, unknown>).method;
      return typeof method === 'string' ? method.trim().toLowerCase() : '';
    })
    .filter(Boolean);
}

export function decodeSupabaseAuthTokenClaims(accessToken: string): SupabaseAuthTokenClaims {
  const parts = accessToken.split('.');

  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid Supabase token');
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    const audience = normalizeAudience(payload.aud);

    if (!subject || audience.length === 0) {
      throw new Error('Invalid Supabase token');
    }

    return {
      subject,
      audience,
      authenticationMethods: normalizeAuthenticationMethods(payload.amr),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid Supabase token') {
      throw error;
    }

    throw new Error('Invalid Supabase token');
  }
}

export function validateSupabaseTokenUser(claims: SupabaseAuthTokenClaims, userId: string) {
  if (claims.subject !== userId || !claims.audience.includes('authenticated')) {
    throw new Error('Invalid Supabase token');
  }
}

export async function getSupabaseAuthUser(accessToken: string): Promise<SupabaseAuthUser> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: getSupabaseApiKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Invalid Supabase token');
  }

  const data = await response.json() as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';

  if (!id || !email) {
    throw new Error('Invalid Supabase user');
  }

  const appMetadata = normalizeMetadata(data.app_metadata);
  const tokenClaims = decodeSupabaseAuthTokenClaims(accessToken);

  validateSupabaseTokenUser(tokenClaims, id);

  return {
    id,
    email,
    emailConfirmedAt:
      typeof data.email_confirmed_at === 'string'
        ? data.email_confirmed_at
        : typeof data.confirmed_at === 'string'
          ? data.confirmed_at
          : null,
    appMetadata,
    userMetadata: normalizeMetadata(data.user_metadata),
    providers: normalizeProviders(appMetadata),
    authenticationMethods: tokenClaims.authenticationMethods,
  };
}

export async function deleteSupabaseAuthUser(supabaseUserId: string) {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const response = await fetch(
    `${getSupabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(supabaseUserId)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (response.ok || response.status === 404) {
    return;
  }

  const message = await response.text().catch(() => '');
  throw new Error(`Supabase user deletion failed${message ? `: ${message}` : ''}`);
}
