import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatWatchHours } from '../lib/stats'

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

const CHART_COLORS = ['#f59e0b', '#fb7185', '#fbbf24', '#fdba74', '#f97316', '#f43f5e', '#fca5a5', '#fed7aa']
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
