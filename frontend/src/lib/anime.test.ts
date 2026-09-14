// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getLocalizedAnimeTitle } from './anime'

const KOREAN_TITLE = String.fromCodePoint(0xd55c, 0xad6d, 0xc5b4, 0x20, 0xc81c, 0xbaa9)

const anime = {
  title: 'Server title',
  titles: {
    korean: KOREAN_TITLE,
    english: 'English Title',
    romaji: 'Romaji Title',
    userPreferred: 'Preferred Title',
    native: '原題',
  },
}

describe('getLocalizedAnimeTitle', () => {
  it('selects Korean and English titles for the active display language', () => {
    expect(getLocalizedAnimeTitle(anime, 'ko')).toBe(KOREAN_TITLE)
    expect(getLocalizedAnimeTitle(anime, 'en')).toBe('English Title')
  })

  it('uses romanized and non-Korean fallbacks before Korean in English', () => {
    expect(getLocalizedAnimeTitle({
      ...anime,
      titles: { ...anime.titles, english: null },
    }, 'en')).toBe('Romaji Title')

    expect(getLocalizedAnimeTitle({
      title: null,
      titles: {
        korean: KOREAN_TITLE,
        english: null,
        romaji: null,
        userPreferred: null,
        native: '原題',
      },
    }, 'en')).toBe('原題')
  })

  it('uses Korean only after every non-Korean fallback is unavailable', () => {
    expect(getLocalizedAnimeTitle({
      title: 'Server title',
      titles: { korean: KOREAN_TITLE },
    }, 'en')).toBe(KOREAN_TITLE)
  })
})
