import { Film, Layers3 } from 'lucide-react'

export type CollectionViewMode = 'anime' | 'series'

type CollectionViewSwitchProps = {
  value: CollectionViewMode
  onChange: (value: CollectionViewMode) => void
}

export function CollectionViewSwitch({ value, onChange }: CollectionViewSwitchProps) {
  return (
    <div
      className="collection-view-switch"
      data-active-view={value}
      role="group"
      aria-label="컬렉션 보기 방식"
    >
      <button
        type="button"
        className={value === 'anime' ? 'is-active' : ''}
        aria-pressed={value === 'anime'}
        onClick={() => onChange('anime')}
      >
        <Film size={17} aria-hidden="true" />
        <span>작품별</span>
      </button>
      <button
        type="button"
        className={value === 'series' ? 'is-active' : ''}
        aria-pressed={value === 'series'}
        onClick={() => onChange('series')}
      >
        <Layers3 size={17} aria-hidden="true" />
        <span>시리즈별</span>
      </button>
    </div>
  )
}
