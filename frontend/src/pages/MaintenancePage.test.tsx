// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../contexts/LanguageContext'
import { SETTINGS_STORAGE_KEY } from '../i18n'
import { MaintenancePage } from './MaintenancePage'

const settings = {
  enabled: true,
  title: { ko: 'Korean maintenance title', en: "We'll be back soon" },
  message: { ko: 'Korean maintenance message', en: 'Please try again shortly.' },
  updatedAt: '2026-09-06T00:00:00.000Z',
}

describe('MaintenancePage', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('renders localized copy, policy links, and manual refresh', async () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ appLanguage: 'en' }))
    const onRefresh = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <LanguageProvider>
          <MaintenancePage settings={settings} isRefreshing={false} onRefresh={onRefresh} />
        </LanguageProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: "We'll be back soon" })).toBeInTheDocument())
    expect(screen.getByText('Please try again shortly.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin sign in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    expect(document.querySelector('.maintenance-illustration')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
