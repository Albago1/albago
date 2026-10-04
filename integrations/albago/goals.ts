import type { DiscoveryGoalV1, RelevanceCriteriaV1 } from '@/engine'

/**
 * AlbaGo's discovery configuration — Albanian and Albanian-relevant events.
 * This is configuration handed to the engine; the engine itself knows
 * nothing Albanian-specific.
 */

export const ALBANIAN_RELEVANCE: RelevanceCriteriaV1 = {
  id: 'albanian',
  description:
    'Albanian or Albanian-diaspora relevant: located in Albania or Kosovo or an Albanian-majority town, or featuring Albanian performers/organizers, explicitly for the Albanian community, or marking an Albanian occasion.',
  affiliation: 'albanian',
  keywords: ['shqiptar', 'shqiptare', 'shqip', 'albanian', 'albaner', 'albanisch', 'albanese', 'albanais', 'kosov', 'arberesh', 'arbëresh'],
  location_implies: {
    country_codes: ['AL', 'XK'],
    localities: ['Tetovo', 'Struga', 'Gostivar', 'Kičevo', 'Ulcinj', 'Tuzi', 'Preševo', 'Bujanovac'],
  },
  signals: {
    performer_affiliation: 'strong',
    organizer_affiliation: 'strong',
    audience_statement: 'strong',
    promotion_language: { languages: ['sq'], strength: 'medium' },
    cultural_occasion: 'medium',
    community_venue: 'medium',
  },
  rule: { min_strong: 1, or_min_medium: 2 },
}

/**
 * Seed of the artist watch. Written into the engine as confirmed Albanian
 * performers (so their concerts count as Albanian anywhere in the world); the
 * list then grows from performers the engine learns and a reviewer confirms.
 */
export const ARTIST_SEED: string[] = [
  // Global
  'Dua Lipa', 'Rita Ora', 'Bebe Rexha', 'Ava Max', 'Ermal Meta', 'Action Bronson', 'Gashi',
  // DACH / diaspora rap and pop
  'Loredana', 'Azet', 'Ardian Bujupi', 'Lumi B', 'DJ Gimi-O', 'Don Phenom',
  // Pop / R&B
  'Alban Skënderaj', 'Elvana Gjata', 'Noizy', 'Era Istrefi', 'Yll Limani', 'Arilena Ara', 'Dafina Zeqiri',
  'Dhurata Dora', 'Ledri Vula', 'Butrint Imeri', 'Ronela Hajati', 'Besa', 'Morena Taraku', 'Enca',
  'Flori Mumajesi', 'Aurela Gaçe', 'Eneda Tarifa', 'Anjeza Shahini', 'Kejsi Tola', 'Elhaida Dani',
  'Jonida Maliqi', 'Rona Nishliu', 'Genta Ismajli', 'Leonora Jakupi', 'Nora Istrefi', 'Vesa Luma', 'Bleona',
  'Mariza Ikonomi', 'Rovena Stefa', 'Xhensila Myrtezaj', 'Olta Boka', 'Melinda Ademi', 'Arta Bajrami',
  'Linda Halimi', 'Fifi', 'Blero', 'Ermal Fejzullahu', 'Endri & Stefi Prifti', 'Tayna', 'Kida',
  // Rap / hip-hop
  'Capital T', 'Gjiko', 'Majk', 'Getinjo', 'Mozzik', 'Stresi', 'Lyrical Son', 'Unikkatil', 'MC Kresha',
  'Cozman', 'Ghetto Geasy', 'Varrosi', 'Vig Poppa', 'DJ Blunt & Real 1',
  // Folk / traditional
  'Shkurte Fejza', 'Sinan Hoxha', 'Ilir Shaqiri', 'Mahmut Ferati', 'Adelina Ismaili',
]

export type CityTarget = {
  name: string
  country: string
  /** region = Albanian-speaking area (every event counts); diaspora = only Albanian-relevant events. */
  kind: 'region' | 'diaspora'
  /** Search languages besides Albanian. */
  languages: string[]
}

const city = (name: string, country: string, kind: CityTarget['kind'], ...languages: string[]): CityTarget => ({ name, country, kind, languages })

export const REGION_CITIES: CityTarget[] = [
  city('Tirana', 'AL', 'region', 'en'),
  city('Durrës', 'AL', 'region', 'en'),
  city('Vlorë', 'AL', 'region', 'en'),
  city('Sarandë', 'AL', 'region', 'en'),
  city('Shkodër', 'AL', 'region', 'en'),
  city('Korçë', 'AL', 'region', 'en'),
  city('Prishtina', 'XK', 'region', 'en'),
  city('Prizren', 'XK', 'region', 'en'),
  city('Peja', 'XK', 'region', 'en'),
  city('Gjakova', 'XK', 'region', 'en'),
  city('Ferizaj', 'XK', 'region', 'en'),
  city('Tetovo', 'MK', 'region', 'mk', 'en'),
  city('Skopje', 'MK', 'region', 'mk', 'en'),
  city('Ulcinj', 'ME', 'region', 'en'),
]

export const DIASPORA_CITIES: CityTarget[] = [
  city('Zurich', 'CH', 'diaspora', 'de', 'en'),
  city('Basel', 'CH', 'diaspora', 'de', 'en'),
  city('Geneva', 'CH', 'diaspora', 'fr', 'en'),
  city('Lausanne', 'CH', 'diaspora', 'fr', 'en'),
  city('St. Gallen', 'CH', 'diaspora', 'de'),
  city('Lucerne', 'CH', 'diaspora', 'de'),
  city('Munich', 'DE', 'diaspora', 'de', 'en'),
  city('Stuttgart', 'DE', 'diaspora', 'de'),
  city('Frankfurt', 'DE', 'diaspora', 'de'),
  city('Düsseldorf', 'DE', 'diaspora', 'de'),
  city('Cologne', 'DE', 'diaspora', 'de'),
  city('Berlin', 'DE', 'diaspora', 'de', 'en'),
  city('Hamburg', 'DE', 'diaspora', 'de'),
  city('Vienna', 'AT', 'diaspora', 'de', 'en'),
  city('Milan', 'IT', 'diaspora', 'it'),
  city('Athens', 'GR', 'diaspora', 'el', 'en'),
  city('London', 'GB', 'diaspora', 'en'),
  city('Brussels', 'BE', 'diaspora', 'fr', 'nl', 'en'),
  city('Stockholm', 'SE', 'diaspora', 'sv', 'en'),
  city('Malmö', 'SE', 'diaspora', 'sv', 'en'),
  city('New York', 'US', 'diaspora', 'en'),
  city('Detroit', 'US', 'diaspora', 'en'),
  city('Chicago', 'US', 'diaspora', 'en'),
]

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

export function cityGoalId(c: CityTarget): string {
  return `city-${c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}`
}

// Each run must finish inside one 300 s function call (abort at deadline + 30 s).
const RUN_BUDGET = { max_tokens: 400_000, max_minutes: 3.75 }

/** One city: everything in an Albanian-speaking city, or the Albanian scene in a diaspora city. */
export function cityGoal(c: CityTarget): DiscoveryGoalV1 {
  const country = COUNTRY_NAMES.of(c.country) ?? c.country
  const diaspora = c.kind === 'diaspora'
  return {
    id: cityGoalId(c),
    label: diaspora
      ? `Albanian events in ${c.name}, ${country}: Albanian parties and club nights, concerts by Albanian artists, festivals and community events`
      : `Upcoming events in ${c.name}, ${country}`,
    geography: { country_codes: [c.country], localities: [c.name] },
    // Diaspora parties and concerts are announced weeks ahead; region cities fill up closer to the date.
    horizon_days: diaspora ? 60 : 21,
    relevance: ALBANIAN_RELEVANCE,
    languages: ['sq', ...c.languages],
    expansion: { places: [], entities: { performers: [], organizers: [], institutions: [] }, platforms: [], query_languages: ['sq', ...c.languages], learn: true },
    required_fields: [],
    budget: { max_searches: 5, max_fetches: 14, ...RUN_BUDGET },
  }
}

/** A batch of Albanian artists: their upcoming concerts and shows anywhere in the world. */
export function artistGoal(artists: string[]): DiscoveryGoalV1 {
  return {
    id: 'artists',
    label: `Upcoming concerts, tours and shows by Albanian artists: ${artists.join(', ')}`,
    geography: { scope: 'worldwide' },
    categories: ['concert', 'festival', 'club_night', 'party_social', 'comedy'],
    horizon_days: 180,
    relevance: ALBANIAN_RELEVANCE,
    languages: ['sq', 'en', 'de'],
    expansion: { places: [], entities: { performers: artists, organizers: [], institutions: [] }, platforms: [], query_languages: ['sq', 'en', 'de'], learn: true },
    required_fields: [],
    budget: { max_searches: artists.length + 1, max_fetches: 14, ...RUN_BUDGET },
  }
}

/** First vertical slice, kept for the manual script: Tirana, next 14 days. */
export function tiranaNext14Days(): DiscoveryGoalV1 {
  return { ...cityGoal(REGION_CITIES[0]), horizon_days: 14 }
}

/** Hosts the research lane must not collect from (platform terms / no permission). */
export const BLOCKED_HOSTS = ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'x.com', 'twitter.com', 'eventbrite.com', 'songkick.com', 'allevents.in']
