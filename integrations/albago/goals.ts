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

/** First vertical slice: everything happening in Tirana over the next 14 days. */
export function tiranaNext14Days(): DiscoveryGoalV1 {
  return {
    id: 'tirana-14d',
    label: 'Upcoming events in Tirana, Albania — next 14 days',
    geography: { country_codes: ['AL'], localities: ['Tirana'] },
    horizon_days: 14,
    relevance: ALBANIAN_RELEVANCE,
    languages: ['sq', 'en'],
    required_fields: [],
    budget: { max_searches: 12, max_fetches: 30, max_tokens: 400_000, max_minutes: 4.5 },
  }
}

/** Hosts the research lane must not collect from (platform terms / no permission). */
export const BLOCKED_HOSTS = ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'x.com', 'twitter.com', 'eventbrite.com', 'songkick.com', 'allevents.in']
