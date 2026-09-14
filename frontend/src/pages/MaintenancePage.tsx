import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import brandLogo from '../assets/myanitrack-logo.png'
import { useAppLanguage } from '../contexts/LanguageContext'
import { tr } from '../i18n'
import type { MaintenanceSettings } from '../types/maintenance'
import '../styles/pages/MaintenancePage.css'

type MaintenancePageProps = {
  settings: MaintenanceSettings
  isRefreshing: boolean
  onRefresh: () => void
}

export function MaintenanceLoadingPage() {
  return (
    <main className="maintenance-page maintenance-loading-page" aria-busy="true">
      <img src={brandLogo} alt="" aria-hidden="true" />
      <strong>MyAniTrack</strong>
      <p>{tr('확인 중...')}</p>
    </main>
  )
}

export function MaintenancePage({ settings, isRefreshing, onRefresh }: MaintenancePageProps) {
  const { locale, setLocale } = useAppLanguage()
  const title = settings.title[locale]
  const message = settings.message[locale]

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} | MyAniTrack`

    return () => {
      document.title = previousTitle
    }
  }, [title])

  return (
    <main className="maintenance-page">
      <section className="maintenance-card" aria-labelledby="maintenance-title">
        <div className="maintenance-header">
          <div className="maintenance-brand">
            <img src={brandLogo} alt="" aria-hidden="true" />
            <strong>MyAniTrack</strong>
          </div>

          <div className="maintenance-language" role="group" aria-label={tr('앱 언어')}>
            <button type="button" className={locale === 'ko' ? 'is-active' : ''} onClick={() => setLocale('ko')}>KO</button>
            <button type="button" className={locale === 'en' ? 'is-active' : ''} onClick={() => setLocale('en')}>EN</button>
          </div>
        </div>

        <div className="maintenance-copy">
          <h1 id="maintenance-title">{title}</h1>
          <p>{message}</p>
        </div>

        <button className="primary-button maintenance-refresh" type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? tr('확인 중...') : tr('다시 확인')}
        </button>

        <nav className="maintenance-links" aria-label={tr('안내 링크')}>
          <Link to="/login">{tr('관리자 로그인')}</Link>
          <Link to="/terms">{tr('이용약관')}</Link>
          <Link to="/privacy">{tr('개인정보처리방침')}</Link>
        </nav>
      </section>
    </main>
  )
}
