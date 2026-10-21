import type { RelevanceCriteriaV1 } from '../contract/goal'
import type { RelevanceVerdictV1 } from '../contract/occurrence'
import { localityInText } from './places'
import { foldText } from './text'

/**
 * Relevance verdict from neutral FACTS + the consumer's criteria, combined by
 * the criteria's deterministic rule. The AI only extracted the facts; it does
 * not decide relevance. 'possible' goes to a human, and a human decision
 * (assessed_by 'human') is never overwritten by these rules.
 */

export type RelevanceFacts = {
  country_code: string | null
  locality: string | null
  promotion_languages: string[]
  audience_statements: string[]
  cultural_occasion: string | null
  /** Performers / organizers the entity graph already knows carry the criteria's affiliation. */
  affiliated_performers: string[]
  affiliated_organizers: string[]
  /** The event's own words — keywords here are explicit evidence. */
  title?: string | null
  description?: string | null
  organizer_name?: string | null
  performers?: string[]
}

type Signal = RelevanceVerdictV1['signals'][number]

/** The first criteria keyword found in the text (accent- and case-insensitive), or null. */
export function keywordIn(text: string | null | undefined, keywords: string[]): string | null {
  if (!text) return null
  const t = foldText(text)
  return keywords.find((k) => t.includes(foldText(k))) ?? null
}

export function evaluateRelevance(
  criteria: RelevanceCriteriaV1,
  facts: RelevanceFacts,
  observationId: string | null,
  at: string,
): RelevanceVerdictV1 {
  const signals: Signal[] = []
  const seen = new Set<string>()
  const push = (kind: string, value: string, strength: Signal['strength'] | undefined) => {
    const key = `${kind}|${value.toLowerCase()}`
    if (!strength || seen.has(key)) return
    seen.add(key)
    signals.push({ kind, value, strength, observation_id: observationId })
  }

  const inCountry = facts.country_code != null && criteria.location_implies.country_codes.includes(facts.country_code)
  const inLocality =
    facts.locality != null && criteria.location_implies.localities.some((l) => foldText(l) === foldText(facts.locality!))
  if (inCountry || inLocality) {
    return {
      verdict: 'relevant',
      signals: [{ kind: 'location', value: inLocality ? facts.locality! : facts.country_code!, strength: 'strong', observation_id: observationId }],
      assessed_by: 'rules',
      at,
    }
  }

  const s = criteria.signals
  for (const p of facts.affiliated_performers) push('performer_affiliation', p, s.performer_affiliation)
  for (const o of facts.affiliated_organizers) push('organizer_affiliation', o, s.organizer_affiliation)
  if (criteria.keywords.length) {
    for (const a of facts.audience_statements) if (keywordIn(a, criteria.keywords)) push('audience_statement', a, s.audience_statement)
    if (facts.cultural_occasion && keywordIn(facts.cultural_occasion, criteria.keywords)) push('cultural_occasion', facts.cultural_occasion, s.cultural_occasion)
    if (keywordIn(facts.title, criteria.keywords)) push('title_keyword', facts.title!, s.title_keyword)
    if (keywordIn(facts.organizer_name, criteria.keywords)) push('organizer_keyword', facts.organizer_name!, s.organizer_keyword)
    // The description only counts when the title did not already say it.
    if (!keywordIn(facts.title, criteria.keywords)) {
      const k = keywordIn(facts.description, criteria.keywords)
      if (k) push('description_keyword', k, s.description_keyword)
    }
  }
  const lang = s.promotion_language
  if (lang) {
    const hit = facts.promotion_languages.find((l) => lang.languages.includes(l))
    if (hit) push('promotion_language', hit, lang.strength)
  }
  // Named after a place the criteria implies: "Shkodra Elektronike", "Tirana Express".
  if (s.place_mention) {
    for (const name of [facts.title, facts.organizer_name, ...(facts.performers ?? [])]) {
      const place = localityInText(name)
      const implied =
        place && (criteria.location_implies.country_codes.includes(place.country) || criteria.location_implies.localities.some((l) => foldText(l) === foldText(place.name)))
      if (place && implied) {
        push('place_mention', place.name, s.place_mention)
        break
      }
    }
  }

  const strong = signals.filter((x) => x.strength === 'strong').length
  const medium = signals.filter((x) => x.strength === 'medium').length
  const verdict: RelevanceVerdictV1['verdict'] =
    strong >= criteria.rule.min_strong || medium >= criteria.rule.or_min_medium
      ? 'relevant'
      : signals.length > 0
        ? 'possible'
        : 'not_relevant'
  return { verdict, signals, assessed_by: 'rules', at }
}
