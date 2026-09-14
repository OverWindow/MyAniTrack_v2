// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  AdminCatalogEntitiesPage, AdminCatalogReviewsPage, AdminDashboardPage, AdminPage,
} from './AdminPage'

const mocks = vi.hoisted(() => ({
  auth: { user: { role: 'ADMIN', isAdmin: true }, isBootstrapping: false } as {
    user: { role: string; isAdmin: boolean } | null; isBootstrapping: boolean
  },
  fetchAdminOverview: vi.fn(),
  fetchCatalogSubmissions: vi.fn(),
  fetchCatalogTaxonomy: vi.fn(),
  fetchCatalogEntity: vi.fn(),
  searchCatalog: vi.fn(),
  writeCatalogEntity: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/admin', () => ({
  approveCatalogSubmission: vi.fn(),
  cancelDiscoveryRun: vi.fn(),
  createDiscoveryRun: vi.fn(),
  fetchAdminOverview: mocks.fetchAdminOverview,
  fetchCatalogEntity: mocks.fetchCatalogEntity,
  fetchCatalogSubmissions: mocks.fetchCatalogSubmissions,
  fetchCatalogTaxonomy: mocks.fetchCatalogTaxonomy,
  fetchDiscoveryRun: vi.fn(),
  fetchDiscoveryRuns: vi.fn().mockResolvedValue([]),
  rejectCatalogSubmission: vi.fn(),
  retryDiscoveryRun: vi.fn(),
  searchCatalog: mocks.searchCatalog,
  updateCatalogSubmission: vi.fn(),
  uploadCatalogEntityImage: vi.fn(),
  writeCatalogEntity: mocks.writeCatalogEntity,
}))

const overview = {
  generatedAt: '2026-09-12T03:00:00.000Z',
  counts: {
    registeredUsers: 42, anime: 120, characters: 300, voiceActors: 180, studios: 24,
    pendingCatalog: 7, pendingUserCatalog: 3, pendingAiCatalog: 4,
    pendingProfileReports: 2, failedDiscoveryRuns: 1,
  },
  service: {
    maintenanceEnabled: false,
    discovery: {
      activeRun: null,
      latestRun: null,
      nextSchedule: { scheduledAt: '2026-09-30T18:00:00.000Z', season: 'FALL', phase: 'INITIAL' },
    },
  },
  recent: { submissions: [], discoveryRuns: [] },
}

function renderAdmin(path: string, child: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="catalog/reviews" element={child} />
          <Route path="catalog/entities" element={child} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('admin console', () => {
  beforeEach(() => {
    mocks.auth.user = { role: 'ADMIN', isAdmin: true }
    mocks.auth.isBootstrapping = false
    mocks.fetchAdminOverview.mockReset().mockResolvedValue(overview)
    mocks.fetchCatalogSubmissions.mockReset().mockResolvedValue([])
    mocks.fetchCatalogTaxonomy.mockReset().mockResolvedValue({
      genres: [{ value: 'Action', usageCount: 12 }, { value: 'Fantasy', usageCount: 8 }],
      tags: [{ value: 'Coming of Age', usageCount: 9 }, { value: 'School', usageCount: 6 }],
    })
    mocks.fetchCatalogEntity.mockReset()
    mocks.searchCatalog.mockReset()
    mocks.writeCatalogEntity.mockReset().mockResolvedValue({ result: { entityId: 91 } })
  })

  afterEach(cleanup)

  it('opens the operational overview at /admin', async () => {
    const { container } = renderAdmin('/admin', <AdminCatalogReviewsPage />)

    expect(await screen.findByRole('heading', { name: '오늘의 운영 현황' })).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    const overviewLink = screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/admin')
    expect(overviewLink).toHaveAttribute('aria-current', 'page')
    expect(mocks.fetchAdminOverview).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('.admin-page-stack > .admin-panel')).toHaveLength(3)
    for (const decoration of ['ATTENTION', 'STATUS', 'CATALOG', 'RECENT']) expect(screen.queryByText(decoration)).not.toBeInTheDocument()
  })

  it('supports a direct review URL and forwards dashboard filters', async () => {
    renderAdmin('/admin/catalog/reviews?status=PENDING&source=AI&type=ANIME', <AdminCatalogReviewsPage />)

    expect(await screen.findByRole('heading', { name: '제보 검토' })).toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchCatalogSubmissions).toHaveBeenCalledWith({
      status: 'PENDING', source: 'AI', confidence: undefined, type: 'ANIME',
    }))
    expect(screen.getByRole('link', { name: /검토함/ })).toHaveAttribute('aria-current', 'page')
  })

  it('closes the mobile navigation with Escape', async () => {
    const { container } = renderAdmin('/admin', <AdminCatalogReviewsPage />)
    await screen.findByRole('heading', { name: '오늘의 운영 현황' })

    fireEvent.click(screen.getByRole('button', { name: '관리자 메뉴 열기' }))
    expect(container.querySelector('#admin-sidebar')).toHaveClass('is-open')
    await waitFor(() => expect(document.activeElement).toHaveAttribute('href', '/admin'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container.querySelector('#admin-sidebar')).not.toHaveClass('is-open')
    await waitFor(() => expect(screen.getByRole('button', { name: '관리자 메뉴 열기' })).toHaveFocus())
  })

  it('blocks non-admin users for every nested admin route', () => {
    mocks.auth.user = { role: 'USER', isAdmin: false }
    renderAdmin('/admin/catalog/reviews', <AdminCatalogReviewsPage />)
    expect(screen.getByRole('heading', { name: '관리자 전용 페이지입니다.' })).toBeInTheDocument()
    expect(mocks.fetchCatalogSubmissions).not.toHaveBeenCalled()
  })

  it.each([
    ['ANIME', '작품', '원본 작품', '원본 작품', {
      titleKorean: '원본 작품', titleEnglish: 'Original Anime', titleRomaji: 'Original Anime', titleNative: '原作', titleUserPreferred: 'Original Anime',
      titleKoreanSubtitle: '부제', description: '작품 설명', episodes: 12, duration: 24, season: 'SPRING', seasonYear: 2026,
      format: 'TV', status: 'FINISHED', source: 'MANGA', countryOfOrigin: 'JP', officialSiteUrl: 'https://example.com/',
      isAdult: false, appVisible: false, genres: ['Action'], tags: [{ name: 'School', rank: 70, isSpoiler: false }], synonyms: ['Alias'],
      studios: [{ studio: { existingId: 3 }, studioName: 'Studio A', isMain: true }],
      cast: [{ character: { existingId: 4 }, characterName: 'Hero', role: 'MAIN', voiceActors: [] }],
      relations: [{ targetAnimeId: 5, relationType: 'SEQUEL', targetTitle: 'Next' }],
    }],
    ['CHARACTER', '캐릭터', '테스트 캐릭터', '테스트 캐릭터', { nameFull: '테스트 캐릭터', nameNative: '人物', nameUserPreferred: '캐릭터', description: '인물 설명', gender: 'Female', age: '17', officialSiteUrl: null }],
    ['VOICE_ACTOR', '성우', '테스트 성우', '테스트 성우', { nameFull: '테스트 성우', nameNative: '声優', nameUserPreferred: '성우', description: '성우 설명', languageV2: 'Japanese', officialSiteUrl: null }],
    ['STUDIO', '스튜디오', '테스트 스튜디오', '테스트 스튜디오', { name: '테스트 스튜디오', officialSiteUrl: 'https://studio.example.com/', isAnimationStudio: true }],
  ] as const)('loads the complete %s source record after selecting a search result', async (type, typeLabel, displayName, fieldValue, payload) => {
    mocks.searchCatalog.mockResolvedValue([{ id: 7, type, displayName, subtitle: null, imageUrl: null }])
    mocks.fetchCatalogEntity.mockResolvedValue({ id: 7, type, displayName, updatedAt: '2026-09-12T00:00:00Z', payload, images: {} })
    renderAdmin(`/admin/catalog/entities?type=${type}`, <AdminCatalogEntitiesPage />)

    fireEvent.change(screen.getByPlaceholderText(`${typeLabel} 검색`), { target: { value: displayName } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(displayName) }))

    expect(await screen.findByDisplayValue(fieldValue)).toBeInTheDocument()
    expect(mocks.fetchCatalogEntity).toHaveBeenCalledWith(type, 7, expect.any(AbortSignal))
    expect(screen.getByText('내부 ID 7 · 변경한 필드만 반영됩니다.')).toBeInTheDocument()
  })

  it('loads a direct entity URL and maps taxonomy selections and image data', async () => {
    mocks.fetchCatalogEntity.mockResolvedValue({
      id: 7, type: 'ANIME', displayName: '직접 진입 작품', updatedAt: '2026-09-12T00:00:00Z',
      payload: { titleKorean: '직접 진입 작품', genres: ['Fantasy'], tags: [{ name: 'School', rank: 50, isSpoiler: true }], synonyms: [], studios: [], cast: [], relations: [], isAdult: false, appVisible: true },
      images: { coverExtraLarge: 'https://images.example.com/cover.webp' },
    })
    renderAdmin('/admin/catalog/entities?type=ANIME&id=7', <AdminCatalogEntitiesPage />)

    expect(await screen.findByDisplayValue('직접 진입 작품')).toBeInTheDocument()
    expect(screen.getByText('Fantasy')).toBeInTheDocument()
    expect(screen.getAllByText('School')).toHaveLength(2)
    expect(screen.getByRole('img', { name: '직접 진입 작품 큰 커버' })).toHaveAttribute('src', 'https://images.example.com/cover.webp')
  })

  it('saves only existing selected genres and structured tag settings', async () => {
    renderAdmin('/admin/catalog/entities?type=ANIME&mode=create', <AdminCatalogEntitiesPage />)
    await waitFor(() => expect(mocks.fetchCatalogTaxonomy).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('한국어 제목'), { target: { value: '새 작품' } })

    fireEvent.click(screen.getByRole('button', { name: '장르 선택' }))
    fireEvent.click(screen.getByRole('option', { name: /Action/ }))
    fireEvent.click(screen.getByRole('button', { name: '태그 선택' }))
    fireEvent.click(screen.getByRole('option', { name: /Coming of Age/ }))
    fireEvent.change(screen.getByLabelText('중요도'), { target: { value: '83' } })
    fireEvent.click(screen.getByLabelText('스포일러'))
    fireEvent.click(screen.getByRole('button', { name: '엔티티 생성' }))

    await waitFor(() => expect(mocks.writeCatalogEntity).toHaveBeenCalledWith('ANIME', expect.objectContaining({
      titleKorean: '새 작품', genres: ['Action'], tags: [{ name: 'Coming of Age', rank: 83, isSpoiler: true }],
    }), undefined))
  })

  it('patches only a changed field and sends an optional text clear as null', async () => {
    mocks.fetchCatalogEntity.mockResolvedValue({
      id: 12, type: 'CHARACTER', displayName: '원본 인물', updatedAt: '2026-09-12T00:00:00Z',
      payload: { nameFull: '원본 인물', nameNative: '人物', nameUserPreferred: '대표 인물', description: '지울 설명', gender: 'Female', age: '17', officialSiteUrl: 'https://example.com/' },
      images: {},
    })
    renderAdmin('/admin/catalog/entities?type=CHARACTER&id=12', <AdminCatalogEntitiesPage />)
    const description = await screen.findByDisplayValue('지울 설명')

    fireEvent.change(description, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '변경 저장' }))

    await waitFor(() => expect(mocks.writeCatalogEntity).toHaveBeenCalledWith('CHARACTER', { description: null }, 12))
  })

  it('saves cleared genre and tag selections as empty arrays', async () => {
    mocks.fetchCatalogEntity.mockResolvedValue({
      id: 13, type: 'ANIME', displayName: '분류 작품', updatedAt: '2026-09-12T00:00:00Z',
      payload: { titleKorean: '분류 작품', genres: ['Action'], tags: [{ name: 'School', rank: 70, isSpoiler: false }], synonyms: [], studios: [], cast: [], relations: [], isAdult: false, appVisible: false },
      images: {},
    })
    renderAdmin('/admin/catalog/entities?type=ANIME&id=13', <AdminCatalogEntitiesPage />)
    await screen.findByDisplayValue('분류 작품')

    fireEvent.click(screen.getByRole('button', { name: 'Action 선택 해제' }))
    fireEvent.click(screen.getByRole('button', { name: 'School 태그 제거' }))
    fireEvent.click(screen.getByRole('button', { name: '변경 저장' }))

    await waitFor(() => expect(mocks.writeCatalogEntity).toHaveBeenCalledWith('ANIME', { genres: [], tags: [] }, 13))
  })

  it('shows an isolated detail error and retries without retaining stale form values', async () => {
    mocks.fetchCatalogEntity
      .mockRejectedValueOnce(new Error('상세 API 오류'))
      .mockResolvedValueOnce({ id: 14, type: 'STUDIO', displayName: '복구 스튜디오', updatedAt: '2026-09-12T00:00:00Z', payload: { name: '복구 스튜디오', officialSiteUrl: null, isAnimationStudio: true }, images: {} })
    renderAdmin('/admin/catalog/entities?type=STUDIO&id=14', <AdminCatalogEntitiesPage />)

    expect(await screen.findByText('상세 API 오류')).toBeInTheDocument()
    expect(screen.queryByLabelText('스튜디오명')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByDisplayValue('복구 스튜디오')).toBeInTheDocument()
  })

  it('keeps only the latest detail when search results are selected rapidly', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    mocks.searchCatalog.mockResolvedValue([
      { id: 21, type: 'CHARACTER', displayName: '첫 번째', subtitle: null, imageUrl: null },
      { id: 22, type: 'CHARACTER', displayName: '두 번째', subtitle: null, imageUrl: null },
    ])
    mocks.fetchCatalogEntity.mockImplementation((_type: string, id: number) => id === 21
      ? new Promise((resolve) => { resolveFirst = resolve })
      : Promise.resolve({ id: 22, type: 'CHARACTER', displayName: '두 번째', updatedAt: '2026-09-12T00:00:00Z', payload: { nameFull: '두 번째', nameNative: null, nameUserPreferred: null, description: null, gender: null, age: null, officialSiteUrl: null }, images: {} }))
    renderAdmin('/admin/catalog/entities?type=CHARACTER', <AdminCatalogEntitiesPage />)
    fireEvent.change(screen.getByPlaceholderText('캐릭터 검색'), { target: { value: '번째' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    fireEvent.click(await screen.findByRole('button', { name: /첫 번째/ }))
    await waitFor(() => expect(mocks.fetchCatalogEntity).toHaveBeenCalledWith('CHARACTER', 21, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: /두 번째/ }))
    expect(await screen.findByDisplayValue('두 번째')).toBeInTheDocument()
    resolveFirst?.({ id: 21, type: 'CHARACTER', displayName: '첫 번째', updatedAt: '2026-09-12T00:00:00Z', payload: { nameFull: '첫 번째' }, images: {} })
    await waitFor(() => expect(screen.queryByDisplayValue('첫 번째')).not.toBeInTheDocument())
  })
})
