// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider, useAppLanguage } from './LanguageContext'
import { SETTINGS_STORAGE_KEY } from '../i18n'

const HOME_KEY = String.fromCharCode(54856)

function LanguageProbe() {
  const { locale, preferredLocale, t } = useAppLanguage()
  return <div>{locale}|{preferredLocale}|{t(HOME_KEY)}</div>
}

function renderAt(pathname: string, appLanguage: 'ko' | 'en') {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ appLanguage }))
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <LanguageProvider><LanguageProbe /></LanguageProvider>
    </MemoryRouter>,
  )
}

describe('LanguageProvider', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('updates document language and translations for a public route', async () => {
    renderAt('/', 'en')
    await waitFor(() => expect(screen.getByText('en|en|Home')).toBeInTheDocument())
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('MyAniTrack - Anime Tracking and Social Discovery')
  })

  it('forces Korean on admin while retaining the saved preference', async () => {
    renderAt('/admin', 'en')
    await waitFor(() => expect(screen.getByText(`ko|en|${HOME_KEY}`)).toBeInTheDocument())
    expect(document.documentElement.lang).toBe('ko')
  })
})
