import { useEffect } from 'react'
import { getTitleLanguage } from '../i18n'

type DocumentMetadata = {
  title: string
  description: string
  canonicalPath: string
  robots?: string
}

function getOrCreateMeta(name: string) {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)

  if (existing) {
    return { element: existing, created: false }
  }

  const element = document.createElement('meta')
  element.name = name
  document.head.appendChild(element)
  return { element, created: true }
}

export function useDocumentMetadata({
  title,
  description,
  canonicalPath,
  robots = 'index, follow',
}: DocumentMetadata) {
  useEffect(() => {
    const previousTitle = document.title
    const previousLanguage = document.documentElement.lang
    const descriptionMeta = getOrCreateMeta('description')
    const robotsMeta = getOrCreateMeta('robots')
    const existingCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canonical = existingCanonical ?? document.createElement('link')
    const previousDescription = descriptionMeta.element.content
    const previousRobots = robotsMeta.element.content
    const previousCanonical = existingCanonical?.href ?? null

    if (!existingCanonical) {
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }

    document.title = title
    document.documentElement.lang = getTitleLanguage()
    descriptionMeta.element.content = description
    robotsMeta.element.content = robots
    canonical.href = new URL(canonicalPath, window.location.origin).toString()

    return () => {
      document.title = previousTitle
      document.documentElement.lang = previousLanguage

      if (descriptionMeta.created) {
        descriptionMeta.element.remove()
      } else {
        descriptionMeta.element.content = previousDescription
      }

      if (robotsMeta.created) {
        robotsMeta.element.remove()
      } else {
        robotsMeta.element.content = previousRobots
      }

      if (existingCanonical && previousCanonical) {
        existingCanonical.href = previousCanonical
      } else {
        canonical.remove()
      }
    }
  }, [canonicalPath, description, robots, title])
}
