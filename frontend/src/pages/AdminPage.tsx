import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, Bot, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Database, ExternalLink,
  LayoutDashboard, LibraryBig, Menu, Play, Plus, RefreshCw, RotateCcw, Search,
  Settings, ShieldCheck, Sparkles, Upload, Users, Wrench, X, type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { AdminAnimeVisibilityManager } from '../components/AdminAnimeVisibilityManager'
import { AdminMaintenanceManager } from '../components/AdminMaintenanceManager'
import { AdminProfileReportManager } from '../components/AdminProfileReportManager'
import { AdminUserManager } from '../components/AdminUserManager'
import { useAuth } from '../contexts/AuthContext'
import {
  approveCatalogSubmission, cancelDiscoveryRun, createDiscoveryRun, fetchAdminOverview, fetchCatalogEntity,
  fetchCatalogTaxonomy,
  fetchCatalogSubmissions, fetchDiscoveryRun, fetchDiscoveryRuns, rejectCatalogSubmission,
  retryDiscoveryRun, searchCatalog, updateCatalogSubmission, uploadCatalogEntityImage,
  writeCatalogEntity,
} from '../lib/admin'
import type {
  AdminOverview, CatalogChangeSource, CatalogChangeStatus, CatalogDiscoveryRun,
  CatalogEntityDetail, CatalogEntityType, CatalogSearchItem, CatalogSubmission, CatalogTagSelection, CatalogTaxonomyOption,
} from '../types/admin'
import '../styles/pages/AdminPage.css'

const TYPES: CatalogEntityType[] = ['ANIME', 'CHARACTER', 'VOICE_ACTOR', 'STUDIO']
const TYPE_LABELS: Record<CatalogEntityType, string> = {
  ANIME: '작품', CHARACTER: '캐릭터', VOICE_ACTOR: '성우', STUDIO: '스튜디오',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING: '검토 대기', APPROVED: '승인됨', REJECTED: '거절됨', WITHDRAWN: '철회됨',
  queued: '대기', discovering: '후보 탐색', extracting: '상세 수집', completed: '완료',
  failed: '실패', canceled: '취소됨', pending: '대기', processing: '처리 중', created: '초안 생성',
  skipped: '건너뜀',
}

type CatalogDraft = Record<string, string>
type CatalogDraftContextValue = { draft: CatalogDraft; setField: (name: string, value: string) => void }
const CatalogDraftContext = createContext<CatalogDraftContextValue | null>(null)

function Field({ name, label, type = 'text', placeholder }: { name: string; label: string; type?: string; placeholder?: string }) {
  const context = useContext(CatalogDraftContext)
  if (!context) return null
  return <label className="admin-field"><span>{label}</span><input type={type} value={context.draft[name] ?? ''} placeholder={placeholder} onChange={(event) => context.setField(name, event.target.value)} /></label>
}

function TextArea({ name, label, rows = 4, placeholder }: { name: string; label: string; rows?: number; placeholder?: string }) {
  const context = useContext(CatalogDraftContext)
  if (!context) return null
  return <label className="admin-field"><span>{label}</span><textarea rows={rows} value={context.draft[name] ?? ''} placeholder={placeholder} onChange={(event) => context.setField(name, event.target.value)} /></label>
}

type NavigationItem = { to: string; label: string; description: string; icon: LucideIcon; end?: boolean }
const NAVIGATION: Array<{ label: string; items: NavigationItem[] }> = [
  { label: '종합', items: [{ to: '/admin', label: '현황', description: '운영 요약', icon: LayoutDashboard, end: true }] },
  { label: '카탈로그 운영', items: [
    { to: '/admin/catalog/entities', label: '엔티티', description: '작품과 인물 관리', icon: LibraryBig },
    { to: '/admin/catalog/reviews', label: '검토함', description: '사용자·AI 제보', icon: CheckCircle2 },
    { to: '/admin/catalog/discovery', label: 'AI 분기 수집', description: '자동 탐색과 실행', icon: Sparkles },
  ] },
  { label: '사용자 운영', items: [{ to: '/admin/users', label: '사용자 관리', description: '계정과 이용 현황', icon: Users }] },
  { label: '콘텐츠·안전', items: [{ to: '/admin/safety', label: '신고 및 노출', description: '신고와 작품 공개', icon: ShieldCheck }] },
  { label: '서비스', items: [{ to: '/admin/settings/maintenance', label: '점검 설정', description: '서비스 점검 모드', icon: Wrench }] },
]

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul',
  }).format(date)
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusTone(status: string) {
  if (['APPROVED', 'completed', 'created'].includes(status)) return 'success'
  if (['REJECTED', 'failed'].includes(status)) return 'danger'
  if (['PENDING', 'queued', 'discovering', 'extracting', 'processing'].includes(status)) return 'warning'
  return 'neutral'
}

function confidenceBand(score: number) {
  if (score >= 0.85) return { label: '높음', tone: 'success' }
  if (score >= 0.6) return { label: '보통', tone: 'warning' }
  return { label: '낮음', tone: 'danger' }
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow: string; title: string; description?: string; actions?: ReactNode
}) {
  return (
    <header className="admin-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  )
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`admin-status-badge is-${statusTone(status)}`}>{label ?? statusLabel(status)}</span>
}

export function AdminPage() {
  const { user, isBootstrapping } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'ADMIN')

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false)
    if (restoreFocus) window.setTimeout(() => menuButtonRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [closeMenu, menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    sidebarRef.current?.querySelector<HTMLElement>('a[aria-current="page"]')?.focus()
  }, [menuOpen])

  if (isBootstrapping) return <div className="feedback-card">관리자 권한을 확인하고 있어요.</div>
  if (!isAdmin) {
    return <section className="admin-access-denied"><h1>관리자 전용 페이지입니다.</h1><Link to="/">홈으로</Link></section>
  }

  return (
    <section className="admin-page">
      <button
        ref={menuButtonRef}
        className="admin-mobile-menu-button"
        type="button"
        aria-label={menuOpen ? '관리자 메뉴 닫기' : '관리자 메뉴 열기'}
        aria-expanded={menuOpen}
        aria-controls="admin-sidebar"
        onClick={() => setMenuOpen((current) => !current)}
      >
        {menuOpen ? <X size={19} /> : <Menu size={19} />}
        <span>관리자 메뉴</span>
      </button>

      {menuOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="관리자 메뉴 닫기" onClick={() => closeMenu(true)} />}
      <div className="admin-shell">
        <aside ref={sidebarRef} id="admin-sidebar" className={`admin-sidebar${menuOpen ? ' is-open' : ''}`}>
          <div className="admin-sidebar-brand"><Settings size={18} /><div><strong>관리자</strong><small>MyAniTrack Console</small></div></div>
          <nav aria-label="관리자 기능">
            {NAVIGATION.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink key={item.to} to={item.to} end={item.end} onClick={() => closeMenu()} className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}>
                      <Icon size={18} aria-hidden="true" />
                      <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </nav>
        </aside>
        <main className="admin-content"><Outlet /></main>
      </div>
    </section>
  )
}

export function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    try {
      setOverview(await fetchAdminOverview(signal))
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '관리자 현황을 불러오지 못했어요.')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0)
    return () => { window.clearTimeout(timeoutId); controller.abort() }
  }, [load])

  const metrics = overview ? [
    { label: '등록 사용자', value: overview.counts.registeredUsers, icon: Users },
    { label: '등록 작품', value: overview.counts.anime, icon: LibraryBig },
    { label: '검토 대기', value: overview.counts.pendingCatalog, icon: CheckCircle2 },
    { label: '프로필 신고', value: overview.counts.pendingProfileReports, icon: ShieldCheck },
  ] : []

  const attention = overview ? [
    ...(overview.counts.pendingUserCatalog > 0 ? [{ label: '사용자 제보', count: overview.counts.pendingUserCatalog, description: '확인을 기다리는 사용자 등록 요청', to: '/admin/catalog/reviews?status=PENDING&source=USER', tone: 'warning' }] : []),
    ...(overview.counts.pendingAiCatalog > 0 ? [{ label: 'AI 초안', count: overview.counts.pendingAiCatalog, description: '승인 전 검토가 필요한 수집 결과', to: '/admin/catalog/reviews?status=PENDING&source=AI', tone: 'warning' }] : []),
    ...(overview.counts.failedDiscoveryRuns > 0 ? [{ label: 'AI 실행 오류', count: overview.counts.failedDiscoveryRuns, description: '재시도 또는 원인 확인이 필요한 실행', to: '/admin/catalog/discovery?status=failed', tone: 'danger' }] : []),
    ...(overview.service.maintenanceEnabled ? [{ label: '점검 모드', count: 1, description: '현재 일반 사용자에게 점검 화면이 표시됩니다', to: '/admin/settings/maintenance', tone: 'danger' }] : []),
  ] : []

  const currentRun = overview?.service.discovery.activeRun ?? overview?.service.discovery.latestRun
  const progress = currentRun && currentRun.candidateCount > 0
    ? Math.min(100, Math.round((currentRun.processedCount / currentRun.candidateCount) * 100)) : 0

  return (
    <div className="admin-page-stack">
      <PageHeader
        eyebrow="관리자 / 종합 현황"
        title="오늘의 운영 현황"
        description={overview ? `마지막 갱신 ${formatDateTime(overview.generatedAt)}` : '서비스와 운영 대기열을 한눈에 확인합니다.'}
        actions={<button className="admin-icon-button" type="button" disabled={isLoading} onClick={() => void load()}><RefreshCw size={17} className={isLoading ? 'is-spinning' : ''} /><span>새로고침</span></button>}
      />

      {error && <div className="admin-alert is-danger"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => void load()}>다시 시도</button></div>}

      {isLoading && !overview ? (
        <section className="admin-panel admin-dashboard-skeleton" aria-label="현황을 불러오는 중">현황을 불러오는 중입니다.</section>
      ) : overview && <>
        <section className="admin-panel admin-overview-panel">
          <div className="admin-panel-heading"><h2>운영 요약</h2></div>
          <dl className="admin-overview-metrics" aria-label="핵심 지표">
            {metrics.map((item) => {
              const Icon = item.icon
              return <div key={item.label}><span><Icon size={17} />{item.label}</span><strong>{item.value.toLocaleString('ko-KR')}</strong></div>
            })}
          </dl>
          <div className="admin-overview-details">
            <section>
              <h3>서비스 상태</h3>
              <div className="admin-service-list">
                <div className="admin-service-row"><span className={`admin-service-dot${overview.service.maintenanceEnabled ? ' is-danger' : ' is-success'}`} /><div><strong>{overview.service.maintenanceEnabled ? '점검 모드 사용 중' : '서비스 정상 운영 중'}</strong><small>{overview.service.maintenanceEnabled ? '일반 사용자 접근 제한' : '사용자 접근 정상'}</small></div><Link to="/admin/settings/maintenance">설정</Link></div>
                <div className="admin-service-row"><Bot size={18} /><div><strong>{currentRun ? `${currentRun.seasonYear} ${currentRun.season} · ${statusLabel(currentRun.status)}` : 'AI 실행 이력 없음'}</strong><small>다음 실행 {formatDateTime(overview.service.discovery.nextSchedule.scheduledAt)}</small></div><Link to="/admin/catalog/discovery">보기</Link></div>
                {currentRun && <div className="admin-progress" aria-label={`AI 실행 진행률 ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
              </div>
            </section>
            <section>
              <div className="admin-subsection-heading"><h3>카탈로그</h3><Link to="/admin/catalog/entities">관리하기 <ArrowRight size={14} /></Link></div>
              <dl className="admin-catalog-summary">
                <div><dt>작품</dt><dd>{overview.counts.anime.toLocaleString('ko-KR')}</dd></div>
                <div><dt>캐릭터</dt><dd>{overview.counts.characters.toLocaleString('ko-KR')}</dd></div>
                <div><dt>성우</dt><dd>{overview.counts.voiceActors.toLocaleString('ko-KR')}</dd></div>
                <div><dt>스튜디오</dt><dd>{overview.counts.studios.toLocaleString('ko-KR')}</dd></div>
              </dl>
            </section>
          </div>
        </section>

        <section className="admin-panel admin-attention-panel">
          <div className="admin-panel-heading"><h2>처리가 필요한 항목</h2>{attention.length > 0 && <strong>{attention.reduce((sum, item) => sum + item.count, 0)}</strong>}</div>
          {attention.length === 0 ? (
            <div className="admin-empty-state is-compact"><CheckCircle2 size={21} /><div><strong>대기 중인 긴급 작업이 없습니다.</strong><p>새 요청이나 오류가 생기면 이곳에 표시됩니다.</p></div></div>
          ) : <div className="admin-attention-list">{attention.map((item) => (
            <Link to={item.to} className={`admin-attention-item is-${item.tone}`} key={item.label}><span className="admin-attention-count">{item.count.toLocaleString('ko-KR')}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={17} /></Link>
          ))}</div>}
          <nav className="admin-quick-actions" aria-label="빠른 작업">
            <Link to="/admin/catalog/entities?type=ANIME&mode=create"><Plus size={16} />작품 생성</Link>
            <Link to="/admin/catalog/reviews?status=PENDING"><CheckCircle2 size={16} />검토함 열기</Link>
            <Link to="/admin/catalog/discovery?action=create"><Play size={16} />AI 수동 실행</Link>
          </nav>
        </section>

        <section className="admin-panel admin-recent-panel">
          <div className="admin-panel-heading"><h2>최근 활동</h2></div>
          <div className="admin-recent-columns">
            <section><div className="admin-subsection-heading"><h3>최근 제보</h3><Link to="/admin/catalog/reviews">전체 보기</Link></div>
              {overview.recent.submissions.length === 0 ? <div className="admin-empty-state is-compact">최근 제보가 없습니다.</div> : <div className="admin-activity-list">{overview.recent.submissions.map((item) => (
                <Link to={`/admin/catalog/reviews?status=${item.status}&type=${item.entityType}`} key={item.id}><Database size={17} /><span><strong>{item.displayName}</strong><small>{item.source} · {TYPE_LABELS[item.entityType]} · {formatDateTime(item.createdAt)}</small></span><StatusBadge status={item.status} /></Link>
              ))}</div>}
            </section>
            <section><div className="admin-subsection-heading"><h3>최근 AI 실행</h3><Link to="/admin/catalog/discovery">전체 보기</Link></div>
              {overview.recent.discoveryRuns.length === 0 ? <div className="admin-empty-state is-compact">AI 실행 이력이 없습니다.</div> : <div className="admin-activity-list">{overview.recent.discoveryRuns.map((run) => (
                <Link to={`/admin/catalog/discovery?run=${run.id}`} key={run.id}><Bot size={17} /><span><strong>{run.seasonYear} {run.season}</strong><small>{run.processedCount}/{run.candidateCount} 처리 · 실패 {run.failedCount}</small></span><StatusBadge status={run.status} /></Link>
              ))}</div>}
            </section>
          </div>
        </section>
      </>}
    </div>
  )
}

const blankCatalogDraft = () => ({} as CatalogDraft)

function TaxonomyMultiSelect({ label, options, selected, onChange, isLoading }: {
  label: string
  options: CatalogTaxonomyOption[]
  selected: string[]
  onChange: (values: string[]) => void
  isLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const filtered = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase('ko-KR')
    return normalized ? options.filter((option) => option.value.toLocaleLowerCase('ko-KR').includes(normalized)) : options
  }, [filter, options])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  return <div className="admin-taxonomy-field" ref={rootRef}>
    <span className="admin-taxonomy-label">{label}</span>
    <button className="admin-taxonomy-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{isLoading ? '분류를 불러오는 중...' : selected.length > 0 ? `${selected.length}개 선택됨` : `${label} 선택`}</span><ChevronDown size={16} />
    </button>
    {selected.length > 0 && <div className="admin-taxonomy-chips">{selected.map((value) => <span key={value}>{value}<button type="button" aria-label={`${value} 선택 해제`} onClick={() => toggle(value)}><X size={13} /></button></span>)}</div>}
    {open && <div className="admin-taxonomy-menu">
      <input type="search" autoFocus value={filter} aria-label={`${label} 검색`} placeholder={`${label} 검색`} onChange={(event) => setFilter(event.target.value)} />
      <div className="admin-taxonomy-options" role="listbox" aria-label={`${label} 목록`} aria-multiselectable="true">
        {filtered.map((option) => <label role="option" aria-selected={selected.includes(option.value)} key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} /><span>{option.value}</span><small>{option.usageCount.toLocaleString('ko-KR')}</small></label>)}
        {!isLoading && filtered.length === 0 && <div className="admin-taxonomy-empty">일치하는 기존 분류가 없습니다.</div>}
      </div>
    </div>}
  </div>
}

export function AdminCatalogEntitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const type = TYPES.includes(searchParams.get('type') as CatalogEntityType) ? searchParams.get('type') as CatalogEntityType : 'ANIME'
  const routeId = Number(searchParams.get('id'))
  const selectedId = Number.isInteger(routeId) && routeId > 0 ? routeId : undefined
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchItem[]>([])
  const [draft, setDraft] = useState<CatalogDraft>(blankCatalogDraft)
  const [genres, setGenres] = useState<string[]>([])
  const [tags, setTags] = useState<CatalogTagSelection[]>([])
  const [genreOptions, setGenreOptions] = useState<CatalogTaxonomyOption[]>([])
  const [tagOptions, setTagOptions] = useState<CatalogTaxonomyOption[]>([])
  const [taxonomyLoading, setTaxonomyLoading] = useState(true)
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(() => new Set())
  const [isAnimationStudio, setIsAnimationStudio] = useState(true)
  const [isAdult, setIsAdult] = useState(false)
  const [detail, setDetail] = useState<CatalogEntityDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [variant, setVariant] = useState('cover_extra_large')
  const searchControllerRef = useRef<AbortController | null>(null)

  const markDirty = (name: string) => setDirtyFields((current) => new Set(current).add(name))
  const setField = (name: string, value: string) => {
    setDraft((current) => ({ ...current, [name]: value })); markDirty(name)
  }

  useEffect(() => {
    const controller = new AbortController()
    void fetchCatalogTaxonomy(controller.signal).then((taxonomy) => {
      setGenreOptions(taxonomy.genres); setTagOptions(taxonomy.tags)
    }).catch((cause) => {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : '분류 목록을 불러오지 못했어요.')
    }).finally(() => { if (!controller.signal.aborted) setTaxonomyLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setDraft(blankCatalogDraft()); setGenres([]); setTags([]); setDirtyFields(new Set())
      setIsAdult(false); setIsAnimationStudio(true); setDetail(null); setDetailError(null); setImage(null)
      setVariant(type === 'ANIME' ? 'cover_extra_large' : 'image_large')
      if (!selectedId) { setDetailLoading(false); return }
      setDetailLoading(true)
      void fetchCatalogEntity(type, selectedId, controller.signal).then((item) => {
        if (controller.signal.aborted) return
        const payload = item.payload
        const nextDraft: CatalogDraft = {}
        Object.entries(payload).forEach(([key, value]) => {
          if (['genres', 'tags', 'studios', 'cast', 'relations', 'synonyms', 'isAdult', 'isAnimationStudio', 'appVisible'].includes(key)) return
          nextDraft[key] = value === null || value === undefined ? '' : String(value)
        })
        nextDraft.synonyms = Array.isArray(payload.synonyms) ? payload.synonyms.join(', ') : ''
        ;['studios', 'cast', 'relations'].forEach((key) => { nextDraft[key] = Array.isArray(payload[key]) ? pretty(payload[key]) : '' })
        setDraft(nextDraft)
        setGenres(Array.isArray(payload.genres) ? payload.genres.map(String) : [])
        setTags(Array.isArray(payload.tags) ? payload.tags.flatMap((raw) => {
          if (!raw || typeof raw !== 'object' || !('name' in raw)) return []
          const tag = raw as { name: unknown; rank?: unknown; isSpoiler?: unknown }
          return [{ name: String(tag.name), rank: tag.rank === null || tag.rank === undefined ? null : Number(tag.rank), isSpoiler: Boolean(tag.isSpoiler) }]
        }) : [])
        setIsAdult(payload.isAdult === true)
        setIsAnimationStudio(payload.isAnimationStudio !== false)
        setDetail(item)
        setDirtyFields(new Set())
      }).catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setDetailError(cause instanceof Error ? cause.message : '상세 정보를 불러오지 못했어요.')
      }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timeoutId); controller.abort() }
  }, [detailVersion, selectedId, type])

  useEffect(() => () => searchControllerRef.current?.abort(), [])

  const startCreate = (nextType = type) => {
    const next = new URLSearchParams(searchParams); next.set('type', nextType); next.set('mode', 'create'); next.delete('id'); setSearchParams(next)
    setDetailVersion((current) => current + 1); setMessage(null); setError(null)
  }
  const changeType = (nextType: CatalogEntityType) => {
    setQuery(''); setResults([]); startCreate(nextType)
  }
  const runSearch = async () => {
    searchControllerRef.current?.abort()
    const controller = new AbortController(); searchControllerRef.current = controller
    setSearchBusy(true); setError(null)
    try { setResults(await searchCatalog(type, query, 20, controller.signal)) } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : '검색에 실패했어요.')
    } finally { if (!controller.signal.aborted) setSearchBusy(false) }
  }

  const buildPayload = () => {
    const payload: Record<string, unknown> = {}
    const isCreate = !selectedId
    const textFields = type === 'ANIME'
      ? ['titleKorean', 'titleKoreanSubtitle', 'titleRomaji', 'titleEnglish', 'titleNative', 'titleUserPreferred', 'description', 'season', 'format', 'status', 'source', 'countryOfOrigin', 'officialSiteUrl']
      : type === 'STUDIO' ? ['name', 'officialSiteUrl']
        : ['nameFull', 'nameNative', 'nameUserPreferred', 'description', 'officialSiteUrl', ...(type === 'CHARACTER' ? ['gender', 'age'] : ['languageV2'])]
    textFields.forEach((key) => {
      if (!isCreate && !dirtyFields.has(key)) return
      const value = draft[key]?.trim() ?? ''
      if (value) payload[key] = value
      else if (!isCreate) payload[key] = null
    })
    if (type === 'ANIME') {
      ;['episodes', 'duration', 'seasonYear'].forEach((key) => {
        if (!isCreate && !dirtyFields.has(key)) return
        const value = draft[key]?.trim() ?? ''
        if (value) payload[key] = Number(value)
        else if (!isCreate) payload[key] = null
      })
      if (isCreate || dirtyFields.has('genres')) payload.genres = genres
      if (isCreate || dirtyFields.has('tags')) payload.tags = tags
      if (isCreate || dirtyFields.has('synonyms')) payload.synonyms = (draft.synonyms ?? '').split(',').map((item) => item.trim()).filter(Boolean)
      ;['studios', 'cast', 'relations'].forEach((key) => {
        if (!isCreate && !dirtyFields.has(key)) return
        const value = draft[key]?.trim()
        if (value) payload[key] = JSON.parse(value)
        else if (!isCreate) payload[key] = []
      })
      if (isCreate || dirtyFields.has('isAdult')) payload.isAdult = isAdult
    }
    if (type === 'STUDIO' && (isCreate || dirtyFields.has('isAnimationStudio'))) payload.isAnimationStudio = isAnimationStudio
    return payload
  }

  const save = async () => {
    setSaveBusy(true); setError(null); setMessage(null)
    try {
      if (type === 'ANIME' && !['titleKorean', 'titleRomaji', 'titleEnglish', 'titleNative', 'titleUserPreferred'].some((key) => draft[key]?.trim())) throw new Error('작품 제목을 한 개 이상 입력하세요.')
      if (type === 'STUDIO' && !draft.name?.trim()) throw new Error('스튜디오명은 비워 둘 수 없습니다.')
      if (['CHARACTER', 'VOICE_ACTOR'].includes(type) && !draft.nameFull?.trim()) throw new Error('이름은 비워 둘 수 없습니다.')
      const payload = buildPayload()
      if (Object.keys(payload).length === 0) throw new Error('저장할 정보를 한 개 이상 입력하세요.')
      const response = await writeCatalogEntity(type, payload, selectedId)
      setDirtyFields(new Set())
      if (!selectedId) {
        const next = new URLSearchParams(searchParams); next.set('type', type); next.set('id', String(response.result.entityId)); next.delete('mode'); setSearchParams(next)
      } else setDetailVersion((current) => current + 1)
      setMessage(`저장했습니다. 내부 ID ${response.result.entityId}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장에 실패했어요.') } finally { setSaveBusy(false) }
  }
  const upload = async () => {
    if (!selectedId || !image) return
    setSaveBusy(true); setError(null)
    try { await uploadCatalogEntityImage(type, selectedId, variant, image); setMessage('이미지를 업로드했습니다.'); setDetailVersion((current) => current + 1) } catch (cause) { setError(cause instanceof Error ? cause.message : '이미지 업로드에 실패했어요.') } finally { setSaveBusy(false) }
  }
  const publish = async () => {
    if (!selectedId || type !== 'ANIME') return
    setSaveBusy(true); setError(null)
    try { await writeCatalogEntity('ANIME', { appVisible: true }, selectedId); setMessage('커버를 확인하고 작품을 공개했습니다.'); setDetailVersion((current) => current + 1) } catch (cause) { setError(cause instanceof Error ? cause.message : '공개에 실패했어요.') } finally { setSaveBusy(false) }
  }

  const updateGenres = (values: string[]) => { setGenres(values); markDirty('genres') }
  const updateTagNames = (values: string[]) => {
    setTags(values.map((name) => tags.find((tag) => tag.name === name) ?? { name, rank: null, isSpoiler: false })); markDirty('tags')
  }
  const updateTag = (name: string, patch: Partial<CatalogTagSelection>) => {
    setTags((current) => current.map((tag) => tag.name === name ? { ...tag, ...patch } : tag)); markDirty('tags')
  }
  const imageLabels: Record<string, string> = { coverLarge: '커버', coverExtraLarge: '큰 커버', banner: '배너', large: '큰 이미지', medium: '중간 이미지' }
  const currentImages = Object.entries(detail?.images ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)

  return (
    <CatalogDraftContext.Provider value={{ draft, setField }}><div className="admin-page-stack">
      <PageHeader eyebrow="카탈로그 운영 / 엔티티" title="카탈로그 관리" description="기존 항목을 찾아 필요한 값만 수정하거나 새 엔티티를 등록합니다." actions={<button className="secondary-button" type="button" onClick={() => startCreate()}><Plus size={16} />신규 생성</button>} />
      <div className="admin-catalog-workspace">
        <aside className="admin-panel admin-catalog-browser">
          <div className="admin-type-tabs" role="tablist" aria-label="카탈로그 유형">{TYPES.map((item) => <button type="button" role="tab" aria-selected={type === item} className={type === item ? 'is-active' : ''} onClick={() => changeType(item)} key={item}>{TYPE_LABELS[item]}</button>)}</div>
          <form className="admin-search-row" onSubmit={(event) => { event.preventDefault(); void runSearch() }}><input type="search" value={query} placeholder={`${TYPE_LABELS[type]} 검색`} onChange={(event) => setQuery(event.target.value)} /><button type="submit" aria-label="검색" disabled={searchBusy || !query.trim()}><Search size={18} /></button></form>
          <div className="admin-browser-results">
            {results.map((item) => <button type="button" className={selectedId === item.id ? 'is-active' : ''} onClick={() => { const next = new URLSearchParams(searchParams); next.set('type', item.type); next.set('id', String(item.id)); next.delete('mode'); setSearchParams(next); setMessage(null); setError(null) }} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="admin-result-placeholder"><Database size={17} /></span>}<span><strong>{item.displayName}</strong><small>{item.subtitle || `${TYPE_LABELS[item.type]} #${item.id}`}</small></span><ChevronRight size={16} /></button>)}
            {searchBusy && <div className="admin-empty-state is-compact">검색 중입니다.</div>}
            {!searchBusy && query && results.length === 0 && <div className="admin-empty-state is-compact">검색 결과가 없습니다.</div>}
          </div>
        </aside>

        <section className="admin-panel admin-catalog-editor">
          <div className="admin-panel-heading"><div><h2>{selectedId ? `${TYPE_LABELS[type]} 수정` : `새 ${TYPE_LABELS[type]} 등록`}</h2><p>{selectedId ? `내부 ID ${selectedId} · 변경한 필드만 반영됩니다.` : '필수 이름과 필요한 상세 정보를 입력하세요.'}</p></div>{type === 'ANIME' && selectedId && <StatusBadge status={detail?.payload.appVisible === true ? 'APPROVED' : 'PENDING'} label={detail?.payload.appVisible === true ? '공개' : '비공개'} />}</div>

          {detailLoading ? <div className="admin-empty-state"><RefreshCw className="is-spinning" size={22} /><strong>원본 정보를 불러오는 중입니다.</strong></div> : detailError ? <div className="admin-empty-state"><CircleAlert size={22} /><strong>상세 정보를 불러오지 못했습니다.</strong><p>{detailError}</p><button className="secondary-button" type="button" onClick={() => setDetailVersion((current) => current + 1)}>다시 시도</button></div> : <>
          {currentImages.length > 0 && <div className="admin-current-images" aria-label="현재 등록 이미지">{currentImages.map(([key, url]) => <figure key={key}><img src={url} alt={`${detail?.displayName ?? TYPE_LABELS[type]} ${imageLabels[key] ?? '이미지'}`} /><figcaption>{imageLabels[key] ?? key}</figcaption></figure>)}</div>}
          {type === 'ANIME' ? <>
            <details className="admin-editor-section" open><summary>제목 정보</summary><div className="admin-form-grid"><Field name="titleKorean" label="한국어 제목" /><Field name="titleKoreanSubtitle" label="한국어 부제" /><Field name="titleRomaji" label="로마자 제목" /><Field name="titleEnglish" label="영문 제목" /><Field name="titleNative" label="원어 제목" /><Field name="titleUserPreferred" label="대표 제목" /></div></details>
            <details className="admin-editor-section" open><summary>기본 정보</summary><div className="admin-form-grid"><Field name="officialSiteUrl" label="공식 홈페이지" type="url" placeholder="https://" /><Field name="countryOfOrigin" label="제작 국가" placeholder="JP" /><Field name="source" label="원작 유형" placeholder="MANGA" /><label className="admin-check-field"><input type="checkbox" checked={isAdult} onChange={(event) => { setIsAdult(event.target.checked); markDirty('isAdult') }} /><span>성인 작품</span></label></div><TextArea name="description" label="설명" rows={6} /></details>
            <details className="admin-editor-section"><summary>방영 정보</summary><div className="admin-form-grid"><Field name="seasonYear" label="방영 연도" type="number" /><Field name="season" label="분기" placeholder="SPRING" /><Field name="format" label="형식" placeholder="TV" /><Field name="status" label="상태" placeholder="FINISHED" /><Field name="episodes" label="에피소드 수" type="number" /><Field name="duration" label="회당 분량(분)" type="number" /></div></details>
            <details className="admin-editor-section"><summary>장르·태그·동의어</summary><div className="admin-form-stack">
              <TaxonomyMultiSelect label="장르" options={genreOptions} selected={genres} onChange={updateGenres} isLoading={taxonomyLoading} />
              <TaxonomyMultiSelect label="태그" options={tagOptions} selected={tags.map((tag) => tag.name)} onChange={updateTagNames} isLoading={taxonomyLoading} />
              {tags.length > 0 && <div className="admin-tag-editor" aria-label="선택한 태그 설정">{tags.map((tag) => <div key={tag.name}><strong>{tag.name}</strong><label><span>중요도</span><input type="number" min="0" max="100" value={tag.rank ?? ''} onChange={(event) => updateTag(tag.name, { rank: event.target.value === '' ? null : Math.max(0, Math.min(100, Math.round(Number(event.target.value)))) })} /></label><label className="admin-check-field"><input type="checkbox" checked={tag.isSpoiler} onChange={(event) => updateTag(tag.name, { isSpoiler: event.target.checked })} /><span>스포일러</span></label><button type="button" aria-label={`${tag.name} 태그 제거`} onClick={() => updateTagNames(tags.filter((item) => item.name !== tag.name).map((item) => item.name))}><X size={15} /></button></div>)}</div>}
              <Field name="synonyms" label="동의어" placeholder="쉼표로 구분" />
            </div></details>
            <details className="admin-editor-section"><summary>스튜디오·캐스트·관계</summary><div className="admin-form-stack"><TextArea name="studios" label="스튜디오 연결 JSON" placeholder='[{"studio":{"existingId":1},"isMain":true}]' /><TextArea name="cast" label="캐스트 연결 JSON" rows={7} placeholder='[{"character":{"existingId":1},"role":"MAIN","voiceActors":[]}]' /><TextArea name="relations" label="연관 작품 JSON" placeholder='[{"targetAnimeId":2,"relationType":"SEQUEL"}]' /></div></details>
          </> : <details className="admin-editor-section" open><summary>기본 정보</summary><div className="admin-form-grid">{type === 'STUDIO' ? <><Field name="name" label="스튜디오명" /><Field name="officialSiteUrl" label="공식 홈페이지" type="url" /><label className="admin-check-field"><input type="checkbox" checked={isAnimationStudio} onChange={(event) => { setIsAnimationStudio(event.target.checked); markDirty('isAnimationStudio') }} /><span>애니메이션 제작사</span></label></> : <><Field name="nameFull" label="이름" /><Field name="nameNative" label="원어 이름" /><Field name="nameUserPreferred" label="대표 이름" /><Field name="officialSiteUrl" label="공식 홈페이지" type="url" />{type === 'CHARACTER' ? <><Field name="gender" label="성별" /><Field name="age" label="나이" /></> : <Field name="languageV2" label="활동 언어" placeholder="Japanese" />}</>}</div>{type !== 'STUDIO' && <TextArea name="description" label="설명" rows={7} />}</details>}

          <div className="admin-editor-actions"><button className="primary-button" disabled={saveBusy} onClick={() => void save()}>{saveBusy ? '저장 중...' : selectedId ? '변경 저장' : '엔티티 생성'}</button></div>
          {type !== 'STUDIO' && <details className="admin-editor-section"><summary>이미지 및 공개</summary><div className="admin-image-row"><label className="admin-field"><span>이미지 종류</span><select value={variant} onChange={(event) => setVariant(event.target.value)}>{type === 'ANIME' ? <><option value="cover_extra_large">큰 커버</option><option value="cover_large">커버</option><option value="banner">배너</option></> : <><option value="image_large">큰 이미지</option><option value="image_medium">중간 이미지</option></>}</select></label><label className="admin-upload-field"><Upload size={18} /><span>{image?.name || '이미지 파일 선택'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /></label><button className="secondary-button" disabled={!selectedId || !image || saveBusy} onClick={() => void upload()}>S3 업로드</button>{type === 'ANIME' && <button className="primary-button" disabled={!selectedId || saveBusy} onClick={() => void publish()}>커버 확인 후 공개</button>}</div></details>}
          </>}
          {message && <div className="admin-alert is-success"><CheckCircle2 size={18} />{message}</div>}
          {error && <div className="admin-alert is-danger"><CircleAlert size={18} />{error}</div>}
        </section>
      </div>
    </div></CatalogDraftContext.Provider>
  )
}

export function AdminCatalogReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = (['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(searchParams.get('status') ?? '') ? searchParams.get('status') : 'PENDING') as CatalogChangeStatus
  const source = (['USER', 'AI'].includes(searchParams.get('source') ?? '') ? searchParams.get('source') : '') as CatalogChangeSource | ''
  const confidence = (['high', 'medium', 'low'].includes(searchParams.get('confidence') ?? '') ? searchParams.get('confidence') : '') as '' | 'high' | 'medium' | 'low'
  const entityType = (TYPES.includes(searchParams.get('type') as CatalogEntityType) ? searchParams.get('type') : '') as CatalogEntityType | ''
  const [items, setItems] = useState<CatalogSubmission[]>([])
  const [selected, setSelected] = useState<CatalogSubmission | null>(null)
  const [draft, setDraft] = useState('')
  const [duplicateTargetId, setDuplicateTargetId] = useState('')
  const [duplicateCandidates, setDuplicateCandidates] = useState<CatalogSearchItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'status' && !value) next.set('status', 'PENDING')
    setSearchParams(next)
  }
  const load = useCallback(async () => {
    setIsLoading(true); setError(null)
    try {
      const next = await fetchCatalogSubmissions({ status, source: source || undefined, confidence: confidence || undefined, type: entityType || undefined })
      setItems(next); setSelected((current) => current ? next.find((item) => item.id === current.id) ?? null : null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '검토함을 불러오지 못했어요.') } finally { setIsLoading(false) }
  }, [confidence, entityType, source, status])
  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const choose = (item: CatalogSubmission) => { setSelected(item); setDraft(pretty(item.payload)); setDuplicateTargetId(item.targetEntityId ? String(item.targetEntityId) : ''); setDuplicateCandidates([]); setMessage(null); setError(null) }
  const save = async () => {
    if (!selected) return
    try { const next = await updateCatalogSubmission(selected.id, { payload: JSON.parse(draft) }); setSelected(next); setMessage('초안을 저장했습니다.'); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : '저장에 실패했어요.') }
  }
  const approve = async () => {
    if (!selected) return
    try { await updateCatalogSubmission(selected.id, { payload: JSON.parse(draft) }); await approveCatalogSubmission(selected.id); setSelected(null); setDuplicateCandidates([]); setMessage('전체 그래프를 승인했습니다. 작품은 관리자 커버 업로드 후 공개됩니다.'); await load() }
    catch (cause) { const candidates = typeof cause === 'object' && cause && 'candidates' in cause && Array.isArray(cause.candidates) ? cause.candidates as CatalogSearchItem[] : []; setDuplicateCandidates(candidates); setError(cause instanceof Error ? cause.message : '승인에 실패했어요.') }
  }
  const reject = async () => {
    if (!selected) return
    const reason = window.prompt('거절 사유를 입력하세요.')
    if (!reason?.trim()) return
    try { await rejectCatalogSubmission(selected.id, reason); setSelected(null); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : '거절에 실패했어요.') }
  }
  const resolveAsExisting = async () => {
    if (!selected || !Number.isInteger(Number(duplicateTargetId)) || Number(duplicateTargetId) <= 0) return
    try { const next = await updateCatalogSubmission(selected.id, { kind: 'UPDATE_ENTITY', targetEntityId: Number(duplicateTargetId), duplicateResolution: 'USE_EXISTING' }); setSelected(next); setMessage('기존 엔티티 수정 초안으로 전환했습니다.') } catch (cause) { setError(cause instanceof Error ? cause.message : '중복 처리에 실패했어요.') }
  }
  const resolveAsNew = async () => {
    if (!selected) return
    try { const next = await updateCatalogSubmission(selected.id, { kind: 'CREATE_ENTITY', targetEntityId: null, duplicateResolution: 'CREATE_NEW' }); setSelected(next); setMessage('중복 후보를 확인하고 신규 생성하도록 표시했습니다.') } catch (cause) { setError(cause instanceof Error ? cause.message : '중복 처리에 실패했어요.') }
  }

  return (
    <div className="admin-page-stack">
      <PageHeader eyebrow="카탈로그 운영 / 검토함" title="제보 검토" description="사용자와 AI가 제안한 정보를 비교·편집한 뒤 전체 승인합니다." actions={<button className="admin-icon-button" type="button" disabled={isLoading} onClick={() => void load()}><RefreshCw size={17} className={isLoading ? 'is-spinning' : ''} />새로고침</button>} />
      <section className="admin-panel admin-filter-bar">
        <label><span>상태</span><select value={status} onChange={(event) => setFilter('status', event.target.value)}>{['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'].map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label>
        <label><span>출처</span><select value={source} onChange={(event) => setFilter('source', event.target.value)}><option value="">전체</option><option value="USER">사용자</option><option value="AI">AI</option></select></label>
        <label><span>유형</span><select value={entityType} onChange={(event) => setFilter('type', event.target.value)}><option value="">전체</option>{TYPES.map((value) => <option value={value} key={value}>{TYPE_LABELS[value]}</option>)}</select></label>
        <label><span>신뢰도</span><select value={confidence} onChange={(event) => setFilter('confidence', event.target.value)}><option value="">전체</option><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
      </section>
      {error && <div className="admin-alert is-danger"><CircleAlert size={18} />{error}</div>}
      {message && <div className="admin-alert is-success"><CheckCircle2 size={18} />{message}</div>}
      <div className="admin-review-workspace">
        <section className="admin-panel admin-review-list">
          <div className="admin-panel-heading"><h2>요청 목록</h2><strong>{items.length}</strong></div>
          {isLoading ? <div className="admin-empty-state is-compact">검토 요청을 불러오는 중입니다.</div> : items.length === 0 ? <div className="admin-empty-state"><CheckCircle2 size={22} /><strong>조건에 맞는 요청이 없습니다.</strong></div> : <div>{items.map((item) => { const band = item.confidence ? confidenceBand(item.confidence.overall) : null; return <button type="button" className={selected?.id === item.id ? 'is-active' : ''} onClick={() => choose(item)} key={item.id}><span><strong>{item.displayName}</strong><small>{item.source === 'AI' ? 'AI' : item.submitterUsername || '사용자'} · {TYPE_LABELS[item.entityType]} · {formatDateTime(item.createdAt)}</small></span>{band ? <span className={`admin-status-badge is-${band.tone}`}>{band.label} {Math.round(item.confidence!.overall * 100)}%</span> : <StatusBadge status={item.status} />}</button> })}</div>}
        </section>

        <section className="admin-panel admin-review-detail">
          {!selected ? <div className="admin-empty-state"><CheckCircle2 size={24} /><strong>검토할 요청을 선택하세요.</strong><p>제안 값과 승인할 값을 나란히 확인할 수 있습니다.</p></div> : <>
            <div className="admin-review-heading"><div><h2>{selected.displayName}</h2><small>요청 #{selected.id} · {selected.source}</small><p>{selected.description}</p></div><StatusBadge status={selected.status} /></div>
            <div className="admin-review-meta"><span>{TYPE_LABELS[selected.entityType]}</span><span>{selected.kind}</span>{selected.submitterUsername && <span>{selected.submitterUsername}</span>}<a href={selected.sourceUrl} target="_blank" rel="noreferrer">출처 확인 <ExternalLink size={14} /></a></div>
            {selected.confidence && <div className="admin-confidence-grid">{Object.entries(selected.confidence).map(([key, value]) => { const band = confidenceBand(value); return <div key={key}><span>{key}</span><strong>{Math.round(value * 100)}%</strong><i className={`is-${band.tone}`}><span style={{ width: `${value * 100}%` }} /></i></div> })}</div>}
            {selected.warnings.length > 0 && <div className="admin-alert is-warning"><CircleAlert size={18} /><span><strong>수집 경고</strong>{selected.warnings.join(' · ')}</span></div>}
            <div className="admin-review-compare"><section><h3>제안된 값</h3><pre>{pretty(selected.payload)}</pre></section><label><h3>승인할 값</h3><textarea rows={22} value={draft} onChange={(event) => setDraft(event.target.value)} /></label></div>
            {selected.status === 'PENDING' && <>
              {duplicateCandidates.length > 0 && <section className="admin-duplicate-box"><h3>중복 후보</h3>{duplicateCandidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => setDuplicateTargetId(String(candidate.id))}>{candidate.displayName} · ID {candidate.id}</button>)}</section>}
              <div className="admin-duplicate-actions"><label className="admin-field"><span>기존 엔티티 ID</span><input type="number" min="1" value={duplicateTargetId} onChange={(event) => setDuplicateTargetId(event.target.value)} /></label><button className="secondary-button" type="button" onClick={() => void resolveAsExisting()}>기존 항목에 병합</button><button className="secondary-button" type="button" onClick={() => void resolveAsNew()}>신규 생성으로 확정</button></div>
              <div className="admin-editor-actions"><button className="secondary-button is-danger" onClick={() => void reject()}>거절</button><button className="secondary-button" onClick={() => void save()}>초안 저장</button><button className="primary-button" onClick={() => void approve()}>전체 승인</button></div>
            </>}
          </>}
        </section>
      </div>
    </div>
  )
}

function currentSeason(): CatalogDiscoveryRun['season'] {
  const month = new Date().getMonth() + 1
  if (month <= 3) return 'WINTER'
  if (month <= 6) return 'SPRING'
  if (month <= 9) return 'SUMMER'
  return 'FALL'
}

export function AdminCatalogDiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') ?? ''
  const requestedRunId = Number(searchParams.get('run'))
  const [runs, setRuns] = useState<CatalogDiscoveryRun[]>([])
  const [selectedRun, setSelectedRun] = useState<CatalogDiscoveryRun | null>(null)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [season, setSeason] = useState<CatalogDiscoveryRun['season']>(currentSeason)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const visibleRuns = statusFilter ? runs.filter((run) => run.status === statusFilter) : runs

  const inspect = useCallback(async (id: number) => {
    try {
      setSelectedRun(await fetchDiscoveryRun(id))
      if (searchParams.get('run') !== String(id)) {
        const next = new URLSearchParams(searchParams); next.set('run', String(id)); setSearchParams(next, { replace: true })
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '실행 상세를 불러오지 못했어요.') }
  }, [searchParams, setSearchParams])
  const load = useCallback(async () => {
    setIsLoading(true); setError(null)
    try {
      const [nextRuns, nextOverview] = await Promise.all([fetchDiscoveryRuns(), fetchAdminOverview()])
      setRuns(nextRuns); setOverview(nextOverview)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'AI 실행 이력을 불러오지 못했어요.') } finally { setIsLoading(false) }
  }, [])
  useEffect(() => {
    const startupTimer = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => void load(), 10_000)
    return () => { window.clearTimeout(startupTimer); window.clearInterval(timer) }
  }, [load])
  useEffect(() => {
    if (requestedRunId <= 0 || selectedRun?.id === requestedRunId) return
    const timeoutId = window.setTimeout(() => void inspect(requestedRunId), 0)
    return () => window.clearTimeout(timeoutId)
  }, [inspect, requestedRunId, selectedRun?.id])

  const start = async () => {
    try { await createDiscoveryRun({ seasonYear: year, season }); setMessage('AI 분기 수집을 시작했습니다.'); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : '실행을 시작하지 못했어요.') }
  }
  const action = async (kind: 'cancel' | 'retry', id: number) => {
    try { if (kind === 'cancel') await cancelDiscoveryRun(id); else await retryDiscoveryRun(id); await load(); if (selectedRun?.id === id) await inspect(id) } catch (cause) { setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했어요.') }
  }

  return (
    <div className="admin-page-stack">
      <PageHeader eyebrow="카탈로그 운영 / AI 분기 수집" title="AI 분기 수집" description="검색 모델이 나무위키 출처를 탐색하고 gpt-5.6-luna가 검증된 자료를 카탈로그 초안으로 변환합니다." actions={<button className="admin-icon-button" type="button" disabled={isLoading} onClick={() => void load()}><RefreshCw size={17} className={isLoading ? 'is-spinning' : ''} />새로고침</button>} />
      {overview && <section className="admin-discovery-summary"><div><span>다음 정기 실행</span><strong>{formatDateTime(overview.service.discovery.nextSchedule.scheduledAt)}</strong><small>{overview.service.discovery.nextSchedule.phase === 'INITIAL' ? '분기 최초 수집' : '한 달 후 보강 수집'}</small></div><div><span>실행 정책</span><strong>03:00 KST</strong><small>1·2·4·5·7·8·10·11월 1일</small></div><div><span>활성 실행</span><strong>{overview.service.discovery.activeRun ? `#${overview.service.discovery.activeRun.id} ${statusLabel(overview.service.discovery.activeRun.status)}` : '없음'}</strong><small>동시에 하나의 실행만 처리</small></div></section>}
      <section className="admin-panel admin-run-create"><div><h2>수동 실행</h2><p>대상 분기를 지정하면 백그라운드에서 후보 탐색을 시작합니다.</p></div><div className="admin-form-grid"><label className="admin-field"><span>연도</span><input type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label><label className="admin-field"><span>분기</span><select value={season} onChange={(event) => setSeason(event.target.value as CatalogDiscoveryRun['season'])}>{['WINTER', 'SPRING', 'SUMMER', 'FALL'].map((value) => <option key={value}>{value}</option>)}</select></label><button className="primary-button" onClick={() => void start()}><Play size={16} />수집 시작</button></div></section>
      {error && <div className="admin-alert is-danger"><CircleAlert size={18} />{error}</div>}
      {message && <div className="admin-alert is-success"><CheckCircle2 size={18} />{message}</div>}
      <div className="admin-discovery-workspace">
        <section className="admin-panel admin-run-list">
          <div className="admin-panel-heading"><h2>실행 이력</h2><select aria-label="실행 상태 필터" value={statusFilter} onChange={(event) => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set('status', event.target.value); else next.delete('status'); next.delete('run'); setSearchParams(next) }}><option value="">전체 상태</option><option value="failed">실패</option><option value="completed">완료</option><option value="discovering">탐색 중</option><option value="extracting">수집 중</option><option value="canceled">취소</option></select></div>
          {isLoading && runs.length === 0 ? <div className="admin-empty-state is-compact">실행 이력을 불러오는 중입니다.</div> : visibleRuns.length === 0 ? <div className="admin-empty-state is-compact">조건에 맞는 실행이 없습니다.</div> : <div>{visibleRuns.map((run) => { const progress = run.candidateCount ? Math.round(run.processedCount / run.candidateCount * 100) : 0; return <article className={selectedRun?.id === run.id ? 'is-active' : ''} key={run.id}><button type="button" onClick={() => void inspect(run.id)}><span><strong>#{run.id} · {run.seasonYear} {run.season}</strong><small>{formatDateTime(run.createdAt)} · 초안 {run.createdRequestCount} · 실패 {run.failedCount}</small></span><StatusBadge status={run.status} /></button><div className="admin-progress"><span style={{ width: `${progress}%` }} /></div><div className="admin-run-actions"><span>{run.processedCount}/{run.candidateCount} 처리</span>{['queued', 'discovering', 'extracting'].includes(run.status) && <button type="button" onClick={() => void action('cancel', run.id)}>취소</button>}{['failed', 'canceled'].includes(run.status) && <button type="button" onClick={() => void action('retry', run.id)}><RotateCcw size={14} />재시도</button>}</div></article> })}</div>}
        </section>
        <aside className="admin-panel admin-run-detail">{!selectedRun ? <div className="admin-empty-state"><Bot size={24} /><strong>실행을 선택하세요.</strong><p>후보별 처리 상태와 오류를 확인할 수 있습니다.</p></div> : <><div className="admin-review-heading"><div><h2>{selectedRun.seasonYear} {selectedRun.season}</h2><small>실행 #{selectedRun.id} · 탐색 {selectedRun.searchModel} · 초안 {selectedRun.model}</small></div><StatusBadge status={selectedRun.status} /></div>{selectedRun.lastError && <div className="admin-alert is-danger"><CircleAlert size={18} />{selectedRun.lastError}</div>}<dl className="admin-run-stats"><div><dt>후보</dt><dd>{selectedRun.candidateCount}</dd></div><div><dt>처리</dt><dd>{selectedRun.processedCount}</dd></div><div><dt>초안</dt><dd>{selectedRun.createdRequestCount}</dd></div><div><dt>실패</dt><dd>{selectedRun.failedCount}</dd></div></dl><div className="admin-candidate-list">{selectedRun.items?.map((item) => <article key={item.id}><span><strong>{item.displayName}</strong><small>시도 {item.attemptCount}/3{item.lastError ? ` · ${item.lastError}` : ''}</small></span><StatusBadge status={item.status} /></article>)}</div></>}</aside>
      </div>
    </div>
  )
}

export function AdminUsersPage() {
  return <div className="admin-page-stack"><PageHeader eyebrow="사용자 운영" title="사용자 관리" description="계정을 검색하고 컬렉션과 이용 현황을 확인합니다." /><AdminUserManager /></div>
}

export function AdminSafetyPage() {
  return <div className="admin-page-stack"><PageHeader eyebrow="콘텐츠·안전" title="신고 및 노출 관리" description="프로필 신고를 처리하고 작품의 공개 상태를 관리합니다." /><div className="admin-section-stack"><AdminProfileReportManager /><AdminAnimeVisibilityManager /></div></div>
}

export function AdminMaintenancePage() {
  return <div className="admin-page-stack"><PageHeader eyebrow="서비스 / 점검 설정" title="점검 모드" description="사용자에게 표시할 점검 안내와 서비스 접근 상태를 관리합니다." /><section className="admin-panel"><AdminMaintenanceManager /></section></div>
}
