import { canonicalLocality } from '@/engine'

/**
 * One key per city, however the geocoder or a poster spells it:
 * "Tiranë", "Bashkia Tiranë" and "Tirana" are all `tirana`; "München" and
 * "Mynihu" are `munich`. Canonical names come from the engine's locality
 * list; unknown places pass through as a plain slug of their own name.
 */
export function citySlugFromText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

/** Canonical display name for a city ("Bashkia Durrës" → "Durrës"). */
export function canonicalCityName(name: string): string {
  return canonicalLocality(name)?.name ?? name.trim()
}

/** The AlbaGo location_slug for a city name. */
export function citySlug(name: string): string {
  return citySlugFromText(canonicalCityName(name))
}
