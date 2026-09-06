import { tr } from '../i18n'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorToast } from '../components/ErrorToast'
import { AGREEMENT_ORDER, AGREEMENT_SECTIONS, type AgreementKey } from '../content/agreements'
import { useAuth } from '../contexts/AuthContext'
import { useAppLanguage } from '../contexts/LanguageContext'
import type { AppLocale, LocalSettings } from '../i18n'
import { fetchMyAgreements, requestPasswordReset } from '../lib/auth'
import '../styles/pages/SettingsPage.css'
import '../styles/pages/AuthPage.css'

type SettingsSectionKey =
  | 'profile'
  | 'security'
  | 'agreements'
  | 'appearance'
  | 'layout'
  | 'interface-language'

type AgreementsState = {
  termsAgreed: boolean
  privacyAgreed: boolean
  agreedAt: string | null
  termsVersion: string | null
  privacyVersion: string | null
}

const settingsCategories = [
  {
    key: 'privacy' as const,
    label: tr("개인정보"),
    description: tr("계정, 보안, 약관 상태를 관리합니다."),
    items: [
      { key: 'profile' as const, label: tr("계정 정보"), description: tr("프로필과 기본 계정 정보") },
      { key: 'security' as const, label: tr("보안"), description: tr("비밀번호와 로그인 보안 설정") },
      { key: 'agreements' as const, label: tr("약관 보기"), description: tr("약관 및 개인정보 동의 상태 확인") },
    ],
  },
  {
    key: 'screen' as const,
    label: tr("화면"),
    description: tr("테마와 화면 밀도를 조정합니다."),
    items: [
      { key: 'appearance' as const, label: tr("테마"), description: tr("밝기와 모션 선호도") },
      { key: 'layout' as const, label: tr("레이아웃"), description: tr("카드 밀도와 화면 구성") },
    ],
  },
  {
    key: 'language' as const,
    label: tr("언어"),
    description: tr("메뉴와 기본 문구 언어"),
    items: [
      { key: 'interface-language' as const, label: tr("앱 언어"), description: tr("메뉴와 기본 문구 언어") },
    ],
  },
]

function formatAgreementDate(value: string | null, locale: AppLocale) {
  if (!value) {
    return tr("아직 동의 기록이 없어요.")
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
}

export function SettingsPage() {
  const { isAuthenticated, user } = useAuth()
  const { locale, settings: localSettings, setLocale, setSettings } = useAppLanguage()
  const [selectedSection, setSelectedSection] = useState<SettingsSectionKey>('profile')
  const [agreements, setAgreements] = useState<AgreementsState | null>(null)
  const [isLoadingAgreements, setIsLoadingAgreements] = useState(false)
  const [agreementsError, setAgreementsError] = useState<string | null>(null)
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(null)
  const [isSendingResetMail, setIsSendingResetMail] = useState(false)
  const [resetMailFeedback, setResetMailFeedback] = useState<string | null>(null)
  const [resetMailError, setResetMailError] = useState<string | null>(null)

  const currentCategory = useMemo(
    () => settingsCategories.find((category) => category.items.some((item) => item.key === selectedSection))
      ?? settingsCategories[0],
    [selectedSection],
  )
  const activeAgreementContent = activeAgreement ? AGREEMENT_SECTIONS[activeAgreement] : null
  const currentSectionMeta = currentCategory.items.find((item) => item.key === selectedSection)

  useEffect(() => {
    if (!activeAgreement) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveAgreement(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeAgreement])

  const loadAgreements = async () => {
    setIsLoadingAgreements(true)
    setAgreementsError(null)

    try {
      const nextAgreements = await fetchMyAgreements()
      setAgreements(nextAgreements)
    } catch (loadError) {
      setAgreementsError(
        loadError instanceof Error ? loadError.message : tr("약관 상태를 불러오지 못했어요."),
      )
    } finally {
      setIsLoadingAgreements(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || selectedSection !== 'agreements') {
      return
    }

    const timer = window.setTimeout(() => {
      void loadAgreements()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isAuthenticated, selectedSection])

  const handlePasswordResetRequest = async () => {
    if (!user?.email) {
      setResetMailError(tr("이 계정에 연결된 이메일을 찾을 수 없어요."))
      return
    }

    setIsSendingResetMail(true)
    setResetMailFeedback(null)
    setResetMailError(null)

    try {
      const result = await requestPasswordReset(user.email)
      setResetMailFeedback(result.message)
    } catch (requestError) {
      setResetMailError(
        requestError instanceof Error ? requestError.message : tr("비밀번호 재설정 메일을 보내지 못했어요."),
      )
    } finally {
      setIsSendingResetMail(false)
    }
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="settings-page">
        <div className="feedback-card">
          <Link to="/login">{tr("설정 페이지를 보려면 로그인해주세요.")}</Link>
        </div>
      </section>
    )
  }

  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'profile':
        return (
          <>
            <div className="settings-info-grid">
              <article className="settings-info-card">
                <span>{tr("이메일")}</span>
                <strong>{user.email}</strong>
              </article>
              <article className="settings-info-card">
                <span>{tr("사용자명")}</span>
                <strong>{user.username || tr("미설정")}</strong>
              </article>
              <article className="settings-info-card">
                <span>{tr("소개")}</span>
                <strong>{user.bio || tr("아직 소개가 없어요.")}</strong>
              </article>
            </div>
            <div className="settings-action-row">
              <Link className="primary-button" to="/profile/edit">
                {tr("프로필 수정")}
              </Link>
              <Link className="secondary-button" to="/profile">
                {tr("프로필 보기")}
              </Link>
            </div>
          </>
        )
      case 'security':
        return (
          <div className="settings-stack-blocks">
            <div className="settings-placeholder-card">
              <strong>{tr("비밀번호 변경")}</strong>
              <p>{tr("현재는 이메일 링크 기반으로 비밀번호를 변경할 수 있어요. 재설정 메일을 보내고, 메일에서 새 비밀번호를 최소 8자리 이상으로 설정해주세요.")}</p>
              <div className="settings-security-meta">
                <span>{tr("재설정 메일 수신 주소")}</span>
                <strong>{user.email}</strong>
              </div>
              <div className="settings-action-row">
                <button className="primary-button" type="button" onClick={() => { void handlePasswordResetRequest() }} disabled={isSendingResetMail}>
                  {isSendingResetMail ? tr("전송 중...") : tr("비밀번호 재설정 메일 보내기")}
                </button>
                <Link className="secondary-button" to="/password-reset">
                  {tr("비밀번호 찾기 페이지 열기")}
                </Link>
              </div>
            </div>
            {resetMailFeedback && <div className="feedback-card">{resetMailFeedback}</div>}
            <ErrorToast message={resetMailError} />
            <div className="settings-danger-zone">
              <div>
                <strong>{tr("계정 삭제")}</strong>
                <p>{tr("계정을 삭제하면 컬렉션, 분석 데이터, 친구 관계, 프로필 정보가 함께 삭제됩니다. 이 작업은 되돌릴 수 없어요.")}</p>
              </div>
              <Link className="settings-danger-button" to="/account-deletion">
                {tr("계정 삭제 안내 및 진행")}
              </Link>
            </div>
          </div>
        )
      case 'agreements':
        return (
          <>
            <div className="settings-panel-headline">
              <p className="settings-panel-copy">{tr("회원가입 시 저장된 약관 동의 상태를 확인하고, 원문을 바로 열어볼 수 있어요.")}</p>
              <button className="secondary-button" type="button" onClick={() => { void loadAgreements() }} disabled={isLoadingAgreements}>
                {isLoadingAgreements ? tr("불러오는 중...") : tr("새로 불러오기")}
              </button>
            </div>
            <ErrorToast message={agreementsError} />
            {agreements && (
              <div className="settings-info-grid settings-agreement-grid">
                <article className="settings-info-card">
                  <span>{tr("이용약관")}</span>
                  <strong>{agreements.termsAgreed ? tr("동의 완료") : tr("미동의")}</strong>
                  <small>{agreements.termsVersion || tr("버전 정보 없음")}</small>
                  <button className="agreement-inline-link settings-inline-link" type="button" onClick={() => setActiveAgreement('terms')}>
                    {tr("약관 보기")}
                  </button>
                </article>
                <article className="settings-info-card">
                  <span>{tr("개인정보처리방침")}</span>
                  <strong>{agreements.privacyAgreed ? tr("동의 완료") : tr("미동의")}</strong>
                  <small>{agreements.privacyVersion || tr("버전 정보 없음")}</small>
                  <button className="agreement-inline-link settings-inline-link" type="button" onClick={() => setActiveAgreement('privacy')}>
                    {tr("약관 보기")}
                  </button>
                  <Link className="agreement-inline-link settings-inline-link" to="/privacy">
                    {tr("공개 전문 보기")}
                  </Link>
                </article>
                <article className="settings-info-card">
                  <span>{tr("최종 동의 일시")}</span>
                  <strong>{formatAgreementDate(agreements.agreedAt, locale)}</strong>
                  <button className="agreement-inline-link settings-inline-link" type="button" onClick={() => setActiveAgreement('data')}>
                    {tr("데이터 고지 보기")}
                  </button>
                </article>
              </div>
            )}
            {!agreements && !isLoadingAgreements && !agreementsError && (
              <p className="settings-empty-copy">{tr("아직 불러온 동의 상태가 없습니다.")}</p>
            )}
            <div className="agreement-link-list settings-agreement-links">
              {AGREEMENT_ORDER.map((key) => (
                <button
                  key={key}
                  className="secondary-button agreement-open-button"
                  type="button"
                  onClick={() => setActiveAgreement(key)}
                >
                  {AGREEMENT_SECTIONS[key].title}
                </button>
              ))}
              <Link className="secondary-button agreement-open-button" to="/account-deletion">
                {tr("계정 및 데이터 삭제")}
              </Link>
            </div>
          </>
        )
      case 'appearance':
        return (
          <div className="settings-option-list">
            <label className="auth-field">
              <span>{tr("테마 모드")}</span>
              <select
                value={localSettings.themeMode}
                onChange={(event) =>
                  setSettings({
                    ...localSettings,
                    themeMode: event.target.value as LocalSettings['themeMode'],
                  })
                }
              >
                <option value="system">{tr("시스템 설정 따르기")}</option>
                <option value="light">{tr("라이트 모드")}</option>
                <option value="dark">{tr("다크 모드")}</option>
              </select>
            </label>
            <label className="auth-field">
              <span>{tr("모션 강도")}</span>
              <select
                value={localSettings.motionMode}
                onChange={(event) =>
                  setSettings({
                    ...localSettings,
                    motionMode: event.target.value as LocalSettings['motionMode'],
                  })
                }
              >
                <option value="comfortable">{tr("기본 모션")}</option>
                <option value="reduced">{tr("모션 줄이기")}</option>
              </select>
            </label>
          </div>
        )
      case 'layout':
        return (
          <div className="settings-segmented-control">
            <button
              className={localSettings.cardDensity === 'comfortable' ? 'settings-segment is-active' : 'settings-segment'}
              type="button"
              onClick={() =>
                setSettings({
                  ...localSettings,
                  cardDensity: 'comfortable',
                })
              }
            >
              {tr("기본 밀도")}
            </button>
            <button
              className={localSettings.cardDensity === 'compact' ? 'settings-segment is-active' : 'settings-segment'}
              type="button"
              onClick={() =>
                setSettings({
                  ...localSettings,
                  cardDensity: 'compact',
                })
              }
            >
              {tr("압축 밀도")}
            </button>
          </div>
        )
      case 'interface-language':
        return (
          <label className="auth-field settings-compact-field">
            <span>{tr("앱 언어")}</span>
            <select
              value={localSettings.appLanguage}
              onChange={(event) => setLocale(event.target.value as AppLocale)}
            >
              <option value="ko">{tr("한국어")}</option>
              <option value="en">English</option>
            </select>
          </label>
        )
      default:
        return null
    }
  }

  return (
    <>
      <section className="settings-page">
        <div className="settings-workspace">
          <aside className="settings-sidebar">
            <div className="settings-sidebar-header">
              <h1>{tr("설정")}</h1>
              <p>{tr("계정과 화면 환경을 관리하세요.")}</p>
            </div>
            <nav className="settings-menu" aria-label={tr("설정 메뉴")}>
              {settingsCategories.map((category) => (
                <section className="settings-menu-group" key={category.key}>
                  <div className="settings-menu-group-heading">
                    <h2>{category.label}</h2>
                    <p>{category.description}</p>
                  </div>
                  <div className="settings-sidebar-list">
                    {category.items.map((item) => (
                      <button
                        key={item.key}
                        className={selectedSection === item.key ? 'settings-sidebar-item is-active' : 'settings-sidebar-item'}
                        type="button"
                        aria-current={selectedSection === item.key ? 'page' : undefined}
                        onClick={() => setSelectedSection(item.key)}
                      >
                        <span>{item.label}</span>
                        <small>{item.description}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
          </aside>

          <div className="settings-content-panel">
            <div className="settings-panel-intro">
              <span className="settings-section-path">{currentCategory.label}</span>
              <h2>{currentSectionMeta?.label}</h2>
              <p>{currentSectionMeta?.description}</p>
            </div>
            {renderSectionContent()}
          </div>
        </div>
      </section>

      {activeAgreementContent && (
        <div className="agreement-modal-backdrop" role="presentation" onClick={() => setActiveAgreement(null)}>
          <div
            className="agreement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-agreement-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agreement-modal-header">
              <div>
                <h2 id="settings-agreement-modal-title">{activeAgreementContent.title}</h2>
              </div>
              <button className="secondary-button agreement-close-button" type="button" onClick={() => setActiveAgreement(null)}>
                {tr("닫기")}
              </button>
            </div>
            <div className="agreement-modal-body">
              {activeAgreementContent.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
