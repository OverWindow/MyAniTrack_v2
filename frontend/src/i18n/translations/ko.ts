import { enTranslations } from './en'

export const koTranslations: Record<string, string> = Object.fromEntries(
  Object.keys(enTranslations).map((key) => [key, key]),
)
