export type PlacardLanguage = 'sq' | 'en' | 'de'

export type PlacardCategory =
  | 'flamingo-revolution'
  | 'vjosa-narta'
  | 'diaspora'
  | 'korrupsioni'
  | 'satire'
  | 'short'
  | 'powerful'

export type Placard = {
  id: string
  slogan: string
  language: PlacardLanguage
  categories: PlacardCategory[]
  city?: string
  submittedAt: string
}

export const PLACARD_LANGUAGE_LABELS: Record<PlacardLanguage, { label: string; flag: string }> = {
  sq: { label: 'Shqip', flag: '🇦🇱' },
  en: { label: 'English', flag: '🇬🇧' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
}

export const PLACARD_CATEGORY_LABELS: Record<PlacardCategory, string> = {
  'flamingo-revolution': 'Flamingo Revolution',
  'vjosa-narta': 'Vjosa-Narta',
  diaspora: 'Diaspora',
  korrupsioni: 'Kundër korrupsionit',
  satire: 'Satirë',
  short: 'Të shkurtra',
  powerful: 'Të fuqishme',
}

export const PLACARD_FILTER_ORDER: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Të gjitha' },
  { key: 'lang:sq', label: 'Shqip' },
  { key: 'lang:en', label: 'English' },
  { key: 'lang:de', label: 'Deutsch' },
  { key: 'cat:flamingo-revolution', label: 'Flamingo Revolution' },
  { key: 'cat:vjosa-narta', label: 'Vjosa-Narta' },
  { key: 'cat:diaspora', label: 'Diaspora' },
  { key: 'cat:korrupsioni', label: 'Kundër korrupsionit' },
  { key: 'cat:satire', label: 'Satirë' },
  { key: 'cat:short', label: 'Të shkurtra' },
  { key: 'cat:powerful', label: 'Të fuqishme' },
]

export type PlacardSort = 'newest' | 'shortest'

export const SEED_PLACARDS: Placard[] = [
  {
    id: 'shqiperia-nuk-shitet',
    slogan: 'Shqipëria nuk shitet',
    language: 'sq',
    categories: ['flamingo-revolution', 'korrupsioni', 'short', 'powerful'],
    submittedAt: '2026-06-13T09:00:00Z',
  },
  {
    id: 'vjosa-nuk-shitet',
    slogan: 'Vjosa nuk shitet',
    language: 'sq',
    categories: ['vjosa-narta', 'short', 'powerful'],
    submittedAt: '2026-06-13T09:05:00Z',
  },
  {
    id: 'narta-nuk-eshte-biznes',
    slogan: 'Narta nuk është biznes',
    language: 'sq',
    categories: ['vjosa-narta', 'short'],
    submittedAt: '2026-06-13T09:10:00Z',
  },
  {
    id: 'mbroni-flamingot',
    slogan: 'Mbroni flamingot',
    language: 'sq',
    categories: ['flamingo-revolution', 'vjosa-narta', 'short'],
    submittedAt: '2026-06-13T09:15:00Z',
  },
  {
    id: 'jo-beton-ne-zonat-e-mbrojtura',
    slogan: 'Jo beton në zonat e mbrojtura',
    language: 'sq',
    categories: ['vjosa-narta', 'korrupsioni'],
    submittedAt: '2026-06-13T09:20:00Z',
  },
  {
    id: 'flamingot-nuk-kane-ze-ne-po',
    slogan: 'Flamingot nuk kanë zë, ne po',
    language: 'sq',
    categories: ['flamingo-revolution', 'vjosa-narta', 'powerful'],
    submittedAt: '2026-06-13T09:25:00Z',
  },
  {
    id: 'per-shqiperine-jo-per-oligarket',
    slogan: 'Për Shqipërinë, jo për oligarkët',
    language: 'sq',
    categories: ['korrupsioni', 'powerful'],
    submittedAt: '2026-06-13T09:30:00Z',
  },
  {
    id: 'nature-is-not-for-sale',
    slogan: 'Nature is not for sale',
    language: 'en',
    categories: ['vjosa-narta', 'short', 'powerful'],
    submittedAt: '2026-06-13T09:35:00Z',
  },
  {
    id: 'protect-vjosa-narta',
    slogan: 'Protect Vjosa-Narta',
    language: 'en',
    categories: ['vjosa-narta', 'short'],
    submittedAt: '2026-06-13T09:40:00Z',
  },
  {
    id: 'albania-is-not-for-sale',
    slogan: 'Albania is not for sale',
    language: 'en',
    categories: ['flamingo-revolution', 'korrupsioni', 'short', 'powerful'],
    submittedAt: '2026-06-13T09:45:00Z',
  },
  {
    id: 'keine-betonierung-geschutzter-natur',
    slogan: 'Keine Betonierung geschützter Natur',
    language: 'de',
    categories: ['vjosa-narta', 'korrupsioni'],
    submittedAt: '2026-06-13T09:50:00Z',
  },
  {
    id: 'schutz-fur-vjosa-narta',
    slogan: 'Schutz für Vjosa-Narta',
    language: 'de',
    categories: ['vjosa-narta', 'short'],
    submittedAt: '2026-06-13T09:55:00Z',
  },
  {
    id: 'diaspora-per-shqiperine',
    slogan: 'Diaspora për Shqipërinë',
    language: 'sq',
    categories: ['diaspora', 'short'],
    submittedAt: '2026-06-13T10:00:00Z',
  },
  {
    id: 'nje-ze-per-natyren',
    slogan: 'Një zë për natyrën',
    language: 'sq',
    categories: ['vjosa-narta', 'short'],
    submittedAt: '2026-06-13T10:05:00Z',
  },
  {
    id: 'stop-shkaterrimit-te-natyres',
    slogan: 'Stop shkatërrimit të natyrës',
    language: 'sq',
    categories: ['vjosa-narta', 'powerful'],
    submittedAt: '2026-06-13T10:10:00Z',
  },
]

export function filterPlacards(list: Placard[], filterKey: string): Placard[] {
  if (filterKey === 'all') return list
  if (filterKey.startsWith('lang:')) {
    const lang = filterKey.slice(5) as PlacardLanguage
    return list.filter((p) => p.language === lang)
  }
  if (filterKey.startsWith('cat:')) {
    const cat = filterKey.slice(4) as PlacardCategory
    return list.filter((p) => p.categories.includes(cat))
  }
  return list
}

export function sortPlacards(list: Placard[], sort: PlacardSort): Placard[] {
  const copy = [...list]
  if (sort === 'shortest') copy.sort((a, b) => a.slogan.length - b.slogan.length)
  else copy.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
  return copy
}

export function topCategory(list: Placard[]): { category: PlacardCategory; count: number } | null {
  const counts = new Map<PlacardCategory, number>()
  for (const p of list) {
    for (const c of p.categories) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best: { category: PlacardCategory; count: number } | null = null
  counts.forEach((count, category) => {
    if (!best || count > best.count) best = { category, count }
  })
  return best
}

export function featuredPlacard(list: Placard[]): Placard | null {
  return list.find((p) => p.categories.includes('powerful')) ?? list[0] ?? null
}
