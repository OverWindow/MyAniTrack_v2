import { describe, expect, it } from 'vitest'
import {
  ANIME_CARD_DRAG_SENSITIVITY,
  flipAnimeCard,
  getDraggedCardRotation,
  isCardBackVisible,
  snapAnimeCardRotation,
} from './anime-card'

describe('anime detail free 3D card rotation', () => {
  it('maps horizontal and vertical drag distance to cumulative Y and X rotation', () => {
    expect(getDraggedCardRotation({ x: 12, y: -30 }, 100, -50)).toEqual({
      x: 12 + 50 * ANIME_CARD_DRAG_SENSITIVITY,
      y: -30 + 100 * ANIME_CARD_DRAG_SENSITIVITY,
    })
  })

  it('keeps the exact freely dragged angle without snapping it', () => {
    expect(getDraggedCardRotation({ x: 0, y: 0 }, 137, 83)).toEqual({
      x: -49.8,
      y: 82.2,
    })
  })

  it('flips 180 degrees around Y while preserving the current X rotation', () => {
    expect(flipAnimeCard({ x: -42, y: 95 })).toEqual({ x: -42, y: 275 })
  })

  it('detects the visible face across both rotation axes and full turns', () => {
    expect(isCardBackVisible({ x: 0, y: 180 })).toBe(true)
    expect(isCardBackVisible({ x: 180, y: 0 })).toBe(true)
    expect(isCardBackVisible({ x: 180, y: 180 })).toBe(false)
    expect(isCardBackVisible({ x: 360, y: 540 })).toBe(true)
  })

  it('snaps the visible face upright when the pointer is released', () => {
    expect(snapAnimeCardRotation({ x: -66, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(snapAnimeCardRotation({ x: 170, y: 5 })).toEqual({ x: 0, y: 180 })
    expect(snapAnimeCardRotation({ x: 175, y: 190 })).toEqual({ x: 0, y: 360 })
  })

  it('preserves completed turns while snapping to the nearest matching face', () => {
    expect(snapAnimeCardRotation({ x: 725, y: 548 })).toEqual({ x: 720, y: 540 })
  })
})
