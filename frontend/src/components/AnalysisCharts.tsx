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
  label: string
  value: number
}

type ReleaseYearChartDatum = {
  year: string
  count: number
}

const CHART_COLORS = ['#f59e0b', '#fb7185', '#fbbf24', '#fdba74', '#f97316', '#f43f5e', '#fca5a5', '#fed7aa']

export function GenreDistributionPieChart({ data }: { data: PieDatum[] }) {
  return (
    <div className="analysis-pie-shell">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={66} outerRadius={98} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                  <span>{entry.value.toLocaleString()}편 감상</span>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="analysis-pie-legend">
        {data.map((entry, index) => (
          <div className="analysis-pie-legend-row" key={entry.label}>
            <span className="analysis-pie-swatch" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span>{entry.label}</span>
            <strong>{entry.value}편</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GenreWatchMinutesPieChart({ data }: { data: PieDatum[] }) {
  return (
    <div className="analysis-pie-shell">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={66} outerRadius={98} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                  <span>{formatWatchHours(entry.value)}</span>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="analysis-pie-legend">
        {data.map((entry, index) => (
          <div className="analysis-pie-legend-row" key={entry.label}>
            <span className="analysis-pie-swatch" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span>{entry.label}</span>
            <strong>{formatWatchHours(entry.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReleaseYearBarChart({ data }: { data: ReleaseYearChartDatum[] }) {
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
          <Bar dataKey="count" radius={[12, 12, 6, 6]} fill="url(#analysisYearGradient)" maxBarSize={38} />
          <defs>
            <linearGradient id="analysisYearGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
