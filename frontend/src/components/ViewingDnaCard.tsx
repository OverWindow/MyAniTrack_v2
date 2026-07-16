import { lazy, Suspense } from 'react'
import { formatUpdatedAt } from '../lib/stats'
import { getViewingDnaAxisDescription, SERIES_COMPLETION_EXCLUSION_NOTE } from '../lib/viewingDna'
import type { ViewingDnaItem } from '../types/stats'

const ViewingDnaRadarChart = lazy(async () => {
  const module = await import('./AnalysisCharts')
  return { default: module.ViewingDnaRadarChart }
})

const confidenceLabels: Record<ViewingDnaItem['confidence'], string> = {
  none: '표본 없음',
  low: '표본 적음',
  medium: '신뢰도 보통',
  high: '신뢰도 높음',
}

type ViewingDnaCardProps = {
  item: ViewingDnaItem | null
  isLoading: boolean
  error: string | null
  isGuestPreview?: boolean
}

export function ViewingDnaCard({ item, isLoading, error, isGuestPreview = false }: ViewingDnaCardProps) {
  const strongestAxis = item?.axes.find((axis) => axis.key === item.strongestAxis && axis.available) ?? null
  const hasLowConfidence = item?.confidence === 'none' || item?.confidence === 'low'

  return (
    <section className="analysis-panel analysis-viewing-dna-panel">
      <div className="analysis-panel-heading analysis-viewing-dna-heading">
        <div>
          <span className="detail-label">Viewing DNA</span>
          <h2>나의 감상 DNA</h2>
          <p>여섯 가지 감상 성향을 100점 척도로 비교해요. 점수는 우열이 아닌 감상 패턴을 뜻해요.</p>
        </div>
        {item && (
          <span className={`analysis-viewing-dna-confidence is-${item.confidence}`}>
            {confidenceLabels[item.confidence]}
          </span>
        )}
      </div>

      {isGuestPreview && (
        <div className="analysis-empty analysis-viewing-dna-empty">
          로그인하면 내 감상 기록으로 만든 DNA 분석을 볼 수 있어요.
        </div>
      )}
      {!isGuestPreview && isLoading && <div className="analysis-chart-skeleton analysis-viewing-dna-skeleton" />}
      {!isGuestPreview && !isLoading && error && <div className="analysis-empty">{error}</div>}
      {!isGuestPreview && !isLoading && !error && !item && (
        <div className="analysis-empty">아직 감상 DNA 분석 데이터가 없어요.</div>
      )}

      {!isGuestPreview && !isLoading && !error && item && (
        <>
          {hasLowConfidence && (
            <p className="analysis-viewing-dna-notice">
              감상 기록이 적어 일부 축의 정확도가 낮을 수 있어요. 기록이 쌓이면 분석도 더 선명해져요.
            </p>
          )}
          <div className="analysis-viewing-dna-layout">
            <Suspense fallback={<div className="analysis-chart-skeleton analysis-viewing-dna-skeleton" />}>
              <ViewingDnaRadarChart item={item} />
            </Suspense>
            <div className="analysis-viewing-dna-details">
              {strongestAxis && (
                <article className="analysis-viewing-dna-strongest">
                  <span>가장 선명한 성향</span>
                  <div>
                    <strong>{strongestAxis.label}</strong>
                    <b>{strongestAxis.score.toFixed(1)}점</b>
                  </div>
                  <p>{getViewingDnaAxisDescription(strongestAxis)}</p>
                </article>
              )}
              <div className="analysis-viewing-dna-axis-list">
                {item.axes.map((axis) => (
                  <article
                    className={`analysis-viewing-dna-axis${axis.key === item.strongestAxis ? ' is-strongest' : ''}${axis.available ? '' : ' is-unavailable'}`}
                    key={axis.key}
                  >
                    <div>
                      <strong>{axis.label}</strong>
                      <b>{axis.available ? `${axis.score.toFixed(1)}점` : '0점 · 데이터 부족'}</b>
                    </div>
                    <p>{axis.available ? getViewingDnaAxisDescription(axis) : '데이터가 아직 부족해요.'}</p>
                    {axis.key === 'seriesCompletion' && axis.available && (
                      <small className="analysis-viewing-dna-axis-note">
                        {SERIES_COMPLETION_EXCLUSION_NOTE}
                      </small>
                    )}
                  </article>
                ))}
              </div>
              <small className="analysis-viewing-dna-meta">
                {formatUpdatedAt(item.calculatedAt)} 계산 · 분석 방식 v{item.methodologyVersion}
              </small>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
