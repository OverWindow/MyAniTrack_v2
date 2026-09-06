// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  getMaintenanceGateState,
  isMaintenanceBypassPath,
} from './maintenance'
import type { MaintenanceSettings } from '../types/maintenance'

const enabledSettings: MaintenanceSettings = {
  enabled: true,
  title: { ko: 'Korean maintenance title', en: 'Maintenance' },
  message: { ko: 'Korean maintenance message', en: 'Please wait.' },
  updatedAt: '2026-09-06T00:00:00.000Z',
}

function getGateState(overrides: Partial<Parameters<typeof getMaintenanceGateState>[0]> = {}) {
  return getMaintenanceGateState({
    pathname: '/',
    settings: enabledSettings,
    isMaintenanceLoading: false,
    isAuthBootstrapping: false,
    isAdmin: false,
    ...overrides,
  })
}

describe('maintenance gate', () => {
  it('waits for status and admin identity without flashing the app', () => {
    expect(getGateState({ isMaintenanceLoading: true })).toBe('loading')
    expect(getGateState({ isAuthBootstrapping: true })).toBe('loading')
  })

  it('shows maintenance to ordinary users and lets administrators bypass it', () => {
    expect(getGateState()).toBe('maintenance')
    expect(getGateState({ isAdmin: true })).toBe('app')
  })

  it('fails open and renders the app while maintenance is disabled', () => {
    expect(getGateState({ settings: null })).toBe('app')
    expect(getGateState({ settings: { ...enabledSettings, enabled: false } })).toBe('app')
  })

  it('keeps authentication and policy routes available', () => {
    const bypassPaths = [
      '/login',
      '/signup',
      '/auth/callback',
      '/verify-email/pending',
      '/verify-email/confirm',
      '/password-reset',
      '/password-reset/confirm',
      '/terms',
      '/privacy',
      '/account-deletion',
    ]

    for (const pathname of bypassPaths) {
      expect(isMaintenanceBypassPath(pathname)).toBe(true)
      expect(getGateState({ pathname })).toBe('app')
    }

    expect(isMaintenanceBypassPath('/admin')).toBe(false)
    expect(isMaintenanceBypassPath('/s/example')).toBe(false)
  })
})
