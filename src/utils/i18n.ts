export const locales = ['de', 'fr'] as const
export const fallbackLocale: Locale = 'de'
export type Locale = (typeof locales)[number]

let currentLocale: Locale = 'de'

export function setLocale(locale: Locale) {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function setMaybeLocale(maybeLocale?: string) {
  currentLocale = isValidLocale(maybeLocale) ? maybeLocale : fallbackLocale
}

export function isValidLocale(maybeLocale?: string): maybeLocale is Locale {
  return locales.includes(maybeLocale as Locale)
}
