import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../i18n'
import { useAuth } from '../contexts/AuthContext'
import { createCatalogSubmission, searchCatalogEntities } from '../lib/catalog'
import type { CatalogEntityType, CatalogSearchItem } from '../types/admin'
import '../styles/components/CatalogSubmissionDialog.css'

export function CatalogLinkDialog(props: {
  open: boolean
  onClose: () => void
  animeId: number
  entityType: Extract<CatalogEntityType, 'CHARACTER' | 'VOICE_ACTOR' | 'STUDIO'>
  characterId?: number
}) {
  const { isAuthenticated } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchItem[]>([])
  const [selected, setSelected] = useState<CatalogSearchItem | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Opening the reusable modal starts a fresh submission form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (props.open) { setQuery(''); setResults([]); setSelected(null); setSourceUrl(''); setDescription(''); setMessage(null) }
  }, [props.open, props.entityType])
  if (!props.open) return null

  const search = async () => {
    setBusy(true); setMessage(null)
    try { setResults(await searchCatalogEntities(props.entityType, query)) }
    catch (error) { setMessage(error instanceof Error ? error.message : tr('카탈로그 검색에 실패했어요.')) }
    finally { setBusy(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setBusy(true); setMessage(null)
    try {
      await createCatalogSubmission({
        entityType: props.entityType,
        kind: 'LINK_TO_ANIME',
        targetEntityId: selected.id,
        displayName: selected.displayName,
        sourceUrl,
        description,
        payload: {
          animeId: props.animeId,
          ...(props.entityType === 'STUDIO' ? { isMain: false } : {}),
          ...(props.entityType === 'CHARACTER' ? { role: 'BACKGROUND' } : {}),
          ...(props.entityType === 'VOICE_ACTOR' ? { characterId: props.characterId, languageV2: 'Japanese' } : {}),
        },
      })
      setMessage(tr('연결 요청을 보냈어요. 관리자가 확인한 뒤 반영됩니다.'))
    } catch (error) { setMessage(error instanceof Error ? error.message : tr('연결 요청을 보내지 못했어요.')) }
    finally { setBusy(false) }
  }

  return <div className="catalog-submission-backdrop" role="dialog" aria-modal="true" aria-label={tr('기존 항목 연결 요청')}>
    <form className="catalog-submission-dialog" onSubmit={submit}>
      <header><div><small>{props.entityType}</small><h2>{tr('기존 항목 연결 요청')}</h2></div><button type="button" onClick={props.onClose} aria-label={tr('닫기')}>×</button></header>
      {!isAuthenticated ? <div className="feedback-card"><p>{tr('연결 요청을 보내려면 로그인이 필요해요.')}</p><Link className="primary-button" to="/login">{tr('로그인')}</Link></div> : <>
        <label>{tr('이름 검색')}<div className="catalog-submission-actions"><input value={query} onChange={(event) => setQuery(event.target.value)} /><button className="secondary-button" type="button" disabled={busy || !query.trim()} onClick={() => void search()}>{tr('검색')}</button></div></label>
        {results.length > 0 && <div className="feedback-card">{results.map((item) => <button className={selected?.id === item.id ? 'primary-button' : 'secondary-button'} type="button" key={item.id} onClick={() => setSelected(item)}>{item.displayName}</button>)}</div>}
        <label>{tr('확인 가능한 HTTPS 출처')}<input required type="url" pattern="https://.*" placeholder="https://" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
        <label>{tr('연결 근거 설명')}<textarea required maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {message && <div className="feedback-card" role="status">{message} <Link to="/submissions">{tr('내 요청 보기')}</Link></div>}
        <div className="catalog-submission-actions"><button className="secondary-button" type="button" onClick={props.onClose}>{tr('취소')}</button><button className="primary-button" disabled={busy || !selected}>{tr('연결 요청 보내기')}</button></div>
      </>}
    </form>
  </div>
}
