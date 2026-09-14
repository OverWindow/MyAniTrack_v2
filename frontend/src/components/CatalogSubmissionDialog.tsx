import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../i18n'
import { useAuth } from '../contexts/AuthContext'
import { createCatalogSubmission } from '../lib/catalog'
import type { CatalogChangeKind, CatalogEntityType } from '../types/admin'
import '../styles/components/CatalogSubmissionDialog.css'

export function CatalogSubmissionDialog(props: {
  open: boolean
  onClose: () => void
  initialName?: string
  entityType?: CatalogEntityType
  kind?: CatalogChangeKind
  targetEntityId?: number
  payload?: Record<string, unknown>
}) {
  const { isAuthenticated } = useAuth()
  const [name, setName] = useState(props.initialName ?? '')
  const [sourceUrl, setSourceUrl] = useState('')
  const [description, setDescription] = useState('')
  const [payloadText, setPayloadText] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Opening the reusable modal starts a fresh submission form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (props.open) { setName(props.initialName ?? ''); setPayloadText('{}'); setMessage(null) }
  }, [props.initialName, props.open])
  if (!props.open) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null)
    try {
      const optionalPayload = JSON.parse(payloadText) as unknown
      if (!optionalPayload || typeof optionalPayload !== 'object' || Array.isArray(optionalPayload)) throw new Error(tr('선택 상세 정보는 JSON 객체여야 해요.'))
      await createCatalogSubmission({
        entityType: props.entityType ?? 'ANIME', kind: props.kind ?? 'CREATE_ENTITY', targetEntityId: props.targetEntityId,
        displayName: name, sourceUrl, description, payload: { ...optionalPayload as Record<string, unknown>, ...(props.payload ?? {}) },
      })
      setMessage(tr('등록 요청을 보냈어요. 관리자가 확인한 뒤 공개됩니다.'))
    } catch (error) { setMessage(error instanceof Error ? error.message : tr('등록 요청을 보내지 못했어요.')) }
    finally { setBusy(false) }
  }

  return (
    <div className="catalog-submission-backdrop" role="dialog" aria-modal="true" aria-label={tr('카탈로그 등록 요청')}>
      <form className="catalog-submission-dialog" onSubmit={submit}>
        <header><div><small>{tr('사용자 제보')}</small><h2>{tr('카탈로그 등록 요청')}</h2></div><button type="button" onClick={props.onClose} aria-label={tr('닫기')}>×</button></header>
        {!isAuthenticated ? (
          <div className="feedback-card"><p>{tr('등록 요청을 보내려면 로그인이 필요해요.')}</p><Link className="primary-button" to="/login">{tr('로그인')}</Link></div>
        ) : (
          <>
            <label>{tr('이름 또는 제목')}<input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>{tr('확인 가능한 HTTPS 출처')}<input required type="url" pattern="https://.*" placeholder="https://" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
            <label>{tr('제보 설명')}<textarea required maxLength={2000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <details><summary>{tr('선택 상세 정보와 연결 정보')}</summary><label>{tr('JSON 객체 형식')}<textarea rows={7} value={payloadText} onChange={(event) => setPayloadText(event.target.value)} /></label></details>
            <p className="catalog-submission-note">{tr('제보 내용은 승인 전까지 공개되지 않으며, 관리자가 편집하거나 거절할 수 있어요.')}</p>
            {message && <div className="feedback-card" role="status">{message} <Link to="/submissions">{tr('내 요청 보기')}</Link></div>}
            <div className="catalog-submission-actions"><button className="secondary-button" type="button" onClick={props.onClose}>{tr('취소')}</button><button className="primary-button" disabled={busy}>{busy ? tr('전송 중') : tr('등록 요청 보내기')}</button></div>
          </>
        )}
      </form>
    </div>
  )
}
