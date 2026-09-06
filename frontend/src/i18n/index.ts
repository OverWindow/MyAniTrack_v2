import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { enTranslations } from './translations/en'
import { koTranslations } from './translations/ko'

const normalizeMessageKey = (value: string) => value.replace(/\r\n/g, '\n')
const normalizedEnTranslations = Object.fromEntries(
  Object.entries(enTranslations).map(([key, value]) => [normalizeMessageKey(key), value]),
)
const normalizedKoTranslations = Object.fromEntries(
  Object.entries(koTranslations).map(([key, value]) => [normalizeMessageKey(key), normalizeMessageKey(value)]),
)

export const SETTINGS_STORAGE_KEY = 'myanitrack.local.settings'

export type AppLocale = 'ko' | 'en'

export type LocalSettings = {
  themeMode: 'system' | 'light' | 'dark'
  motionMode: 'comfortable' | 'reduced'
  cardDensity: 'comfortable' | 'compact'
  appLanguage: AppLocale
}

export const defaultLocalSettings: LocalSettings = {
  themeMode: 'system',
  motionMode: 'comfortable',
  cardDensity: 'comfortable',
  appLanguage: 'ko',
}

export function detectBrowserLocale(): AppLocale {
  const browserLanguage = navigator.languages?.[0] ?? navigator.language
  return browserLanguage?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export function loadLocalSettings(): LocalSettings {
  const detectedLocale = detectBrowserLocale()
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)

  if (!raw) {
    return { ...defaultLocalSettings, appLanguage: detectedLocale }
  }

  try {
    const stored = JSON.parse(raw) as Partial<LocalSettings> & { appLanguage?: string }
    return {
      themeMode: stored.themeMode === 'light' || stored.themeMode === 'dark' ? stored.themeMode : 'system',
      motionMode: stored.motionMode === 'reduced' ? 'reduced' : 'comfortable',
      cardDensity: stored.cardDensity === 'compact' ? 'compact' : 'comfortable',
      appLanguage: stored.appLanguage === 'ko' || stored.appLanguage === 'en'
        ? stored.appLanguage
        : detectedLocale,
    }
  } catch {
    return { ...defaultLocalSettings, appLanguage: detectedLocale }
  }
}

export function saveLocalSettings(settings: LocalSettings) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

const initialSettings = loadLocalSettings()
saveLocalSettings(initialSettings)
const preferredLocale = initialSettings.appLanguage
const initialLocale = getEffectiveLocale(window.location.pathname, preferredLocale)

void i18n
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: 'ko',
    initAsync: false,
    keySeparator: false,
    interpolation: { escapeValue: false },
    resources: {
      ko: { translation: normalizedKoTranslations },
      en: { translation: normalizedEnTranslations },
    },
  })

export function normalizeLocale(value?: string | null): AppLocale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'ko'
}

export function getEffectiveLocale(pathname: string, preferredLocale: AppLocale): AppLocale {
  return pathname.startsWith('/admin') ? 'ko' : preferredLocale
}

export function getLocaleTag() {
  return normalizeLocale(i18n.language ?? i18n.resolvedLanguage) === 'ko' ? 'ko-KR' : 'en-US'
}

export function tr(key: string, values?: Record<string, unknown>) {
  const normalizedKey = normalizeMessageKey(key)
  if (normalizeLocale(i18n.language ?? i18n.resolvedLanguage) === 'ko') {
    if (!values) return normalizedKey
    return normalizedKey.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ''))
  }

  return String(i18n.t(normalizedKey, { defaultValue: normalizedKey, ...values }))
    .replace(/\b1 titles\b/g, '1 title')
    .replace(/\b1 items\b/g, '1 item')
    .replace(/\b1 people\b/g, '1 person')
    .replace(/\b1 points\b/g, '1 point')
    .replace(/\b1 hours\b/g, '1 hour')
    .replace(/\b1 minutes\b/g, '1 minute')
    .replace(/\b1 episodes\b/g, '1 episode')
    .replace(/\b1 works\b/g, '1 title')
    .replace(/\b1 studios\b/g, '1 studio')
}

export function localizeExternalMessage(message: string | null | undefined, fallback: string) {
  if (!message) {
    return fallback
  }

  const translated = tr(message)
  if (getTitleLanguage() === 'en' && /[가-힣]/.test(translated)) {
    return fallback
  }

  return translated
}

export function getTitleLanguage(): AppLocale {
  return normalizeLocale(i18n.language ?? i18n.resolvedLanguage)
}

export default i18n
