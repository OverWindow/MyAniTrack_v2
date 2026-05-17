import crypto from 'crypto';

const ACCESS_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'dev-only-secret-change-me';
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = Number(process.env.AUTH_TOKEN_EXPIRES_IN_SECONDS || 60 * 15);
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = Number(process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 30);

interface AccessTokenPayload {
  userId: number;
  email: string;
  username: string;
  role?: string;
  type: 'access';
  exp: number;
}

export interface RefreshTokenValue {
  token: string;
  jti: string;
  expiresAt: Date;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(value).digest('base64url');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key as Buffer);
    });
  });

  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, originalHash] = storedHash.split(':');

  if (!salt || !originalHash) {
    return false;
  }

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key as Buffer);
    });
  });

  const originalBuffer = Buffer.from(originalHash, 'hex');

  if (originalBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuffer, derivedKey);
}

export function createAccessToken(user: { id: number; email: string; username: string; role?: string }) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const [encodedHeader, encodedPayload, signature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Invalid token');
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error('Invalid token');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AccessTokenPayload;

  if (
    !payload.userId ||
    !payload.email ||
    !payload.username ||
    payload.type !== 'access' ||
    !payload.exp
  ) {
    throw new Error('Invalid token');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

export function createRefreshToken(): RefreshTokenValue {
  const jti = crypto.randomUUID();
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000);

  return {
    token,
    jti,
    expiresAt,
  };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getAccessTokenExpiresInSeconds() {
  return ACCESS_TOKEN_EXPIRES_IN_SECONDS;
}

export function getRefreshTokenExpiresInSeconds() {
  return REFRESH_TOKEN_EXPIRES_IN_SECONDS;
}
