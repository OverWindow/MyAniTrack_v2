/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import i18n, {
  getLocaleTag,
  getEffectiveLocale,
  loadLocalSettings,
  normalizeLocale,
  saveLocalSettings,
  tr,
  type AppLocale,
  type LocalSettings,
} from '../i18n'

function setMetaContent(selector: string, content: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content)
}

function getPageTitle(pathname: string) {
  if (pathname === '/') return tr('MyAniTrack - 애니 기록 및 소셜 추천 플랫폼')
  if (pathname.startsWith('/collection')) return tr('컬렉션 | MyAniTrack')
  if (pathname.startsWith('/analysis')) return tr('분석 | MyAniTrack')
  if (pathname.startsWith('/explore')) return tr('탐색 | MyAniTrack')
  if (pathname.startsWith('/friends')) return tr('친구 | MyAniTrack')
  if (pathname.startsWith('/settings')) return tr('설정 | MyAniTrack')
  if (pathname.startsWith('/signup')) return tr('회원가입 | MyAniTrack')
  if (pathname.startsWith('/login')) return tr('로그인 | MyAniTrack')
  if (pathname.startsWith('/password-reset')) return tr('비밀번호 재설정 | MyAniTrack')
  if (pathname.startsWith('/verify-email')) return tr('이메일 인증 | MyAniTrack')
  if (pathname.startsWith('/account-deletion')) return tr('계정 및 데이터 삭제 | 마이애니트랙')
  if (pathname.startsWith('/privacy')) return tr('개인정보처리방침 | 마이애니트랙')
  if (pathname.startsWith('/terms')) return tr('이용약관 | 마이애니트랙')
  if (pathname.startsWith('/anime/')) return tr('애니 상세 정보 | MyAniTrack')
  if (pathname.startsWith('/voice-actors/')) return tr('성우 상세 정보 | MyAniTrack')
  if (pathname.startsWith('/share/')) return tr('공유 | MyAniTrack')
  if (pathname.startsWith('/users/')) return tr('사용자 프로필 | MyAniTrack')
  if (pathname.startsWith('/profile')) return tr('프로필 | MyAniTrack')
  if (pathname.startsWith('/admin')) return tr('관리자 | MyAniTrack')
  return 'MyAniTrack'
}

function getPageDescription(pathname: string) {
  if (pathname.startsWith('/privacy')) {
    return tr('마이애니트랙 웹 및 모바일 앱의 개인정보 수집, 이용, 공개, 보관 및 삭제 정책입니다.')
  }
  if (pathname.startsWith('/terms')) {
    return tr('마이애니트랙 서비스 이용약관입니다.')
  }
  if (pathname.startsWith('/account-deletion')) {
    return tr('마이애니트랙 계정과 연결된 컬렉션, 분석, 프로필 및 친구 데이터를 삭제하는 방법을 안내합니다.')
  }
  return tr('본 애니를 기록하고, 즐겨찾기를 관리하고, 시청 통계를 분석하고, 친구들과 함께 새로운 애니를 발견해보세요.')
}

function updateGlobalMetadata(locale: AppLocale, pathname: string) {
  const description = getPageDescription(pathname)
  const title = getPageTitle(pathname)
  const twitterDescription = tr('애니를 기록하고, 취향을 분석하고, 친구들과 함께 새로운 작품을 찾아보세요.')

  document.title = title
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[name="keywords"]', tr('애니, 애니 추천, 애니 기록, 애니 트래커, 애니메이션, 애니 통계, 애니 평점, 애니 즐겨찾기'))
  setMetaContent('meta[property="og:title"]', title)
  setMetaContent('meta[property="og:description"]', description)
  setMetaContent('meta[property="og:locale"]', locale === 'ko' ? 'ko_KR' : 'en_US')
  setMetaContent('meta[property="og:url"]', new URL(pathname, window.location.origin).toString())
  setMetaContent('meta[name="twitter:title"]', title)
  setMetaContent('meta[name="twitter:description"]', twitterDescription)
}

type LanguageContextValue = {
  locale: AppLocale
  preferredLocale: AppLocale
  settings: LocalSettings
  t: typeof tr
  setLocale: (locale: AppLocale) => void
  setSettings: (settings: LocalSettings) => void
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [settings, setSettingsState] = useState<LocalSettings>(() => loadLocalSettings())
  const [languageRevision, setLanguageRevision] = useState(0)
  const isAdminRoute = location.pathname.startsWith('/admin')
  const previousAdminRoute = useRef(isAdminRoute)
  const locale = getEffectiveLocale(location.pathname, settings.appLanguage)

  useEffect(() => {
    const leftAdminRoute = previousAdminRoute.current && !isAdminRoute
    previousAdminRoute.current = isAdminRoute

    if (leftAdminRoute && normalizeLocale(i18n.language ?? i18n.resolvedLanguage) !== settings.appLanguage) {
      window.location.reload()
      return
    }

    void i18n.changeLanguage(locale).then(() => {
      document.documentElement.lang = locale
      updateGlobalMetadata(locale, location.pathname)
      setLanguageRevision((current) => current + 1)
    })
  }, [isAdminRoute, locale, location.pathname, settings.appLanguage])

  const value = useMemo<LanguageContextValue>(() => {
    void languageRevision
    return {
      locale,
      preferredLocale: settings.appLanguage,
      settings,
      t: tr,
      setLocale(nextLocale) {
        const normalized = normalizeLocale(nextLocale)
        const nextSettings = { ...settings, appLanguage: normalized }
        saveLocalSettings(nextSettings)
        void i18n.changeLanguage(normalized).then(() => window.location.reload())
      },
      setSettings(nextSettings) {
        const normalized = { ...nextSettings, appLanguage: normalizeLocale(nextSettings.appLanguage) }
        saveLocalSettings(normalized)
        setSettingsState(normalized)
      },
      formatNumber(number, options) {
        return new Intl.NumberFormat(getLocaleTag(), options).format(number)
      },
      formatDateTime(date, options) {
        return new Intl.DateTimeFormat(getLocaleTag(), options).format(new Date(date))
      },
    }
  }, [languageRevision, locale, settings])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useAppLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useAppLanguage must be used within LanguageProvider.')
  return context
}
