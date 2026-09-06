import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/db';

export type MaintenanceSettings = {
  enabled: boolean;
  title: {
    ko: string;
    en: string;
  };
  message: {
    ko: string;
    en: string;
  };
  updatedAt: string;
};

export type MaintenanceSettingsUpdate = Omit<MaintenanceSettings, 'updatedAt'>;

interface MaintenanceSettingsRow extends RowDataPacket {
  enabled: number | boolean;
  titleKo: string;
  titleEn: string;
  messageKo: string;
  messageEn: string;
  updatedAt: Date | string;
}

export class MaintenanceValidationError extends Error {}

function validateText(value: unknown, fieldName: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw new MaintenanceValidationError(`${fieldName} must be a string`);
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new MaintenanceValidationError(`${fieldName} must be between 1 and ${maxLength} characters`);
  }

  return normalized;
}

export function validateMaintenanceSettingsUpdate(value: unknown): MaintenanceSettingsUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MaintenanceValidationError('maintenance settings payload must be an object');
  }

  const payload = value as Record<string, unknown>;
  const title = payload.title;
  const message = payload.message;

  if (typeof payload.enabled !== 'boolean') {
    throw new MaintenanceValidationError('enabled must be a boolean');
  }

  if (!title || typeof title !== 'object' || Array.isArray(title)) {
    throw new MaintenanceValidationError('title must be an object');
  }

  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new MaintenanceValidationError('message must be an object');
  }

  const localizedTitle = title as Record<string, unknown>;
  const localizedMessage = message as Record<string, unknown>;

  return {
    enabled: payload.enabled,
    title: {
      ko: validateText(localizedTitle.ko, 'title.ko', 120),
      en: validateText(localizedTitle.en, 'title.en', 120),
    },
    message: {
      ko: validateText(localizedMessage.ko, 'message.ko', 1000),
      en: validateText(localizedMessage.en, 'message.en', 1000),
    },
  };
}

function formatSettings(row: MaintenanceSettingsRow): MaintenanceSettings {
  return {
    enabled: Boolean(row.enabled),
    title: {
      ko: row.titleKo,
      en: row.titleEn,
    },
    message: {
      ko: row.messageKo,
      en: row.messageEn,
    },
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export async function getMaintenanceSettings() {
  const [rows] = await pool.query<MaintenanceSettingsRow[]>(
    `
    SELECT
      enabled,
      title_ko AS titleKo,
      title_en AS titleEn,
      message_ko AS messageKo,
      message_en AS messageEn,
      updated_at AS updatedAt
    FROM maintenance_settings
    WHERE id = 1
    LIMIT 1
    `
  );

  if (!rows[0]) {
    throw new Error('Maintenance settings not found');
  }

  return formatSettings(rows[0]);
}

export async function updateMaintenanceSettings(
  adminUserId: number,
  payload: MaintenanceSettingsUpdate
) {
  const [result] = await pool.execute<ResultSetHeader>(
    `
    UPDATE maintenance_settings
    SET
      enabled = ?,
      title_ko = ?,
      title_en = ?,
      message_ko = ?,
      message_en = ?,
      updated_by = ?
    WHERE id = 1
    `,
    [
      payload.enabled,
      payload.title.ko,
      payload.title.en,
      payload.message.ko,
      payload.message.en,
      adminUserId,
    ]
  );

  if (result.affectedRows !== 1) {
    throw new Error('Maintenance settings not found');
  }

  return getMaintenanceSettings();
}
