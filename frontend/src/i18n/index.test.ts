// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('locale preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses Korean for a Korean browser', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ko-KR'])
    const { detectBrowserLocale } = await import('./index')
    expect(detectBrowserLocale()).toBe('ko')
  })

  it('uses English for a non-Korean browser', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    const { detectBrowserLocale } = await import('./index')
    expect(detectBrowserLocale()).toBe('en')
  })

  it('keeps Korean and English resource keys in sync', async () => {
    const [{ enTranslations }, { koTranslations }] = await Promise.all([
      import('./translations/en'),
      import('./translations/ko'),
    ])
    expect(Object.keys(koTranslations).sort()).toEqual(Object.keys(enTranslations).sort())
  })

  it('formats common English count messages with singular nouns', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    const { tr } = await import('./index')
    expect(tr("{{v0}}편", { v0: 1 })).toBe('1 title')
    expect(tr("{{v0}}시간", { v0: 1 })).toBe('1 hour')
  })

  it('keeps supported settings and migrates legacy Japanese', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    const { loadLocalSettings, SETTINGS_STORAGE_KEY } = await import('./index')

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      appLanguage: 'ko',
      titleLanguage: 'ja',
      themeMode: 'dark',
      cardDensity: 'compact',
    }))
    expect(loadLocalSettings()).toEqual({
      appLanguage: 'ko',
      themeMode: 'dark',
      motionMode: 'comfortable',
      cardDensity: 'compact',
    })

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ appLanguage: 'ja' }))
    expect(loadLocalSettings().appLanguage).toBe('en')
  })

  it('persists a validated migration without the legacy title language', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    window.localStorage.setItem('myanitrack.local.settings', JSON.stringify({
      appLanguage: 'ja',
      titleLanguage: 'ja',
      themeMode: 'dark',
    }))

    await import('./index')

    expect(JSON.parse(window.localStorage.getItem('myanitrack.local.settings') ?? '{}')).toEqual({
      appLanguage: 'en',
      themeMode: 'dark',
      motionMode: 'comfortable',
      cardDensity: 'comfortable',
    })
  })

  it('forces Korean only on admin routes', async () => {
    const { getEffectiveLocale } = await import('./index')
    expect(getEffectiveLocale('/admin', 'en')).toBe('ko')
    expect(getEffectiveLocale('/admin/users', 'en')).toBe('ko')
    expect(getEffectiveLocale('/analysis', 'en')).toBe('en')
  })

  it('uses the active locale in title requests and title-dependent cache keys', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], pageInfo: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const [{ default: i18n }, { fetchAnimeList }, { getAnalysisCacheKey }] = await Promise.all([
      import('./index'),
      import('../lib/anime'),
      import('../lib/analysisCache'),
    ])

    await fetchAnimeList({ sort: 'latest', limit: 20 })
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('titleLanguage')).toBe('en')
    expect(getAnalysisCacheKey(7, 'myStats')).toContain(':en:')

    await i18n.changeLanguage('ko')
    await fetchAnimeList({ sort: 'latest', limit: 20 })
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('titleLanguage')).toBe('ko')
    expect(getAnalysisCacheKey(7, 'myStats')).toContain(':ko:')
  })

  it('does not expose untranslated Korean server messages in English', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US'])
    const { localizeExternalMessage } = await import('./index')
    expect(localizeExternalMessage('서버 원문 오류', 'Something went wrong.')).toBe('Something went wrong.')
  })
})
