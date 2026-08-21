import { useState } from 'react'
import { ErrorToast } from './ErrorToast'
import { setAnimeVisibility } from '../lib/admin'

export function AdminAnimeVisibilityManager() {
  const [animeId, setAnimeId] = useState(0)
  const [visible, setVisible] = useState(false)
  const [reason, setReason] = useState('Play 정책 수동 숨김')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <section className="admin-action-card">
      <div className="admin-action-copy"><h3>작품 노출 재정의</h3><p>동기화가 덮어쓰지 않는 앱 노출 상태를 지정합니다.</p></div>
      <div className="admin-form-grid">
        <label className="auth-field"><span>작품 ID</span><input type="number" min="1" value={animeId || ''} onChange={(e) => setAnimeId(Number(e.target.value))} /></label>
        <label className="auth-field"><span>사유</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label className="admin-checkbox-field"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /><span>{visible ? '노출' : '숨김'}</span></label>
      </div>
      <button className="primary-button auth-submit" disabled={busy || animeId < 1} onClick={async () => {
        setBusy(true); setMessage(null); setError(null)
        try { await setAnimeVisibility(animeId, visible, reason); setMessage('작품 노출 상태를 저장했습니다.') }
        catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요.') }
        finally { setBusy(false) }
      }}>{busy ? '저장 중...' : '노출 상태 저장'}</button>
      {message && <div className="feedback-card">{message}</div>}
      <ErrorToast message={error} />
    </section>
  )
}
