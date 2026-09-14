import { useCallback, useEffect, useState } from 'react'
import { ErrorToast } from './ErrorToast'
import { fetchProfileReports, resolveProfileReport } from '../lib/admin'

const reasonLabels: Record<string, string> = {
  SEXUAL_CONTENT: '성적 콘텐츠',
  VIOLENT_CONTENT: '폭력적 콘텐츠',
  ALCOHOL_TOBACCO_DRUGS: '술·담배·약물',
  HATE_HARASSMENT: '혐오·괴롭힘',
  SPAM_IMPERSONATION: '스팸·사칭',
  OTHER: '기타',
}

export function AdminProfileReportManager() {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof fetchProfileReports>>>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setReports(await fetchProfileReports()); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '신고를 불러오지 못했어요.') }
  }, [])
  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const act = async (id: number, action: 'DISMISS' | 'REMOVE_PROFILE' | 'SUSPEND_USER') => {
    setBusyId(id)
    try { await resolveProfileReport(id, action); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '신고 처리에 실패했어요.') }
    finally { setBusyId(null) }
  }

  return (
    <section className="admin-action-card">
      <div className="admin-action-copy"><h3>프로필 신고 대기열</h3><p>신고 당시 이미지를 확인하고 조치하세요.</p></div>
      <ErrorToast message={error} />
      {reports.length === 0 ? <div className="feedback-card">대기 중인 신고가 없습니다.</div> : reports.map((report) => (
        <article className="admin-response-card" key={report.id}>
          <strong>#{report.id} {report.reportedUsername} · {reasonLabels[report.reason] ?? report.reason}</strong>
          <p>신고자: {report.reporterUsername} · 중복 요청 {report.requestCount}회</p>
          {report.profileImageUrl && <img src={report.profileImageUrl} alt="신고된 프로필" width="96" height="96" />}
          <div className="admin-action-footer">
            <button className="secondary-button" disabled={busyId === report.id} onClick={() => void act(report.id, 'DISMISS')}>기각</button>
            <button className="secondary-button" disabled={busyId === report.id} onClick={() => void act(report.id, 'REMOVE_PROFILE')}>이미지 제거</button>
            <button className="primary-button" disabled={busyId === report.id} onClick={() => void act(report.id, 'SUSPEND_USER')}>사용자 정지</button>
          </div>
        </article>
      ))}
    </section>
  )
}
