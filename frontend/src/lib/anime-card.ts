export type AnimeCardRotation = {
  x: number
  y: number
}

export const ANIME_CARD_DRAG_SENSITIVITY = 0.6

export function getDraggedCardRotation(
  startRotation: AnimeCardRotation,
  deltaX: number,
  deltaY: number,
): AnimeCardRotation {
  return {
    x: startRotation.x - deltaY * ANIME_CARD_DRAG_SENSITIVITY,
    y: startRotation.y + deltaX * ANIME_CARD_DRAG_SENSITIVITY,
  }
}

export function flipAnimeCard(rotation: AnimeCardRotation): AnimeCardRotation {
  return {
    ...rotation,
    y: rotation.y + 180,
  }
}

export function isCardBackVisible(rotation: AnimeCardRotation) {
  const xRadians = rotation.x * Math.PI / 180
  const yRadians = rotation.y * Math.PI / 180
  return Math.cos(xRadians) * Math.cos(yRadians) < 0
}

function snapToTurn(rotation: number, offset = 0) {
  const snapped = Math.round((rotation - offset) / 360) * 360 + offset
  return Object.is(snapped, -0) ? 0 : snapped
}

export function snapAnimeCardRotation(rotation: AnimeCardRotation): AnimeCardRotation {
  const shouldShowBack = isCardBackVisible(rotation)

  return {
    x: snapToTurn(rotation.x),
    y: snapToTurn(rotation.y, shouldShowBack ? 180 : 0),
  }
}
