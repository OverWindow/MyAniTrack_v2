import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../i18n'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyCatalogSubmissions, withdrawCatalogSubmission } from '../lib/catalog'
import type { CatalogSubmission } from '../types/admin'

function getStatusLabel(status: string) {
  if (status === 'PENDING') return tr('검토 대기')
  if (status === 'APPROVED') return tr('승인됨')
  if (status === 'REJECTED') return tr('거절됨')
  if (status === 'WITHDRAWN') return tr('철회됨')
  return status
}

export function CatalogSubmissionsPage() {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState<CatalogSubmission[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { try { setItems(await fetchMyCatalogSubmissions()); setError(null) } catch (reason) { setError(reason instanceof Error ? reason.message : tr('내 등록 요청을 불러오지 못했어요.')) } }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) void load()
  }, [isAuthenticated, load])
  if (!isAuthenticated) return <section className="settings-page"><div className="feedback-card"><p>{tr('등록 요청 내역을 보려면 로그인이 필요해요.')}</p><Link to="/login" className="primary-button">{tr('로그인')}</Link></div></section>
  return <section className="settings-page"><header className="page-heading"><span>CATALOG REQUESTS</span><h1>{tr('내 카탈로그 등록 요청')}</h1><p>{tr('관리자 검토 상태와 거절 사유를 확인할 수 있어요.')}</p></header>
    {error && <div className="feedback-card">{error}</div>}
    <div className="settings-card-list">{items.length === 0 ? <div className="feedback-card">{tr('아직 보낸 등록 요청이 없어요.')}</div> : items.map((item) => <article className="settings-card" key={item.id}><div><small>{item.entityType} · {item.source}</small><h2>{item.displayName}</h2><p>{item.description}</p><strong>{getStatusLabel(item.status)}</strong>{item.rejectionReason && <p>{tr('거절 사유')}: {item.rejectionReason}</p>}<a href={item.sourceUrl} target="_blank" rel="noreferrer">{tr('제출한 출처 보기')}</a></div>{item.status === 'PENDING' && <button className="secondary-button" onClick={() => void withdrawCatalogSubmission(item.id).then(load)}>{tr('요청 철회')}</button>}</article>)}</div>
  </section>
}
