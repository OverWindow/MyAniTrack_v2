import { getLocaleTag } from '../i18n'
import { tr } from '../i18n'
type ReleaseDecadeProgressProps = {
  entries: Array<[string, number]>
}

const decadeColors = ['#f59e0b', '#fb7185', '#38bdf8', '#84cc16', '#a78bfa', '#14b8a6', '#f97316']

function getDecadeLabel(year: number) {
  return tr("{{v0}}년대", { v0: Math.floor(year / 10) * 10 })
}

function getShortDecadeLabel(label: string) {
  const decade = Number(label.slice(0, 4))

  if (!Number.isFinite(decade)) {
    return label
  }

  const shortYear = decade % 100
  return tr("{{v0}}년대", { v0: shortYear.toString().padStart(2, '0') })
}

export function ReleaseDecadeProgress({ entries }: ReleaseDecadeProgressProps) {
  const decadeEntries = entries.reduce<Record<string, number>>((acc, [yearLabel, count]) => {
    const year = Number(yearLabel)

    if (!Number.isInteger(year)) {
      return acc
    }

    const label = getDecadeLabel(year)
    acc[label] = (acc[label] ?? 0) + count
    return acc
  }, {})

  const totalCount = Object.values(decadeEntries).reduce((sum, count) => sum + count, 0)
  const sortedEntries = Object.entries(decadeEntries).sort(([left], [right]) => Number(left.slice(0, 4)) - Number(right.slice(0, 4)))

  if (totalCount <= 0 || sortedEntries.length === 0) {
    return null
  }

  return (
      <div className="release-decade-panel">
        <div className="release-decade-heading">
        <strong>{tr("세대별 작품 비중")}</strong>
        <span>{tr("총")} {totalCount.toLocaleString(getLocaleTag())}{tr("편")}</span>
      </div>

      <div className="release-decade-bar" aria-label={tr("10년대별 작품 수 비중")}>
        {sortedEntries.map(([label, count], index) => {
          const percent = (count / totalCount) * 100

          return (
            <span
              key={label}
              style={{
                width: `${percent}%`,
                background: decadeColors[index % decadeColors.length],
              }}
              title={tr("{{v0}} 작품 수: {{v1}}, {{v2}}%", { v0: label, v1: count.toLocaleString(getLocaleTag()), v2: percent.toFixed(1) })}
            >
              {percent >= 11 ? getShortDecadeLabel(label) : ''}
            </span>
          )
        })}
      </div>

      <div className="release-decade-list">
        {sortedEntries.map(([label, count], index) => {
          const percent = (count / totalCount) * 100

          return (
            <div className="release-decade-item" key={label}>
              <span style={{ background: decadeColors[index % decadeColors.length] }} />
              <strong>{label}: {percent.toFixed(1)}%</strong>
              <small>({count.toLocaleString(getLocaleTag())}{tr("편)")}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}
