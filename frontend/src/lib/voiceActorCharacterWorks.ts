export type VoiceActorCharacterWorkEntry = {
  character: {
    id: number
    name: string
    nativeName?: string | null
    image: string | null
    meta?: string | null
  }
  work: {
    id: number
    title: string
    image: string | null
    label?: string
    meta?: string | null
  }
}

export type VoiceActorCharacterWorkGroup = {
  character: VoiceActorCharacterWorkEntry['character']
  works: VoiceActorCharacterWorkEntry['work'][]
}

export function groupVoiceActorCharacterWorks(entries: VoiceActorCharacterWorkEntry[]) {
  const groups = new Map<number, VoiceActorCharacterWorkGroup>()

  for (const entry of entries) {
    const existing = groups.get(entry.character.id)

    if (!existing) {
      groups.set(entry.character.id, {
        character: entry.character,
        works: [entry.work],
      })
      continue
    }

    if (!existing.works.some((work) => work.id === entry.work.id)) {
      existing.works.push(entry.work)
    }
  }

  return Array.from(groups.values())
}
