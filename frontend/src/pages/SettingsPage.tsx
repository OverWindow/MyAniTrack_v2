import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AGREEMENT_ORDER, AGREEMENT_SECTIONS, type AgreementKey } from '../content/agreements'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyAgreements, requestPasswordReset } from '../lib/auth'
import '../styles/pages/SettingsPage.css'
import '../styles/pages/AuthPage.css'

type SettingsCategoryKey = 'privacy' | 'screen' | 'language'
type SettingsSectionKey =
  | 'profile'
  | 'security'
  | 'agreements'
  | 'appearance'
  | 'layout'
  | 'interface-language'
  | 'title-language'

type LocalSettings = {
  themeMode: 'system' | 'light' | 'dark'
  motionMode: 'comfortable' | 'reduced'
  cardDensity: 'comfortable' | 'compact'
  appLanguage: 'ko' | 'en' | 'ja'
  titleLanguage: 'ko' | 'en' | 'ja'
}

type AgreementsState = {
  termsAgreed: boolean
  privacyAgreed: boolean
  agreedAt: string | null
  termsVersion: string | null
  privacyVersion: string | null
}

const SETTINGS_STORAGE_KEY = 'myanitrack.local.settings'

const defaultLocalSettings: LocalSettings = {
  themeMode: 'system',
  motionMode: 'comfortable',
  cardDensity: 'comfortable',
  appLanguage: 'ko',
  titleLanguage: 'ko',
}

const settingsCategories = [
  {
    key: 'privacy' as const,
    label: '개인정보',
    description: '계정, 보안, 약관 상태를 관리합니다.',
    items: [
      { key: 'profile' as const, label: '계정 정보', description: '프로필과 기본 계정 정보' },
      { key: 'security' as const, label: '보안', description: '비밀번호와 로그인 보안 설정' },
      { key: 'agreements' as const, label: '약관 보기', description: '약관 및 개인정보 동의 상태 확인' },
    ],
  },
  {
    key: 'screen' as const,
    label: '화면',
    description: '테마와 화면 밀도를 조정합니다.',
    items: [
      { key: 'appearance' as const, label: '테마', description: '밝기와 모션 선호도' },
      { key: 'layout' as const, label: '레이아웃', description: '카드 밀도와 화면 구성' },
    ],
  },
  {
    key: 'language' as const,
    label: '언어',
    description: '앱 언어와 제목 표기 우선순위를 조정합니다.',
    items: [
      { key: 'interface-language' as const, label: '앱 언어', description: '메뉴와 기본 문구 언어' },
      { key: 'title-language' as const, label: '제목 언어', description: '애니 제목 표기 우선 언어' },
    ],
  },
]

function loadLocalSettings() {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)

  if (!raw) {
    return defaultLocalSettings
  }

  try {
    return {
      ...defaultLocalSettings,
      ...(JSON.parse(raw) as Partial<LocalSettings>),
    }
  } catch {
    return defaultLocalSettings
  }
}

function formatAgreementDate(value: string | null) {
  if (!value) {
    return '아직 동의 기록이 없어요.'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ko-KR')
}

export function SettingsPage() {
  const { isAuthenticated, user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategoryKey>('privacy')
  const [selectedSection, setSelectedSection] = useState<SettingsSectionKey>('profile')
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => loadLocalSettings())
  const [agreements, setAgreements] = useState<AgreementsState | null>(null)
  const [isLoadingAgreements, setIsLoadingAgreements] = useState(false)
  const [agreementsError, setAgreementsError] = useState<string | null>(null)
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(null)
  const [isSendingResetMail, setIsSendingResetMail] = useState(false)
  const [resetMailFeedback, setResetMailFeedback] = useState<string | null>(null)
  const [resetMailError, setResetMailError] = useState<string | null>(null)

  const currentCategory = useMemo(
    () => settingsCategories.find((category) => category.key === selectedCategory) ?? settingsCategories[0],
    [selectedCategory],
  )
  const activeAgreementContent = activeAgreement ? AGREEMENT_SECTIONS[activeAgreement] : null
  const currentSectionMeta = currentCategory.items.find((item) => item.key === selectedSection)

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(localSettings))
  }, [localSettings])

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
        loadError instanceof Error ? loadError.message : '약관 상태를 불러오지 못했어요.',
      )
    } finally {
      setIsLoadingAgreements(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || selectedSection !== 'agreements') {
      return
    }

    void loadAgreements()
  }, [isAuthenticated, selectedSection])

  const handlePasswordResetRequest = async () => {
    if (!user?.email) {
      setResetMailError('이 계정에 연결된 이메일을 찾을 수 없어요.')
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
        requestError instanceof Error ? requestError.message : '비밀번호 재설정 메일을 보내지 못했어요.',
      )
    } finally {
      setIsSendingResetMail(false)
    }
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="settings-page">
        <div className="feedback-card">
          설정 페이지는 로그인 후에만 볼 수 있어요. <Link to="/login">로그인</Link> 후 다시 확인해주세요.
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
                <span>이메일</span>
                <strong>{user.email}</strong>
              </article>
              <article className="settings-info-card">
                <span>사용자명</span>
                <strong>{user.username || '미설정'}</strong>
              </article>
              <article className="settings-info-card">
                <span>소개</span>
                <strong>{user.bio || '아직 소개가 없어요.'}</strong>
              </article>
            </div>
            <div className="settings-action-row">
              <Link className="primary-button" to="/profile/edit">
                프로필 수정
              </Link>
              <Link className="secondary-button" to="/profile">
                프로필 보기
              </Link>
            </div>
          </>
        )
      case 'security':
        return (
          <div className="settings-stack-blocks">
            <div className="settings-placeholder-card">
              <strong>비밀번호 변경</strong>
              <p>현재는 이메일 링크 기반으로 비밀번호를 변경할 수 있어요. 재설정 메일을 보내고, 메일에서 새 비밀번호를 최소 8자리 이상으로 설정해주세요.</p>
              <div className="settings-security-meta">
                <span>재설정 메일 수신 주소</span>
                <strong>{user.email}</strong>
              </div>
              <div className="settings-action-row">
                <button className="primary-button" type="button" onClick={() => { void handlePasswordResetRequest() }} disabled={isSendingResetMail}>
                  {isSendingResetMail ? '전송 중...' : '비밀번호 재설정 메일 보내기'}
                </button>
                <Link className="secondary-button" to="/password-reset">
                  비밀번호 찾기 페이지 열기
                </Link>
              </div>
            </div>
            {resetMailFeedback && <div className="feedback-card">{resetMailFeedback}</div>}
            {resetMailError && <div className="feedback-card is-error">{resetMailError}</div>}
          </div>
        )
      case 'agreements':
        return (
          <>
            <div className="settings-panel-headline">
              <p className="settings-panel-copy">회원가입 시 저장된 약관 동의 상태를 확인하고, 원문을 바로 열어볼 수 있어요.</p>
              <button className="secondary-button" type="button" onClick={() => { void loadAgreements() }} disabled={isLoadingAgreements}>
                {isLoadingAgreements ? '불러오는 중...' : '새로 불러오기'}
              </button>
            </div>
            {agreementsError && <div className="feedback-card is-error">{agreementsError}</div>}
            {agreements && (
              <div className="settings-info-grid settings-agreement-grid">
                <article className="settings-info-card">
                  <span>이용약관</span>
                  <strong>{agreements.termsAgreed ? '동의 완료' : '미동의'}</strong>
                  <small>{agreements.termsVersion || '버전 정보 없음'}</small>
                  <button className="agreement-inline-link settings-inline-link" type="button" onClick={() => setActiveAgreement('terms')}>
                    약관 보기
                  </button>
                </article>
                <article className="settings-info-card">
                  <span>개인정보처리방침</span>
                  <strong>{agreements.privacyAgreed ? '동의 완료' : '미동의'}</strong>
                  <small>{agreements.privacyVersion || '버전 정보 없음'}</small>
                  <button className="agreement-inline-link settings-inline-link" type="button" onClick={() => setActiveAgreement('privacy')}>
                    약관 보기
                  </button>
                </article>
                <article className="settings-info-card">
                  <span>최종 동의 일시</span>
                  <strong>{formatAgreementDate(agreements.agreedAt)}</strong>
                  <button className="agreement-inline-link settings-inline-link" type="button" onClick={() => setActiveAgreement('data')}>
                    데이터 고지 보기
                  </button>
                </article>
              </div>
            )}
            {!agreements && !isLoadingAgreements && !agreementsError && (
              <p className="settings-empty-copy">아직 불러온 동의 상태가 없습니다.</p>
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
            </div>
          </>
        )
      case 'appearance':
        return (
          <div className="settings-option-list">
            <label className="auth-field">
              <span>테마 모드</span>
              <select
                value={localSettings.themeMode}
                onChange={(event) =>
                  setLocalSettings((current) => ({
                    ...current,
                    themeMode: event.target.value as LocalSettings['themeMode'],
                  }))
                }
              >
                <option value="system">시스템 설정 따르기</option>
                <option value="light">라이트 모드</option>
                <option value="dark">다크 모드</option>
              </select>
            </label>
            <label className="auth-field">
              <span>모션 강도</span>
              <select
                value={localSettings.motionMode}
                onChange={(event) =>
                  setLocalSettings((current) => ({
                    ...current,
                    motionMode: event.target.value as LocalSettings['motionMode'],
                  }))
                }
              >
                <option value="comfortable">기본 모션</option>
                <option value="reduced">모션 줄이기</option>
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
                setLocalSettings((current) => ({
                  ...current,
                  cardDensity: 'comfortable',
                }))
              }
            >
              기본 밀도
            </button>
            <button
              className={localSettings.cardDensity === 'compact' ? 'settings-segment is-active' : 'settings-segment'}
              type="button"
              onClick={() =>
                setLocalSettings((current) => ({
                  ...current,
                  cardDensity: 'compact',
                }))
              }
            >
              압축 밀도
            </button>
          </div>
        )
      case 'interface-language':
        return (
          <label className="auth-field settings-compact-field">
            <span>앱 언어</span>
            <select
              value={localSettings.appLanguage}
              onChange={(event) =>
                setLocalSettings((current) => ({
                  ...current,
                  appLanguage: event.target.value as LocalSettings['appLanguage'],
                }))
              }
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
        )
      case 'title-language':
        return (
          <label className="auth-field settings-compact-field">
            <span>기본 제목 언어</span>
            <select
              value={localSettings.titleLanguage}
              onChange={(event) =>
                setLocalSettings((current) => ({
                  ...current,
                  titleLanguage: event.target.value as LocalSettings['titleLanguage'],
                }))
              }
            >
              <option value="ko">한국어 우선</option>
              <option value="en">영어 우선</option>
              <option value="ja">일본어 우선</option>
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
          <aside className="settings-sidebar settings-sidebar-primary">
            <div className="settings-sidebar-header">
              <span className="detail-label">Categories</span>
              <h2>설정 분류</h2>
            </div>
            <div className="settings-sidebar-list">
              {settingsCategories.map((category) => (
                <button
                  key={category.key}
                  className={selectedCategory === category.key ? 'settings-sidebar-item is-active' : 'settings-sidebar-item'}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category.key)
                    setSelectedSection(category.items[0].key)
                  }}
                >
                  <strong>{category.label}</strong>
                  <small>{category.description}</small>
                </button>
              ))}
            </div>
          </aside>

          <aside className="settings-sidebar settings-sidebar-secondary">
            <div className="settings-sidebar-header">
              <span className="detail-label">Sections</span>
              <h2>{currentCategory.label}</h2>
            </div>
            <div className="settings-sidebar-list">
              {currentCategory.items.map((item) => (
                <button
                  key={item.key}
                  className={selectedSection === item.key ? 'settings-sidebar-item is-active' : 'settings-sidebar-item'}
                  type="button"
                  onClick={() => setSelectedSection(item.key)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </aside>

          <div className="settings-content-panel">
            <div className="settings-panel-intro">
              <span className="detail-label">Current section</span>
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
                <span className="section-kicker">Agreement</span>
                <h2 id="settings-agreement-modal-title">{activeAgreementContent.title}</h2>
              </div>
              <button className="secondary-button agreement-close-button" type="button" onClick={() => setActiveAgreement(null)}>
                닫기
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
