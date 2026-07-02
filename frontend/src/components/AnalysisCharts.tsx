import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { formatWatchHours, getGenreLabel } from '../lib/stats'
import type { GenreBubbleItem } from '../types/stats'

type PieDatum = {
  key: string
  label: string
  value: number
}

type ReleaseYearChartDatum = {
  year: string
  count: number
}

type ScoreDistributionChartDatum = {
  score: string
  label: string
  count: number
}

type NormalizedGenreBubbleItem = GenreBubbleItem & {
  normalizedCommunityAverage: number
  normalizedMyAverage: number
  displayCommunityAverage: number
  displayMyAverage: number
  hasCompressedValue: boolean
}

const CHART_COLORS = ['#f59e0b', '#fb7185', '#fbbf24', '#fdba74', '#f97316', '#f43f5e', '#fca5a5', '#fed7aa']
const BUBBLE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#4f46e5',
  '#65a30d',
  '#be123c',
  '#0d9488',
  '#7c3aed',
]
const RADIAN = Math.PI / 180

type PieLabelProps = {
  cx?: number | string
  cy?: number | string
  midAngle?: number
  outerRadius?: number | string
  payload?: PieDatum
}

function toNumber(value: number | string | undefined, fallback: number) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numericValue) ? numericValue : fallback
}

function getSharedNormalizedBubbleDomain(values: number[]) {
  if (values.length === 0) {
    return [-1, 1] as [number, number]
  }

  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const spread = max - min
  const padding = spread === 0 ? 0.18 : Math.max(0.03, spread * 0.04)

  return [min - padding, max + padding] as [number, number]
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function createBubbleCompression(values: number[]) {
  const absoluteValues = values.map((value) => Math.abs(value)).filter((value) => Number.isFinite(value))

  if (absoluteValues.length === 0) {
    return {
      hasCompression: false,
      displayDomain: [-1, 1] as [number, number],
      transform: (value: number) => value,
      formatTick: (value: number) => value.toFixed(1),
      isCompressedValue: (_value: number) => false,
    }
  }

  const sortedValues = [...absoluteValues].sort((left, right) => left - right)
  const maxValue = Math.max(sortedValues[sortedValues.length - 1] ?? 0, 0.4)
  const upperQuartile = sortedValues[Math.floor((sortedValues.length - 1) * 0.75)] ?? maxValue
  const breakStart = Math.max(0.35, upperQuartile)
  const hasCompression = maxValue > breakStart * 1.65 && maxValue - breakStart > 0.25
  const compressedMax = hasCompression
    ? breakStart + Math.max(0.22, (maxValue - breakStart) * 0.38)
    : maxValue
  const padding = compressedMax * 0.08

  const transform = (value: number) => {
    if (!hasCompression || Math.abs(value) <= breakStart) {
      return value
    }

    const sign = Math.sign(value)
    const overflow = Math.abs(value) - breakStart
    const totalOverflow = Math.max(maxValue - breakStart, 0.001)
    const compressedOverflow = Math.log1p(overflow) / Math.log1p(totalOverflow) * (compressedMax - breakStart)

    return sign * (breakStart + compressedOverflow)
  }

  const invert = (value: number) => {
    if (!hasCompression || Math.abs(value) <= breakStart) {
      return value
    }

    const sign = Math.sign(value)
    const overflow = Math.abs(value) - breakStart
    const compressedSpan = Math.max(compressedMax - breakStart, 0.001)
    const totalOverflow = Math.max(maxValue - breakStart, 0.001)
    const originalOverflow = Math.expm1((overflow / compressedSpan) * Math.log1p(totalOverflow))

    return sign * (breakStart + originalOverflow)
  }

  const isCompressedValue = (value: number) => hasCompression && Math.abs(value) > breakStart

  return {
    hasCompression,
    displayDomain: [-(compressedMax + padding), compressedMax + padding] as [number, number],
    transform,
    formatTick: (value: number) => {
      const originalValue = invert(value)
      const prefix = isCompressedValue(originalValue) ? '≈' : ''
      const sign = originalValue > 0 ? '+' : ''

      return `${prefix}${sign}${originalValue.toFixed(1)}`
    },
    isCompressedValue,
  }
}

function getBubbleLabel(label: string) {
  const genreLabel = getGenreLabel(label)

  return genreLabel.length > 8 ? `${genreLabel.slice(0, 7)}...` : genreLabel
}

function renderBubbleShape(props: {
  cx?: number | string
  cy?: number | string
  size?: number
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  payload?: NormalizedGenreBubbleItem
}) {
  const { payload } = props

  if (!payload) {
    return null
  }

  const centerX = toNumber(props.cx, 0)
  const centerY = toNumber(props.cy, 0)
  const radius = Math.max(22, Math.sqrt((props.size ?? 900) / Math.PI))
  const fontSize = Math.max(11, Math.min(15, radius * 0.42))

  return (
    <g className="analysis-bubble-point">
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill={props.fill}
        fillOpacity={props.fillOpacity ?? 0.86}
        stroke={props.stroke ?? '#ffffff'}
        strokeWidth={props.strokeWidth ?? 2}
      />
      <text
        className="analysis-bubble-point-label"
        x={centerX}
        y={centerY}
        style={{ fontSize }}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {getBubbleLabel(payload.genre)}
      </text>
    </g>
  )
}

function renderPieLabel(formatValue: (value: number) => string) {
  return ({ cx, cy, midAngle, outerRadius, payload }: PieLabelProps) => {
    if (!payload || midAngle === undefined) {
      return null
    }

    const centerX = toNumber(cx, 0)
    const centerY = toNumber(cy, 0)
    const radius = toNumber(outerRadius, 98) + 22
    const x = centerX + radius * Math.cos(-midAngle * RADIAN)
    const y = centerY + radius * Math.sin(-midAngle * RADIAN)
    const textAnchor = x >= centerX ? 'start' : 'end'

    return (
      <text className="analysis-pie-slice-label" x={x} y={y} textAnchor={textAnchor} dominantBaseline="central">
        <tspan x={x} dy="-0.35em">{payload.label}</tspan>
        <tspan x={x} dy="1.25em">{formatValue(payload.value)}</tspan>
      </text>
    )
  }
}

function AnalysisGenrePieChart({
  data,
  selectedKey,
  onSelectGenre,
  formatTooltipValue,
  formatLabelValue,
}: {
  data: PieDatum[]
  selectedKey?: string | null
  onSelectGenre?: (genre: string) => void
  formatTooltipValue: (value: number) => string
  formatLabelValue: (value: number) => string
}) {
  return (
    <div className="analysis-pie-shell">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart margin={{ top: 12, right: 74, bottom: 12, left: 74 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            label={renderPieLabel(formatLabelValue)}
            labelLine={false}
            cursor={onSelectGenre ? 'pointer' : 'default'}
            onClick={(entry) => {
              const payload = (entry as { payload?: PieDatum }).payload ?? (entry as unknown as PieDatum)

              if (payload.key) {
                onSelectGenre?.(payload.key)
              }
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry.label}-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                stroke={selectedKey === entry.key ? '#292524' : '#fff7ed'}
                strokeWidth={selectedKey === entry.key ? 3 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const entry = payload[0]?.payload as PieDatum

              return (
                <div className="analysis-chart-tooltip">
                  <strong>{entry.label}</strong>
                  <span>{formatTooltipValue(entry.value)}</span>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GenreDistributionPieChart({
  data,
  selectedKey,
  onSelectGenre,
}: {
  data: PieDatum[]
  selectedKey?: string | null
  onSelectGenre?: (genre: string) => void
}) {
  return (
    <AnalysisGenrePieChart
      data={data}
      selectedKey={selectedKey}
      onSelectGenre={onSelectGenre}
      formatTooltipValue={(value) => `${value.toLocaleString()}편 감상`}
      formatLabelValue={(value) => `${value.toLocaleString()}편`}
    />
  )
}

export function GenreWatchMinutesPieChart({
  data,
  selectedKey,
  onSelectGenre,
}: {
  data: PieDatum[]
  selectedKey?: string | null
  onSelectGenre?: (genre: string) => void
}) {
  return (
    <AnalysisGenrePieChart
      data={data}
      selectedKey={selectedKey}
      onSelectGenre={onSelectGenre}
      formatTooltipValue={formatWatchHours}
      formatLabelValue={formatWatchHours}
    />
  )
}

export function ReleaseYearBarChart({
  data,
  selectedYear,
  onSelectYear,
}: {
  data: ReleaseYearChartDatum[]
  selectedYear?: string | null
  onSelectYear?: (year: string) => void
}) {
  return (
    <div className="analysis-year-chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
          <CartesianGrid stroke="rgba(120, 113, 108, 0.12)" vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            width={32}
          />
          <Tooltip
            cursor={{ fill: 'rgba(251, 191, 36, 0.10)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const value = payload[0]?.value
              const count = typeof value === 'number' ? value : Number(value ?? 0)

              return (
                <div className="analysis-chart-tooltip">
                  <strong>{label}년</strong>
                  <span>{count.toLocaleString()}편 감상</span>
                </div>
              )
            }}
          />
          <Bar
            dataKey="count"
            radius={[12, 12, 6, 6]}
            fill="url(#analysisYearGradient)"
            maxBarSize={38}
            cursor={onSelectYear ? 'pointer' : 'default'}
            onClick={(entry) => {
              const payload = (entry as { payload?: ReleaseYearChartDatum }).payload
              const year = typeof payload?.year === 'string' ? payload.year : null

              if (year) {
                onSelectYear?.(year)
              }
            }}
          >
            {data.map((entry) => (
              <Cell
                key={`year-bar-${entry.year}`}
                fill={selectedYear === entry.year ? 'url(#analysisYearSelectedGradient)' : 'url(#analysisYearGradient)'}
              />
            ))}
          </Bar>
          <defs>
            <linearGradient id="analysisYearGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="analysisYearSelectedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScoreDistributionBarChart({
  data,
  selectedScore,
  onSelectScore,
}: {
  data: ScoreDistributionChartDatum[]
  selectedScore?: string | null
  onSelectScore?: (score: string) => void
}) {
  return (
    <div className="analysis-year-chart-shell analysis-score-chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
          <CartesianGrid stroke="rgba(120, 113, 108, 0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            width={32}
          />
          <Tooltip
            cursor={{ fill: 'rgba(251, 191, 36, 0.10)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const value = payload[0]?.value
              const count = typeof value === 'number' ? value : Number(value ?? 0)

              return (
                <div className="analysis-chart-tooltip">
                  <strong>{label}</strong>
                  <span>{count.toLocaleString()}편</span>
                </div>
              )
            }}
          />
          <Bar
            dataKey="count"
            radius={[12, 12, 6, 6]}
            fill="url(#analysisScoreGradient)"
            maxBarSize={42}
            cursor={onSelectScore ? 'pointer' : 'default'}
            onClick={(entry) => {
              const payload = (entry as { payload?: ScoreDistributionChartDatum }).payload
              const score = typeof payload?.score === 'string' ? payload.score : null

              if (score) {
                onSelectScore?.(score)
              }
            }}
          >
            {data.map((entry) => (
              <Cell
                key={`score-bar-${entry.score}`}
                fill={selectedScore === entry.score ? 'url(#analysisScoreSelectedGradient)' : 'url(#analysisScoreGradient)'}
              />
            ))}
          </Bar>
          <defs>
            <linearGradient id="analysisScoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="analysisScoreSelectedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GenrePreferenceBubbleChart({ data }: { data: GenreBubbleItem[] }) {
  const myAverageBaseline = getAverage(data.map((entry) => entry.myAverageScore))
  const communityAverageBaseline = getAverage(data.map((entry) => entry.communityAverageScore))
  const baseNormalizedData = data.map((entry) => {
    const normalizedCommunityAverage = entry.communityAverageScore - communityAverageBaseline
    const normalizedMyAverage = entry.myAverageScore - myAverageBaseline

    return {
      ...entry,
      normalizedCommunityAverage,
      normalizedMyAverage,
    }
  })
  const compression = createBubbleCompression(
    baseNormalizedData.flatMap((entry) => [entry.normalizedCommunityAverage, entry.normalizedMyAverage]),
  )
  const normalizedData: NormalizedGenreBubbleItem[] = baseNormalizedData.map((entry) => ({
    ...entry,
    displayCommunityAverage: compression.transform(entry.normalizedCommunityAverage),
    displayMyAverage: compression.transform(entry.normalizedMyAverage),
    hasCompressedValue:
      compression.isCompressedValue(entry.normalizedCommunityAverage) ||
      compression.isCompressedValue(entry.normalizedMyAverage),
  }))
  const sharedDomain = compression.hasCompression
    ? compression.displayDomain
    : getSharedNormalizedBubbleDomain(
        normalizedData.flatMap((entry) => [entry.displayCommunityAverage, entry.displayMyAverage]),
      )
  const equalityLine: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: sharedDomain[0], y: sharedDomain[0] },
    { x: sharedDomain[1], y: sharedDomain[1] },
  ]

  return (
    <div className="analysis-bubble-chart-shell">
      <div className="analysis-bubble-corner-guide is-top-left">
        <strong>내 취향이 더 강함</strong>
        <span>커뮤니티보다 내가 더 좋아하는 장르</span>
      </div>
      <div className="analysis-bubble-corner-guide is-bottom-right">
        <strong>대중 평가 우세</strong>
        <span>대중 평가는 높지만 내 취향은 덜한 장르</span>
      </div>
      <ResponsiveContainer width="100%" height={470}>
        <ScatterChart margin={{ top: 32, right: 38, bottom: 46, left: 18 }}>
          <CartesianGrid stroke="rgba(120, 113, 108, 0.12)" />
          <XAxis
            type="number"
            dataKey="displayCommunityAverage"
            name="커뮤니티 평균 대비"
            domain={sharedDomain}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            tickFormatter={(value) => {
              return compression.formatTick(Number(value))
            }}
            label={{
              value: '커뮤니티 평균 대비',
              position: 'insideBottom',
              offset: -26,
              fill: '#57534e',
              fontSize: 12,
              fontWeight: 800,
            }}
          />
          <YAxis
            type="number"
            dataKey="displayMyAverage"
            name="내 평균 대비"
            domain={sharedDomain}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            tickFormatter={(value) => {
              return compression.formatTick(Number(value))
            }}
            width={52}
            label={{
              value: '내 평균 대비',
              angle: -90,
              position: 'insideLeft',
              fill: '#57534e',
              fontSize: 12,
              fontWeight: 800,
            }}
          />
          <ZAxis type="number" dataKey="bubbleSize" range={[900, 3600]} />
          <ReferenceLine
            segment={equalityLine}
            stroke="#44403c"
            strokeDasharray="6 6"
            strokeOpacity={0.44}
            ifOverflow="extendDomain"
          />
          <Tooltip
            cursor={{ strokeDasharray: '4 4', stroke: 'rgba(120, 113, 108, 0.26)' }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const entry = payload[0]?.payload as NormalizedGenreBubbleItem
              const topAnime = entry.topRatedAnime?.[0]

              return (
                <div className="analysis-chart-tooltip analysis-bubble-tooltip">
                  <strong>{getGenreLabel(entry.genre)}</strong>
                  <span>내 평균 대비 {entry.normalizedMyAverage >= 0 ? '+' : ''}{entry.normalizedMyAverage.toFixed(2)}</span>
                  <span>커뮤니티 평균 대비 {entry.normalizedCommunityAverage >= 0 ? '+' : ''}{entry.normalizedCommunityAverage.toFixed(2)}</span>
                  {entry.hasCompressedValue && <span>≈ 축에서 압축 표시된 아웃라이어</span>}
                  <span>내 평균 {entry.myAverageScore.toFixed(2)}점</span>
                  <span>커뮤니티 평균 {entry.communityAverageScore.toFixed(2)}점</span>
                  <span>차이 {entry.preferenceScore >= 0 ? '+' : ''}{entry.preferenceScore.toFixed(2)}</span>
                  <span>시청 작품 {entry.animeCount.toLocaleString()}편</span>
                  <span>총 시청시간 {formatWatchHours(entry.totalWatchMinutes)}</span>
                  {topAnime?.title && <span>가장 높게 평가한 작품 {topAnime.title}</span>}
                </div>
              )
            }}
          />
          <Scatter data={normalizedData} name="장르 취향" shape={renderBubbleShape}>
            {normalizedData.map((entry, index) => (
              <Cell
                key={`genre-bubble-${entry.genre}`}
                fill={BUBBLE_COLORS[index % BUBBLE_COLORS.length]}
                fillOpacity={0.86}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {compression.hasCompression && (
        <div className="analysis-bubble-compression-note">≈ 표시는 아웃라이어를 물결 구간으로 압축한 값</div>
      )}
    </div>
  )
}
