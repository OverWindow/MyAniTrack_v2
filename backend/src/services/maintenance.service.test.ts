import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { validateMaintenanceSettingsUpdate } from './maintenance.service';

test('maintenance settings validation trims and accepts complete localized content', () => {
  assert.deepEqual(validateMaintenanceSettingsUpdate({
    enabled: true,
    title: { ko: '  점검 중  ', en: '  Maintenance  ' },
    message: { ko: '  잠시 기다려주세요.  ', en: '  Please wait.  ' },
  }), {
    enabled: true,
    title: { ko: '점검 중', en: 'Maintenance' },
    message: { ko: '잠시 기다려주세요.', en: 'Please wait.' },
  });
});

test('maintenance settings validation rejects invalid types and text lengths', () => {
  const valid = {
    enabled: false,
    title: { ko: '점검 중', en: 'Maintenance' },
    message: { ko: '잠시 기다려주세요.', en: 'Please wait.' },
  };

  assert.throws(() => validateMaintenanceSettingsUpdate({ ...valid, enabled: 1 }), /enabled must be a boolean/);
  assert.throws(() => validateMaintenanceSettingsUpdate({
    ...valid,
    title: { ...valid.title, ko: '   ' },
  }), /title\.ko must be between 1 and 120 characters/);
  assert.throws(() => validateMaintenanceSettingsUpdate({
    ...valid,
    message: { ...valid.message, en: 'x'.repeat(1001) },
  }), /message\.en must be between 1 and 1000 characters/);
});

test('maintenance migration creates an off-by-default singleton with localized copy', () => {
  const sql = readFileSync(join(process.cwd(), 'sql_scripts', '022_maintenance_settings.sql'), 'utf8');

  assert.match(sql, /CREATE TABLE maintenance_settings/);
  assert.match(sql, /enabled BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(sql, /INSERT INTO maintenance_settings/);
  assert.match(sql, /'서비스 점검 중입니다'/);
  assert.match(sql, /'We''ll be back soon'/);
});

test('maintenance routes keep the public status endpoint separate from the admin update', () => {
  const publicRoutes = readFileSync(join(process.cwd(), 'src', 'routes', 'maintenance.routes.ts'), 'utf8');
  const adminRoutes = readFileSync(join(process.cwd(), 'routes', 'admin.routes.ts'), 'utf8');
  const controller = readFileSync(join(process.cwd(), 'src', 'controllers', 'maintenance.controller.ts'), 'utf8');

  assert.match(publicRoutes, /router\.get\('\/maintenance', getMaintenanceSettingsController\)/);
  assert.match(adminRoutes, /router\.use\('\/admin', requireAdmin\)/);
  assert.match(adminRoutes, /router\.patch\('\/admin\/maintenance', updateMaintenanceSettingsController\)/);
  assert.match(controller, /Cache-Control', 'no-store'/);
});
