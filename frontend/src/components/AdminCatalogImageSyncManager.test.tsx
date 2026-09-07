// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogImageSyncSnapshot } from '../types/admin'
import { AdminCatalogImageSyncManager } from './AdminCatalogImageSyncManager'
import {
  fetchCatalogImageSyncStatus,
  startCatalogImageSync,
} from '../lib/admin'

vi.mock('../lib/admin', () => ({
  fetchCatalogImageSyncStatus: vi.fn(),
  startCatalogImageSync: vi.fn(),
  pauseCatalogImageSync: vi.fn(),
  resumeCatalogImageSync: vi.fn(),
  retryFailedCatalogImageSync: vi.fn(),
}))

const emptySnapshot: CatalogImageSyncSnapshot = {
  job: null,
  queue: { total: 102525, pending: 102525, syncing: 0, succeeded: 0, failed: 0 },
  recentFailures: [],
}

const runningSnapshot: CatalogImageSyncSnapshot = {
  job: {
    id: 7,
    scope: 'all',
    mode: 'pending',
    triggerType: 'admin',
    targetProvider: 's3',
    status: 'running',
    totalAssets: 102525,
    processedAssets: 1025,
    succeededAssets: 1025,
    failedAssets: 0,
    pendingAssets: 101496,
    syncingAssets: 4,
    skippedAssets: 0,
    lastError: null,
    currentAsset: { id: 2, entityType: 'anime', entityId: 1, anilistId: 42, variant: 'cover_large' },
    startedAt: '2026-09-07T00:00:00.000Z',
    finishedAt: null,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
  },
  queue: { total: 102525, pending: 101496, syncing: 4, succeeded: 1025, failed: 0 },
  recentFailures: [],
}

describe('AdminCatalogImageSyncManager', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('loads queue totals and starts a persistent sync job', async () => {
    vi.mocked(fetchCatalogImageSyncStatus).mockResolvedValue(emptySnapshot)
    vi.mocked(startCatalogImageSync).mockResolvedValue(runningSnapshot)

    render(<AdminCatalogImageSyncManager />)

    await waitFor(() => expect(screen.getAllByText('102,525')).toHaveLength(2))
    expect(screen.getByText('AWS S3 + CloudFront')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '미처리 이미지 동기화' }))

    await waitFor(() => expect(startCatalogImageSync).toHaveBeenCalledWith('pending'))
    expect(await screen.findByText('실행 중')).toBeInTheDocument()
    expect(screen.getByText(/AniList 42/)).toBeInTheDocument()
  })
})
