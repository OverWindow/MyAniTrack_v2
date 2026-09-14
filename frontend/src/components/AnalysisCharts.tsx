import { getLocaleTag } from '../i18n'
import { tr } from '../i18n'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { genreOptions } from '../lib/anime'
import { formatWatchHours, getGenreLabel } from '../lib/stats'
import { getViewingDnaAxisDescription, SERIES_COMPLETION_EXCLUSION_NOTE } from '../lib/viewingDna'
import type { FormatDistributionItem, GenreBubbleItem, ViewingDnaItem, YearlyScoreStatsItem } from '../types/stats'

type PieDatum = {
  key: string
  label: string
  value: number
  count?: number
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

type YearlyScoreChartDatum = YearlyScoreStatsItem

const VIEWING_DNA_RAW_LABELS: Record<string, string> = {
  startedAnimeCount: tr("감상 시작 작품"),
  completedAnimeCount: tr("완주 작품"),
  watchedSeriesCount: tr("완주를 시작한 시리즈"),
  completedSeriesCount: tr("필수 작품 완주 시리즈"),
  distinctGenreCount: tr("감상 장르"),
  maximumGenreCount: tr("전체 장르"),
  distinctEraCount: tr("감상 시대 구간"),
  maximumEraCount: tr("전체 시대 구간"),
  ratedAnimeCount: tr("평가 작품"),
  totalWatchMinutes: tr("총 시청 분"),
  totalWatchHours: tr("총 시청 시간"),
  communityUserCount: tr("비교 사용자"),
}

type NormalizedGenreBubbleItem = GenreBubbleItem & {
  normalizedCommunityAverage: number
  normalizedMyAverage: number
  displayCommunityAverage: number
  displayMyAverage: number
  hasCompressedValue: boolean
}

const CHART_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#7c3aed',
  '#ca8a04',
  '#0f766e',
  '#be123c',
]
const GENRE_COLOR_MAP = new Map<string, string>(genreOptions.map((option, index) => [
  option.value,
  CHART_COLORS[index % CHART_COLORS.length],
]))
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
const FORMAT_COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#db2777', '#65a30d']
const FORMAT_COLOR_MAP = new Map<string, string>([
  ['TV', '#2563eb'],
  ['TV_SHORT', '#60a5fa'],
  ['MOVIE', '#f59e0b'],
  ['OVA', '#16a34a'],
  ['ONA', '#9333ea'],
  ['SPECIAL', '#dc2626'],
  ['MUSIC', '#0891b2'],
])
const OTHER_FORMAT_COLOR = '#a8a29e'
const MIN_FORMAT_PERCENT = 5
const RADIAN = Math.PI / 180

type FormatPieMetric = 'count' | 'watchTime'

type FormatPieDatum = {
  format: string
  label: string
  value: number
  percentage: number
  animeCount: number
  watchMinutes: number
  averageScore: number | null
  isOther?: boolean
}

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
      isCompressedValue: () => false,
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

function formatPercent(value: number, total: number) {
  if (total <= 0) {
    return '0%'
  }

  const percent = value / total * 100

  return percent >= 10 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`
}

function formatAnimeCount(count?: number) {
  return tr("{{v0}}편", { v0: Math.max(0, count ?? 0).toLocaleString(getLocaleTag()) })
}

function getGenreColor(key: string, index: number) {
  return GENRE_COLOR_MAP.get(key) ?? CHART_COLORS[index % CHART_COLORS.length]
}

function renderPieLabel(total: number) {
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
        <tspan x={x} dy="1.25em">{formatPercent(payload.value, total)} · {formatAnimeCount(payload.count ?? payload.value)}</tspan>
      </text>
    )
  }
}

function AnalysisGenrePieChart({
  data,
  selectedKey,
  onSelectGenre,
  formatTooltipValue,
}: {
  data: PieDatum[]
  selectedKey?: string | null
  onSelectGenre?: (genre: string) => void
  formatTooltipValue: (value: number) => string
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <div className="analysis-pie-shell">
      <ResponsiveContainer width="100%" height={230}>
        <PieChart margin={{ top: 12, right: 74, bottom: 12, left: 74 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            label={renderPieLabel(total)}
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
                fill={getGenreColor(entry.key, index)}
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
                  <span>{formatTooltipValue(entry.value)} · {formatPercent(entry.value, total)}</span>
                  <span>{tr("작품")} {formatAnimeCount(entry.count ?? entry.value)}</span>
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
      formatTooltipValue={(value) => tr("{{v0}}편 감상", { v0: value.toLocaleString(getLocaleTag()) })}
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
    />
  )
}

export function FormatDistributionPieChart({
  data,
}: {
  data: FormatDistributionItem[]
}) {
  const countData = getFormatPieData(data, 'count')
  const watchTimeData = getFormatPieData(data, 'watchTime')

  return (
    <div className="analysis-format-chart-grid">
      <FormatMetricPieChart title={tr("작품 수 기준")} data={countData} metric="count" />
      <FormatMetricPieChart title={tr("시청 시간 기준")} data={watchTimeData} metric="watchTime" />
    </div>
  )
}

function getFormatColor(format: string, index: number) {
  if (format === 'OTHER') {
    return OTHER_FORMAT_COLOR
  }

  return FORMAT_COLOR_MAP.get(format) ?? FORMAT_COLORS[index % FORMAT_COLORS.length]
}

function getFormatPieData(data: FormatDistributionItem[], metric: FormatPieMetric) {
  const total = data.reduce((sum, entry) => sum + (metric === 'count' ? entry.animeCount : entry.watchMinutes), 0)

  if (total <= 0) {
    return [] as FormatPieDatum[]
  }

  const normalized = data.map((entry): FormatPieDatum => {
    const value = metric === 'count' ? entry.animeCount : entry.watchMinutes

    return {
      format: entry.format,
      label: entry.label,
      value,
      percentage: value / total * 100,
      animeCount: entry.animeCount,
      watchMinutes: entry.watchMinutes,
      averageScore: entry.averageScore,
    }
  })

  const visible = normalized.filter((entry) => entry.percentage >= MIN_FORMAT_PERCENT)
  const small = normalized.filter((entry) => entry.percentage < MIN_FORMAT_PERCENT)

  if (small.length === 0) {
    return normalized
  }

  const otherValue = small.reduce((sum, entry) => sum + entry.value, 0)
  const otherAnimeCount = small.reduce((sum, entry) => sum + entry.animeCount, 0)
  const otherWatchMinutes = small.reduce((sum, entry) => sum + entry.watchMinutes, 0)
  const weightedScoreSum = small.reduce(
    (sum, entry) => sum + (entry.averageScore !== null ? entry.averageScore * entry.animeCount : 0),
    0,
  )
  const ratedCount = small.reduce((sum, entry) => sum + (entry.averageScore !== null ? entry.animeCount : 0), 0)

  return [
    ...visible,
    {
      format: 'OTHER',
      label: tr("기타"),
      value: otherValue,
      percentage: otherValue / total * 100,
      animeCount: otherAnimeCount,
      watchMinutes: otherWatchMinutes,
      averageScore: ratedCount > 0 ? weightedScoreSum / ratedCount : null,
      isOther: true,
    },
  ].sort((left, right) => right.value - left.value)
}

function FormatMetricPieChart({
  title,
  data,
  metric,
}: {
  title: string
  data: FormatPieDatum[]
  metric: FormatPieMetric
}) {
  return (
    <div className="analysis-format-chart-shell">
      <strong>{title}</strong>
      <ResponsiveContainer width="100%" height={210}>
        <PieChart margin={{ top: 12, right: 78, bottom: 12, left: 78 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={86}
            paddingAngle={2}
            label={({ cx, cy, midAngle, outerRadius, payload }: PieLabelProps & { payload?: FormatPieDatum }) => {
              if (!payload || midAngle === undefined) {
                return null
              }

              const centerX = toNumber(cx, 0)
              const centerY = toNumber(cy, 0)
              const radius = toNumber(outerRadius, 86) + 22
              const x = centerX + radius * Math.cos(-midAngle * RADIAN)
              const y = centerY + radius * Math.sin(-midAngle * RADIAN)
              const textAnchor = x >= centerX ? 'start' : 'end'
              const detail = metric === 'count'
                ? tr("{{v0}}편", { v0: payload.animeCount.toLocaleString(getLocaleTag()) })
                : formatWatchHours(payload.watchMinutes)

              return (
                <text className="analysis-pie-slice-label" x={x} y={y} textAnchor={textAnchor} dominantBaseline="central">
                  <tspan x={x} dy="-0.35em">{payload.label}</tspan>
                  <tspan x={x} dy="1.25em">{payload.percentage.toFixed(1)}% · {detail}</tspan>
                </text>
              )
            }}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${metric}-${entry.format}`}
                fill={getFormatColor(entry.format, index)}
                stroke="#fff7ed"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const entry = payload[0]?.payload as FormatPieDatum

              return (
                <div className="analysis-chart-tooltip">
                  <strong>{entry.label}</strong>
                  <span>{metric === 'count' ? tr("작품 수") : tr("시청 시간")} {tr("비중")} {entry.percentage.toFixed(1)}%</span>
                  <span>{tr("작품")} {entry.animeCount.toLocaleString(getLocaleTag())}{tr("편")}</span>
                  <span>{tr("시청 시간")} {formatWatchHours(entry.watchMinutes)}</span>
                  <span>{tr("평균")} {entry.averageScore !== null ? tr("{{v0}}점", { v0: entry.averageScore.toFixed(1) }) : tr("평점 없음")}</span>
                  {entry.isOther && <span>{tr("작은 비중의 포맷을 묶었어요.")}</span>}
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ViewingDnaRadarChart({ item }: { item: ViewingDnaItem }) {
  const chartData = item.axes.map((axis) => ({
    ...axis,
    subject: axis.label,
    value: axis.available ? axis.score : 0,
    fullMark: item.scale.max,
  }))

  return (
    <div
      className="analysis-viewing-dna-chart"
      role="img"
      aria-label={tr("감상 DNA 육각형 차트. {{v0}}", { v0: chartData.map((axis) => `${axis.subject} ${axis.value}점`).join(', ') })}
    >
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid gridType="polygon" stroke="rgba(120, 113, 108, 0.22)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#57534e', fontSize: 12, fontWeight: 800 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[item.scale.min, item.scale.max]}
            tickCount={5}
            tick={{ fill: '#a8a29e', fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name={tr("감상 DNA")}
            dataKey="value"
            stroke="#d97706"
            strokeWidth={3}
            fill="#fbbf24"
            fillOpacity={0.3}
            dot={{ r: 4, fill: '#f59e0b', stroke: '#fff7ed', strokeWidth: 2 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const axis = payload[0]?.payload as (typeof chartData)[number]

              return (
                <div className="analysis-chart-tooltip analysis-viewing-dna-tooltip">
                  <strong>{axis.subject} · {axis.value.toFixed(1)}{tr("점")}</strong>
                  <span>{axis.available ? getViewingDnaAxisDescription(axis) : tr("데이터가 아직 부족해요.")}</span>
                  {axis.key === 'seriesCompletion' && axis.available && (
                    <span>{SERIES_COMPLETION_EXCLUSION_NOTE}</span>
                  )}
                  {Object.entries(axis.raw).map(([key, value]) => (
                    <span key={key}>
                      {VIEWING_DNA_RAW_LABELS[key] ?? key} {Number(value).toLocaleString(getLocaleTag())}
                    </span>
                  ))}
                </div>
              )
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
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
      <ResponsiveContainer width="100%" height={240}>
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
                  <strong>{label}{tr("년")}</strong>
                  <span>{count.toLocaleString(getLocaleTag())}{tr("편 감상")}</span>
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
      <ResponsiveContainer width="100%" height={240}>
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
                  <span>{count.toLocaleString(getLocaleTag())}{tr("편")}</span>
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

export function YearlyScoreLineChart({
  data,
  selectedYear,
  onSelectYear,
}: {
  data: YearlyScoreChartDatum[]
  selectedYear?: string | null
  onSelectYear?: (year: string) => void
}) {
  return (
    <div className="analysis-year-score-chart-shell">
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 18, right: 18, left: -8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(120, 113, 108, 0.12)" vertical={false} />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
          />
          <YAxis
            yAxisId="score"
            domain={[0, 10]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            width={36}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            width={38}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(120, 113, 108, 0.28)', strokeDasharray: '4 4' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) {
                return null
              }

              const entry = payload[0]?.payload as YearlyScoreChartDatum
              const formatScore = (value?: number | null) => (
                typeof value === 'number' ? tr("{{v0}}점", { v0: value.toFixed(2) }) : tr("정보 없음")
              )

              return (
                <div className="analysis-chart-tooltip">
                  <strong>{label}{tr("년")}</strong>
                  <span>{tr("내 평균")} {formatScore(entry.averageScore)}</span>
                  <span>{tr("커뮤니티 평균")} {formatScore(entry.communityAverageScore)}</span>
                  <span>{tr("차이")} {typeof entry.preferenceDelta === 'number' ? tr("{{v0}}{{v1}}점", { v0: entry.preferenceDelta >= 0 ? '+' : '', v1: entry.preferenceDelta.toFixed(2) }) : tr("정보 없음")}</span>
                  <span>{tr("감상")} {entry.animeCount.toLocaleString(getLocaleTag())}{tr("편 / 평가")} {entry.ratedAnimeCount.toLocaleString(getLocaleTag())}{tr("편")}</span>
                </div>
              )
            }}
          />
          <Bar
            yAxisId="count"
            dataKey="animeCount"
            name={tr("감상 작품 수")}
            radius={[10, 10, 4, 4]}
            maxBarSize={34}
            cursor={onSelectYear ? 'pointer' : 'default'}
            onClick={(entry) => {
              const payload = (entry as { payload?: YearlyScoreChartDatum }).payload

              if (payload?.year) {
                onSelectYear?.(String(payload.year))
              }
            }}
          >
            {data.map((entry) => (
              <Cell
                key={`year-score-count-${entry.year}`}
                fill={selectedYear === String(entry.year) ? 'rgba(251, 191, 36, 0.48)' : 'rgba(251, 191, 36, 0.24)'}
              />
            ))}
          </Bar>
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="averageScore"
            name={tr("내 평균")}
            stroke="#f59e0b"
            strokeWidth={3}
            dot={{ r: 4, fill: '#f59e0b', stroke: '#fff7ed', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            connectNulls
            onClick={(entry) => {
              const payload = (entry as { payload?: YearlyScoreChartDatum }).payload

              if (payload?.year) {
                onSelectYear?.(String(payload.year))
              }
            }}
          />
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="communityAverageScore"
            name={tr("커뮤니티 평균")}
            stroke="#2563eb"
            strokeWidth={2.5}
            strokeDasharray="6 5"
            dot={{ r: 3.5, fill: '#2563eb', stroke: '#eff6ff', strokeWidth: 2 }}
            connectNulls
            onClick={(entry) => {
              const payload = (entry as { payload?: YearlyScoreChartDatum }).payload

              if (payload?.year) {
                onSelectYear?.(String(payload.year))
              }
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="analysis-year-score-legend">
        <span><i className="is-count" />{tr("감상 작품 수")}</span>
        <span><i className="is-mine" />{tr("내 평균")}</span>
        <span><i className="is-community" />{tr("커뮤니티 평균")}</span>
      </div>
    </div>
  )
}

export function GenrePreferenceBubbleChart({
  data,
  selectedGenre,
  onSelectGenre,
}: {
  data: GenreBubbleItem[]
  selectedGenre?: string | null
  onSelectGenre?: (genre: string) => void
}) {
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
        <strong>{tr("내 취향이 더 강함")}</strong>
        <span>{tr("커뮤니티보다 내가 더 좋아하는 장르")}</span>
      </div>
      <div className="analysis-bubble-corner-guide is-bottom-right">
        <strong>{tr("대중 평가 우세")}</strong>
        <span>{tr("대중 평가는 높지만 내 취향은 덜한 장르")}</span>
      </div>
      <ResponsiveContainer width="100%" height={470}>
        <ScatterChart margin={{ top: 32, right: 38, bottom: 46, left: 18 }}>
          <CartesianGrid stroke="rgba(120, 113, 108, 0.12)" />
          <XAxis
            type="number"
            dataKey="displayCommunityAverage"
            name={tr("커뮤니티 평균 대비")}
            domain={sharedDomain}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            tickFormatter={(value) => {
              return compression.formatTick(Number(value))
            }}
            label={{
              value: tr("커뮤니티 평균 대비"),
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
            name={tr("내 평균 대비")}
            domain={sharedDomain}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#78716c', fontSize: 12 }}
            tickFormatter={(value) => {
              return compression.formatTick(Number(value))
            }}
            width={52}
            label={{
              value: tr("내 평균 대비"),
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
                  <span>{tr("내 평균 대비")} {entry.normalizedMyAverage >= 0 ? '+' : ''}{entry.normalizedMyAverage.toFixed(2)}</span>
                  <span>{tr("커뮤니티 평균 대비")} {entry.normalizedCommunityAverage >= 0 ? '+' : ''}{entry.normalizedCommunityAverage.toFixed(2)}</span>
                  {entry.hasCompressedValue && <span>{tr("≈ 축에서 압축 표시된 아웃라이어")}</span>}
                  <span>{tr("내 평균")} {entry.myAverageScore.toFixed(2)}{tr("점")}</span>
                  <span>{tr("커뮤니티 평균")} {entry.communityAverageScore.toFixed(2)}{tr("점")}</span>
                  <span>{tr("차이")} {entry.preferenceScore >= 0 ? '+' : ''}{entry.preferenceScore.toFixed(2)}</span>
                  <span>{tr("시청 작품")} {entry.animeCount.toLocaleString(getLocaleTag())}{tr("편")}</span>
                  <span>{tr("총 시청시간")} {formatWatchHours(entry.totalWatchMinutes)}</span>
                  {topAnime?.title && <span>{tr("가장 높게 평가한 작품")} {topAnime.title}</span>}
                </div>
              )
            }}
          />
          <Scatter
            data={normalizedData}
            name={tr("장르 취향")}
            shape={renderBubbleShape}
            cursor={onSelectGenre ? 'pointer' : 'default'}
            onClick={(entry) => {
              const payload =
                (entry as { payload?: NormalizedGenreBubbleItem }).payload ??
                (entry as unknown as NormalizedGenreBubbleItem)

              if (payload?.genre) {
                onSelectGenre?.(payload.genre)
              }
            }}
          >
            {normalizedData.map((entry, index) => (
              <Cell
                key={`genre-bubble-${entry.genre}`}
                fill={BUBBLE_COLORS[index % BUBBLE_COLORS.length]}
                fillOpacity={0.86}
                stroke={selectedGenre === entry.genre ? '#292524' : '#ffffff'}
                strokeWidth={selectedGenre === entry.genre ? 3 : 2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {compression.hasCompression && (
        <div className="analysis-bubble-compression-note">{tr("≈ 표시는 아웃라이어를 물결 구간으로 압축한 값")}</div>
      )}
    </div>
  )
}
