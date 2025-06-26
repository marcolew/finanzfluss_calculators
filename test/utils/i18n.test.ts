import { beforeEach, describe, expect, it } from 'vitest'
import {
  fallbackLocale,
  getLocale,
  isValidLocale,
  locales,
  setLocale,
  setMaybeLocale,
} from '../../src/utils/i18n'

describe('i18n', () => {
  beforeEach(() => {
    setLocale('de')
  })

  it('should have a fallback locale', () => {
    expect(fallbackLocale).toBe('de')
  })

  it('should have a current locale', () => {
    expect(getLocale()).toBe('de')
  })

  it('should have a list of locales', () => {
    expect(locales).toMatchInlineSnapshot(`
      [
        "de",
        "fr",
      ]
    `)
  })

  it('should have a function to check if a locale is valid', () => {
    expect(isValidLocale('de')).toBe(true)
    expect(isValidLocale('fr')).toBe(true)
    expect(isValidLocale('en')).toBe(false)
  })

  it('should have a function to set the locale', () => {
    setLocale('fr')
    expect(getLocale()).toBe('fr')
  })

  it('should have a function to set the locale if it is valid', () => {
    setMaybeLocale('fr')
    expect(getLocale()).toBe('fr')
    setMaybeLocale('ko')
    expect(getLocale()).toBe('de')
  })
})
