import type { RelevanceCriteriaV1 } from '../contract/goal'
import type { RelevanceVerdictV1 } from '../contract/occurrence'
import { foldText } from './text'

/**
 * Relevance verdict from neutral FACTS + the consumer's criteria, combined by
 * the criteria's deterministic rule. The AI only extracted the facts; it does
 * not decide relevance. 'possible' goes to a human.
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
}

type Signal = RelevanceVerdictV1['signals'][number]

const mentions = (text: string, keywords: string[]) => {
  const t = foldText(text)
  return keywords.some((k) => t.includes(foldText(k)))
}

export function evaluateRelevance(
  criteria: RelevanceCriteriaV1,
  facts: RelevanceFacts,
  observationId: string | null,
  at: string,
): RelevanceVerdictV1 {
  const signals: Signal[] = []
  const push = (kind: string, value: string, strength: Signal['strength'] | undefined) => {
    if (strength) signals.push({ kind, value, strength, observation_id: observationId })
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

  for (const p of facts.affiliated_performers) push('performer_affiliation', p, criteria.signals.performer_affiliation)
  for (const o of facts.affiliated_organizers) push('organizer_affiliation', o, criteria.signals.organizer_affiliation)
  for (const a of facts.audience_statements) {
    if (criteria.keywords.length && mentions(a, criteria.keywords)) push('audience_statement', a, criteria.signals.audience_statement)
  }
  const lang = criteria.signals.promotion_language
  if (lang) {
    const hit = facts.promotion_languages.find((l) => lang.languages.includes(l))
    if (hit) push('promotion_language', hit, lang.strength)
  }
  if (facts.cultural_occasion && criteria.keywords.length && mentions(facts.cultural_occasion, criteria.keywords)) {
    push('cultural_occasion', facts.cultural_occasion, criteria.signals.cultural_occasion)
  }

  const strong = signals.filter((s) => s.strength === 'strong').length
  const medium = signals.filter((s) => s.strength === 'medium').length
  const verdict: RelevanceVerdictV1['verdict'] =
    strong >= criteria.rule.min_strong || medium >= criteria.rule.or_min_medium
      ? 'relevant'
      : signals.length > 0
        ? 'possible'
        : 'not_relevant'
  return { verdict, signals, assessed_by: 'rules', at }
}
