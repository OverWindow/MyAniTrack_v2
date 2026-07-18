import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import { RecapSceneCard } from '../components/RecapSceneCard'
import { useAuth } from '../contexts/AuthContext'
import { getFriendlyErrorMessage } from '../lib/errors'
import { fetchRecapData, getRecapAnimeTitle, getRecapImageUrl, getRecapScenes, prepareRecapAssets } from '../lib/recap'
import type { RecapAssetMap, RecapData, RecapFavoriteSelection, RecapPlaybackMode, RecapSceneKey, RecapTheme } from '../types/recap'
import '../styles/pages/RecapPage.css'

const AUTO_PLAY_MS = 4000
const MAX_FAVORITES = 3
const themes: Array<{ value: RecapTheme; label: string; description: string }> = [
  { value: 'peach', label: '피치', description: '따뜻하고 선명한 코랄 톤' },
  { value: 'lilac', label: '라일락', description: '몽환적인 보랏빛 톤' },
  { value: 'mint', label: '민트', description: '맑고 차분한 그린 톤' },
]

function triggerDownload(href: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

function getFilename(index: number, key: RecapSceneKey) {
  return `myanitrack-recap-${String(index + 1).padStart(2, '0')}-${key}.png`
}

export function RecapPage() {
  const { user, isAuthenticated, isBootstrapping } = useAuth()
  const [data, setData] = useState<RecapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<'setup' | 'preview'>('setup')
  const [theme, setTheme] = useState<RecapTheme>('peach')
  const [selectedFavorites, setSelectedFavorites] = useState<RecapFavoriteSelection>([])
  const [mode, setMode] = useState<RecapPlaybackMode>('story')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [assets, setAssets] = useState<RecapAssetMap>({})
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const sceneRefs = useRef<Partial<Record<RecapSceneKey, HTMLElement | null>>>({})
  const pointerStartX = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const selectedFavoriteItems = useMemo(
    () => data?.favorites.filter((favorite) => selectedFavorites.includes(favorite.id)) ?? [],
    [data?.favorites, selectedFavorites],
  )
  const scenes = useMemo(() => getRecapScenes(selectedFavoriteItems.length > 0), [selectedFavoriteItems.length])
  const currentScene = scenes[Math.min(currentIndex, scenes.length - 1)]

  const loadData = useCallback(async () => {
    if (!user) {
      return
    }

    await Promise.resolve()
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)

    try {
      const nextData = await fetchRecapData(user, controller.signal)

      if (controller.signal.aborted) {
        return
      }

      setData(nextData)
      setSelectedFavorites(nextData.favorites.slice(0, MAX_FAVORITES).map((favorite) => favorite.id))
      setAssets({})
      void prepareRecapAssets(nextData).then((nextAssets) => {
        if (!controller.signal.aborted) {
          setAssets(nextAssets)
        }
      })
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return
      }

      setError(getFriendlyErrorMessage(loadError, '리캡 데이터를 불러오지 못했어요.'))
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      abortRef.current?.abort()
    }
  }, [isAuthenticated, loadData, user])

  useEffect(() => {
    if (mode !== 'auto' || !isPlaying || stage !== 'preview') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentIndex((index) => {
        if (index >= scenes.length - 1) {
          setIsPlaying(false)
          return index
        }

        return index + 1
      })
    }, AUTO_PLAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [currentIndex, isPlaying, mode, scenes.length, stage])

  const goPrevious = useCallback(() => {
    setCurrentIndex((index) => Math.max(0, index - 1))
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex((index) => Math.min(scenes.length - 1, index + 1))
  }, [scenes.length])

  useEffect(() => {
    if (stage !== 'preview') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goPrevious()
      }

      if (event.key === 'ArrowRight') {
        goNext()
      }

      if (event.key === ' ' && mode === 'auto') {
        event.preventDefault()
        setIsPlaying((playing) => !playing)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious, mode, stage])

  const toggleFavorite = (favoriteId: number) => {
    setSelectedFavorites((current) => {
      if (current.includes(favoriteId)) {
        return current.filter((id) => id !== favoriteId)
      }

      if (current.length >= MAX_FAVORITES) {
        setExportMessage('최애 애니는 최대 3편까지 선택할 수 있어요.')
        return current
      }

      setExportMessage(null)
      return [...current, favoriteId]
    })
  }

  const ensureAssets = async () => {
    if (!data) {
      return
    }

    const expectedUrls = [data.user.profileImageUrl, ...data.favorites.map(getRecapImageUrl)].filter(Boolean)
    const hasAllAssets = expectedUrls.every((url) => Object.prototype.hasOwnProperty.call(assets, String(url)))

    if (!hasAllAssets) {
      setExportMessage('이미지를 준비하고 있어요...')
      setAssets(await prepareRecapAssets(data))
      await waitForPaint()
    }
  }

  const renderScenePng = async (sceneKey: RecapSceneKey) => {
    const node = sceneRefs.current[sceneKey]

    if (!node) {
      throw new Error('저장할 장면을 찾지 못했어요.')
    }

    return toPng(node, {
      width: 1080,
      height: 1920,
      canvasWidth: 1080,
      canvasHeight: 1920,
      pixelRatio: 1,
      cacheBust: true,
    })
  }

  const exportCurrent = async () => {
    if (!currentScene || isExporting) {
      return
    }

    setIsExporting(true)
    setExportMessage('현재 장면을 준비하고 있어요...')

    try {
      await ensureAssets()
      await waitForPaint()
      const dataUrl = await renderScenePng(currentScene.key)
      triggerDownload(dataUrl, getFilename(currentIndex, currentScene.key))
      setExportMessage('현재 장면을 PNG로 저장했어요.')
    } catch (exportError) {
      setExportMessage(getFriendlyErrorMessage(exportError, 'PNG를 만들지 못했어요.'))
    } finally {
      setIsExporting(false)
    }
  }

  const exportAll = async () => {
    if (isExporting) {
      return
    }

    setIsExporting(true)

    try {
      await ensureAssets()
      await waitForPaint()
      const zip = new JSZip()

      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index]
        setExportMessage(`${index + 1}/${scenes.length} 장면을 만들고 있어요...`)
        const dataUrl = await renderScenePng(scene.key)
        zip.file(getFilename(index, scene.key), dataUrl.split(',')[1], { base64: true })
      }

      setExportMessage('ZIP 파일을 묶고 있어요...')
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      triggerDownload(url, 'myanitrack-anime-recap.zip')
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportMessage(`${scenes.length}장의 리캡을 모두 저장했어요.`)
    } catch (exportError) {
      setExportMessage(getFriendlyErrorMessage(exportError, '전체 리캡을 만들지 못했어요.'))
    } finally {
      setIsExporting(false)
    }
  }

  if (isBootstrapping || (isAuthenticated && isLoading)) {
    return (
      <section className="recap-page recap-loading" aria-label="리캡 불러오는 중">
        <div className="recap-loading-card"><span /><strong>나만의 애니 리캡을 준비하고 있어요</strong></div>
      </section>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="recap-page recap-gate">
        <span>MY ANIME RECAP</span>
        <h1>로그인하고 내 취향을<br />스토리로 만들어보세요</h1>
        <p>컬렉션과 분석 기록을 바탕으로 인스타 스토리용 리캡을 만들어요.</p>
        <div><Link className="primary-button" to="/login">로그인</Link><Link className="secondary-button" to="/signup">회원가입</Link></div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="recap-page recap-gate">
        <span>RECAP ERROR</span>
        <h1>리캡을 준비하지 못했어요</h1>
        <p>{error}</p>
        <button className="primary-button" type="button" onClick={() => { void loadData() }}>다시 시도</button>
      </section>
    )
  }

  return (
    <section className="recap-page">
      <header className="recap-page-header">
        <div>
          <span className="detail-label">My anime recap</span>
          <h1>내 애니 취향 리캡</h1>
          <p>설정하고, 스토리처럼 감상한 뒤 1080×1920 이미지로 저장하세요.</p>
        </div>
        <ol aria-label="리캡 제작 단계">
          <li className={stage === 'setup' ? 'is-active' : 'is-complete'}><span>1</span>설정</li>
          <li className={stage === 'preview' ? 'is-active' : ''}><span>2</span>미리보기·저장</li>
        </ol>
      </header>

      {stage === 'setup' ? (
        <div className="recap-setup-layout">
          <div className="recap-setup-options">
            <section className="recap-setup-section">
              <div className="recap-setup-heading"><span>01</span><div><h2>분위기를 골라주세요</h2><p>선택한 색상은 모든 장면에 일관되게 적용돼요.</p></div></div>
              <div className="recap-theme-grid">
                {themes.map((option) => (
                  <button
                    key={option.value}
                    className={theme === option.value ? 'recap-theme-option is-selected' : 'recap-theme-option'}
                    data-theme={option.value}
                    type="button"
                    aria-pressed={theme === option.value}
                    onClick={() => setTheme(option.value)}
                  >
                    <i><span /><span /><span /></i><strong>{option.label}</strong><small>{option.description}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="recap-setup-section">
              <div className="recap-setup-heading"><span>02</span><div><h2>최애 애니를 선택하세요</h2><p>10점 작품 중 최대 3편 · 현재 {selectedFavorites.length}/3편</p></div></div>
              {data.favorites.length > 0 ? (
                <div className="recap-favorite-picker">
                  {data.favorites.map((favorite) => {
                    const isSelected = selectedFavorites.includes(favorite.id)
                    return (
                      <button
                        className={isSelected ? 'recap-favorite-choice is-selected' : 'recap-favorite-choice'}
                        key={favorite.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleFavorite(favorite.id)}
                      >
                        {getRecapImageUrl(favorite) ? (
                          <img src={getRecapImageUrl(favorite) ?? undefined} alt="" />
                        ) : (
                          <i className="recap-favorite-choice-placeholder" aria-hidden="true">
                            {getRecapAnimeTitle(favorite).slice(0, 1)}
                          </i>
                        )}
                        <span><strong>{getRecapAnimeTitle(favorite)}</strong><small>{isSelected ? '리캡에 포함됨' : '선택하기'}</small></span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="recap-no-favorites">아직 10점 작품이 없어요. 최애 장면을 제외한 6장 리캡으로 만들게요.</div>
              )}
            </section>

            {exportMessage && <p className="recap-inline-message" role="status">{exportMessage}</p>}
            <button
              className="primary-button recap-preview-button"
              type="button"
              onClick={() => {
                setCurrentIndex(0)
                setStage('preview')
                setExportMessage(null)
              }}
            >
              {scenes.length}장 리캡 미리보기
            </button>
          </div>

          <div className="recap-setup-preview" aria-label="선택한 테마 미리보기">
            <RecapSceneCard scene={getRecapScenes(false)[0]} data={data} favorites={selectedFavoriteItems} theme={theme} assets={assets} />
          </div>
        </div>
      ) : (
        <div className="recap-preview-layout">
          <div className="recap-preview-toolbar">
            <button className="secondary-button" type="button" onClick={() => { setStage('setup'); setIsPlaying(false) }}>설정 바꾸기</button>
            <div className="recap-mode-switch" aria-label="재생 방식">
              <button type="button" className={mode === 'story' ? 'is-active' : ''} onClick={() => { setMode('story'); setIsPlaying(false) }}>스토리</button>
              <button type="button" className={mode === 'auto' ? 'is-active' : ''} onClick={() => { setMode('auto'); setIsPlaying(true) }}>자동 재생</button>
            </div>
            {mode === 'auto' && (
              <div className="recap-playback-actions">
                <button type="button" onClick={() => setIsPlaying((playing) => !playing)}>{isPlaying ? '일시정지' : '재생'}</button>
                <button type="button" onClick={() => { setCurrentIndex(0); setIsPlaying(true) }}>처음부터</button>
              </div>
            )}
          </div>

          <div className="recap-story-shell">
            <div className="recap-story-progress" aria-label={`${currentIndex + 1}/${scenes.length} 장면`}>
              {scenes.map((scene, index) => (
                <span className={index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : ''} key={scene.key}>
                  <i style={index === currentIndex && mode === 'auto' && isPlaying ? { animationDuration: `${AUTO_PLAY_MS}ms` } : undefined} />
                </span>
              ))}
            </div>
            <div
              className="recap-story-stage"
              onPointerDown={(event) => { pointerStartX.current = event.clientX }}
              onPointerUp={(event) => {
                if (pointerStartX.current === null) return
                const delta = event.clientX - pointerStartX.current
                if (Math.abs(delta) > 45) {
                  if (delta > 0) {
                    goPrevious()
                  } else {
                    goNext()
                  }
                }
                pointerStartX.current = null
              }}
            >
              {currentScene && <RecapSceneCard scene={currentScene} data={data} favorites={selectedFavoriteItems} theme={theme} assets={assets} />}
              <button className="recap-tap-zone is-previous" type="button" onClick={goPrevious} disabled={currentIndex === 0} aria-label="이전 장면" />
              <button className="recap-tap-zone is-next" type="button" onClick={goNext} disabled={currentIndex === scenes.length - 1} aria-label="다음 장면" />
            </div>
            <div className="recap-scene-caption"><strong>{currentScene?.label}</strong><span>{currentIndex + 1} / {scenes.length}</span></div>
          </div>

          <aside className="recap-export-panel">
            <span className="detail-label">Ready to share</span>
            <h2>인스타 스토리에 올려보세요</h2>
            <p>현재 장면을 PNG로 받거나 전체 장면을 ZIP으로 한 번에 저장할 수 있어요.</p>
            <div>
              <button className="secondary-button" type="button" disabled={isExporting} onClick={() => { void exportCurrent() }}>현재 장 PNG</button>
              <button className="primary-button" type="button" disabled={isExporting} onClick={() => { void exportAll() }}>전체 PNG ZIP</button>
            </div>
            {exportMessage && <p className="recap-export-message" role="status">{exportMessage}</p>}
            <small>1080×1920 · 무음 · 마지막 장에만 MyAniTrack 표시</small>
          </aside>
        </div>
      )}

      <div className="recap-export-deck" aria-hidden="true">
        {scenes.map((scene) => (
          <div key={scene.key} ref={(node) => { sceneRefs.current[scene.key] = node }}>
            <RecapSceneCard scene={scene} data={data} favorites={selectedFavoriteItems} theme={theme} assets={assets} exportMode />
          </div>
        ))}
      </div>
    </section>
  )
}
