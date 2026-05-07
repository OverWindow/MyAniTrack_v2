import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

interface UserAgreementStatusRow extends RowDataPacket {
  userId: number;
  termsAgreed: number | boolean;
  privacyAgreed: number | boolean;
  agreedAt: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
}

export interface UpdateUserAgreementsInput {
  termsAgreed?: unknown;
  termsVersion?: unknown;
  privacyAgreed?: unknown;
  privacyVersion?: unknown;
}

function validateOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

function validateVersion(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  if (normalizedValue.length > 20) {
    throw new Error(`${fieldName} must be 20 characters or fewer`);
  }

  return normalizedValue;
}

async function findUserAgreementStatus(userId: number) {
  const [rows] = await pool.query<UserAgreementStatusRow[]>(
    `
    SELECT
      u.id AS userId,
      u.terms_agreed AS termsAgreed,
      u.privacy_agreed AS privacyAgreed,
      u.agreed_at AS agreedAt,
      (
        SELECT ua.version
        FROM user_agreements ua
        WHERE ua.user_id = u.id
          AND ua.agreement_type = 'TERMS'
        ORDER BY ua.id DESC
        LIMIT 1
      ) AS termsVersion,
      (
        SELECT ua.version
        FROM user_agreements ua
        WHERE ua.user_id = u.id
          AND ua.agreement_type = 'PRIVACY'
        ORDER BY ua.id DESC
        LIMIT 1
      ) AS privacyVersion
    FROM users u
    WHERE u.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

function mapUserAgreementStatus(row: UserAgreementStatusRow) {
  return {
    userId: row.userId,
    termsAgreed: Boolean(row.termsAgreed),
    privacyAgreed: Boolean(row.privacyAgreed),
    agreedAt: row.agreedAt,
    termsVersion: row.termsVersion,
    privacyVersion: row.privacyVersion,
  };
}

export async function getUserAgreementStatus(userId: number) {
  const status = await findUserAgreementStatus(userId);

  if (!status) {
    throw new Error('User not found');
  }

  return mapUserAgreementStatus(status);
}

export async function updateUserAgreements(userId: number, input: UpdateUserAgreementsInput) {
  const currentStatus = await findUserAgreementStatus(userId);

  if (!currentStatus) {
    throw new Error('User not found');
  }

  const nextTermsAgreed = validateOptionalBoolean(input.termsAgreed, 'termsAgreed');
  const nextPrivacyAgreed = validateOptionalBoolean(input.privacyAgreed, 'privacyAgreed');

  if (nextTermsAgreed === undefined && nextPrivacyAgreed === undefined) {
    throw new Error('At least one agreement field is required');
  }

  const termsVersion = nextTermsAgreed !== undefined
    ? validateVersion(input.termsVersion, 'termsVersion')
    : undefined;
  const privacyVersion = nextPrivacyAgreed !== undefined
    ? validateVersion(input.privacyVersion, 'privacyVersion')
    : undefined;

  const currentTermsAgreed = Boolean(currentStatus.termsAgreed);
  const currentPrivacyAgreed = Boolean(currentStatus.privacyAgreed);
  const resolvedTermsAgreed = nextTermsAgreed ?? currentTermsAgreed;
  const resolvedPrivacyAgreed = nextPrivacyAgreed ?? currentPrivacyAgreed;

  let nextAgreedAt: string | null = currentStatus.agreedAt;
  const shouldSetAgreedAt = resolvedTermsAgreed && resolvedPrivacyAgreed;
  const stateChanged =
    resolvedTermsAgreed !== currentTermsAgreed
    || resolvedPrivacyAgreed !== currentPrivacyAgreed;

  if (shouldSetAgreedAt) {
    nextAgreedAt = stateChanged || !currentStatus.agreedAt
      ? new Date().toISOString().slice(0, 19).replace('T', ' ')
      : currentStatus.agreedAt;
  } else {
    nextAgreedAt = null;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute<ResultSetHeader>(
      `
      UPDATE users
      SET
        terms_agreed = ?,
        privacy_agreed = ?,
        agreed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [resolvedTermsAgreed, resolvedPrivacyAgreed, nextAgreedAt, userId]
    );

    if (nextTermsAgreed !== undefined && nextTermsAgreed !== currentTermsAgreed) {
      await connection.execute<ResultSetHeader>(
        `
        INSERT INTO user_agreements (
          user_id,
          agreement_type,
          version,
          agreed,
          agreed_at
        )
        VALUES (?, 'TERMS', ?, ?, CURRENT_TIMESTAMP)
        `,
        [userId, termsVersion as string, nextTermsAgreed]
      );
    }

    if (nextPrivacyAgreed !== undefined && nextPrivacyAgreed !== currentPrivacyAgreed) {
      await connection.execute<ResultSetHeader>(
        `
        INSERT INTO user_agreements (
          user_id,
          agreement_type,
          version,
          agreed,
          agreed_at
        )
        VALUES (?, 'PRIVACY', ?, ?, CURRENT_TIMESTAMP)
        `,
        [userId, privacyVersion as string, nextPrivacyAgreed]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getUserAgreementStatus(userId);
}

