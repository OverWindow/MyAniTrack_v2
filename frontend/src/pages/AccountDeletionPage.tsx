import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorToast } from '../components/ErrorToast'
import { PRIVACY_CONTACT_EMAIL } from '../content/privacyPolicy'
import { useAuth } from '../contexts/AuthContext'
import { getAuthErrorStatus } from '../lib/auth'
import { useDocumentMetadata } from '../hooks/useDocumentMetadata'
import '../styles/pages/PolicyPages.css'

type DeletionState = 'idle' | 'confirming' | 'submitting' | 'success' | 'error'

const DELETION_CONFIRMATION = '계정 삭제'

function maskEmail(email?: string | null) {
  if (!email || !email.includes('@')) {
    return '이메일 정보 없음'
  }

  const [local, domain] = email.split('@')
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

function getDeletionErrorMessage(error: unknown) {
  const status = getAuthErrorStatus(error)

  if (status === 401) {
    return '로그인 세션이 만료되었습니다. 다시 로그인한 뒤 삭제를 요청해주세요.'
  }

  if (status === 404) {
    return '삭제할 앱 계정을 확인하지 못했습니다. 계정 연결 상태를 확인할 수 있도록 고객지원에 문의해주세요.'
  }

  if (status && status >= 500) {
    return '서버에서 삭제 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
  }

  if (error instanceof TypeError) {
    return '네트워크 연결이 끊겨 삭제 완료 여부를 확인하지 못했습니다. 다시 로그인해 계정 상태를 확인하거나 고객지원에 문의해주세요.'
  }

  return error instanceof Error ? error.message : '계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

export function AccountDeletionPage() {
  const { deleteAccount, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const wasDeleted = searchParams.get('status') === 'deleted'
  const [confirmation, setConfirmation] = useState('')
  const [deletionState, setDeletionState] = useState<DeletionState>(wasDeleted ? 'success' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [isSupportGuideOpen, setIsSupportGuideOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)
  const isSubmitting = deletionState === 'submitting'
  const supportHref = `mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent('마이애니트랙 계정 삭제 요청')}`

  useDocumentMetadata({
    title: '계정 및 데이터 삭제 | 마이애니트랙',
    description: '마이애니트랙 계정과 연결된 컬렉션, 분석, 프로필 및 친구 데이터를 삭제하는 방법을 안내합니다.',
    canonicalPath: '/account-deletion',
  })

  useEffect(() => {
    if (deletionState !== 'confirming') {
      return
    }

    confirmButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDeletionState('idle')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deletionState])

  const handleDelete = async () => {
    if (confirmation !== DELETION_CONFIRMATION || isSubmitting) {
      return
    }

    setDeletionState('submitting')
    setError(null)
    setErrorStatus(null)

    try {
      await deleteAccount()
      setDeletionState('success')
      setConfirmation('')
      navigate('/account-deletion?status=deleted', { replace: true })
    } catch (deleteError) {
      setError(getDeletionErrorMessage(deleteError))
      setErrorStatus(getAuthErrorStatus(deleteError))
      setDeletionState('error')
    }
  }

  const handleCopySupportEmail = async () => {
    try {
      await window.navigator.clipboard.writeText(PRIVACY_CONTACT_EMAIL)
      setCopyFeedback('이메일 주소를 복사했습니다.')
    } catch {
      setCopyFeedback(`복사하지 못했습니다. ${PRIVACY_CONTACT_EMAIL} 주소를 직접 복사해주세요.`)
    }
  }

  return (
    <article className="policy-page deletion-page">
      <header className="policy-hero deletion-hero">
        <span className="policy-eyebrow">Account deletion</span>
        <h1>마이애니트랙 계정 및 데이터 삭제</h1>
        <p>웹이나 앱을 다시 설치하지 않아도 이 페이지에서 계정 삭제를 요청할 수 있습니다.</p>
        <div className="policy-hero-actions">
          <Link className="secondary-button" to="/privacy">개인정보처리방침 보기</Link>
          <button
            className="secondary-button"
            type="button"
            aria-expanded={isSupportGuideOpen}
            aria-controls="deletion-email-guide"
            onClick={() => {
              setIsSupportGuideOpen((current) => !current)
              setCopyFeedback(null)
            }}
          >
            이메일로 삭제 요청
          </button>
        </div>
        {isSupportGuideOpen && (
          <div className="deletion-email-guide" id="deletion-email-guide">
            <strong>이메일 삭제 요청 방법</strong>
            <p>가입한 이메일 주소로 아래 문의처에 삭제 요청을 보내주세요. 계정 소유 확인을 위해 추가 확인을 요청할 수 있으며, 비밀번호나 인증 토큰은 보내지 마세요.</p>
            <code>{PRIVACY_CONTACT_EMAIL}</code>
            <div className="deletion-email-actions">
              <button className="secondary-button" type="button" onClick={() => { void handleCopySupportEmail() }}>
                이메일 주소 복사
              </button>
              <a className="primary-button" href={supportHref}>메일 앱 열기</a>
            </div>
            {copyFeedback && <p className="deletion-copy-feedback" role="status">{copyFeedback}</p>}
          </div>
        )}
      </header>

      <nav className="policy-toc" aria-label="계정 삭제 안내 목차">
        <strong>목차</strong>
        <ol>
          <li><a href="#deletion-data">삭제되는 데이터</a></li>
          <li><a href="#deletion-retention">삭제 후 보관될 수 있는 데이터</a></li>
          <li><a href="#deletion-request">삭제 요청</a></li>
        </ol>
      </nav>

      <div className="policy-content">
        <section className="policy-section" id="deletion-data">
          <h2>삭제되는 데이터</h2>
          <p>계정 삭제가 완료되면 다음 마이애니트랙 데이터는 복구할 수 없습니다.</p>
          <ul>
            <li>로그인 계정, 사용자명, 소개와 프로필 정보</li>
            <li>애니메이션 컬렉션, 감상 상태, 진도, 평점, 날짜와 메모</li>
            <li>분석 결과의 원천 기록, 최애 작품과 배지 진행 정보</li>
            <li>친구 관계와 주고받은 친구 요청</li>
            <li>이용약관과 개인정보처리방침 동의 기록</li>
          </ul>
        </section>

        <section className="policy-section" id="deletion-retention">
          <h2>삭제 후 보관될 수 있는 데이터</h2>
          <p>활성 데이터베이스의 계정 데이터는 삭제 요청 처리 과정에서 제거됩니다. 저장소의 프로필 이미지는 최대 72시간, 운영 백업은 최대 30일, 보안·장애 대응 로그는 최대 90일 동안 제한적으로 남을 수 있으며 각 기간이 지나면 파기됩니다.</p>
          <p>법령상 보관 의무가 발생하면 해당 근거와 기간에 따라 필요한 범위만 별도로 보관합니다.</p>
        </section>

        <section className="policy-section deletion-request-section" id="deletion-request">
          <h2>삭제 요청</h2>

          {deletionState === 'success' || wasDeleted ? (
            <div className="deletion-success" role="status">
              <strong>계정 삭제 요청이 완료되었습니다.</strong>
              <p>마이애니트랙 계정과 활성 서비스 데이터가 삭제되었습니다. 보관 정책이 적용되는 데이터는 위 기간 안에 파기됩니다.</p>
              <Link className="primary-button" to="/">홈으로 돌아가기</Link>
            </div>
          ) : isAuthenticated && user ? (
            <div className="deletion-account-card">
              <div className="deletion-account-summary">
                <span>현재 로그인 계정</span>
                <strong>{user.username || '사용자명 미설정'}</strong>
                <small>{maskEmail(user.email)}</small>
              </div>
              <div className="deletion-warning" role="note">
                <strong>이 작업은 되돌릴 수 없습니다.</strong>
                <p>다른 기기의 로그인 세션도 더 이상 사용할 수 없으며, 삭제한 컬렉션과 분석은 복구되지 않습니다.</p>
              </div>
              <label className="policy-confirm-field" htmlFor="account-deletion-confirmation">
                <span>계속하려면 “{DELETION_CONFIRMATION}”를 입력하세요.</span>
                <input
                  id="account-deletion-confirmation"
                  type="text"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </label>
              <ErrorToast message={error} />
              <button
                className="policy-danger-button"
                type="button"
                disabled={confirmation !== DELETION_CONFIRMATION || isSubmitting}
                onClick={() => setDeletionState('confirming')}
              >
                계정 영구 삭제
              </button>
              {errorStatus === 401 && (
                <Link to="/login" state={{ from: '/account-deletion' }}>다시 로그인하기</Link>
              )}
            </div>
          ) : (
            <div className="deletion-signed-out-card">
              <strong>로그인할 수 있다면 웹에서 바로 삭제할 수 있습니다.</strong>
              <p>로그인 후 확인 문구와 최종 확인 단계를 거쳐 계정과 연결 데이터를 삭제합니다.</p>
              <Link className="primary-button" to="/login" state={{ from: '/account-deletion' }}>
                로그인하여 계정 삭제
              </Link>
              <hr />
              <strong>로그인할 수 없나요?</strong>
              <p>가입한 이메일 주소에서 고객지원으로 삭제 요청을 보내주세요. 계정 소유 확인 후 처리하며, 이메일에 비밀번호나 인증 토큰을 적지 마세요.</p>
              <a href={supportHref}>{PRIVACY_CONTACT_EMAIL}</a>
            </div>
          )}
        </section>
      </div>

      <footer className="policy-footer">
        <Link to="/privacy">개인정보처리방침</Link>
        <a href={supportHref}>삭제 관련 문의</a>
        <Link to="/">마이애니트랙 홈으로 돌아가기</Link>
      </footer>

      {deletionState === 'confirming' && (
        <div className="policy-modal-backdrop" role="presentation" onMouseDown={() => setDeletionState('idle')}>
          <div
            className="policy-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-deletion-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="policy-eyebrow">Final confirmation</span>
            <h2 id="account-deletion-dialog-title">정말 계정을 삭제할까요?</h2>
            <p>컬렉션, 평점, 분석, 프로필과 친구 관계가 삭제되고 다른 기기의 세션도 사용할 수 없습니다.</p>
            <div className="policy-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDeletionState('idle')}>취소</button>
              <button ref={confirmButtonRef} className="policy-danger-button" type="button" onClick={() => { void handleDelete() }}>
                삭제를 최종 확인합니다
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
