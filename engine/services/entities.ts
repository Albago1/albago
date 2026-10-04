import type { AffiliationClaim, EngineDeps, EntityRecord } from '../ports'

/**
 * Entity knowledge — performers, organizers, institutions and which
 * communities they belong to. Neutral: the affiliation label ("albanian")
 * comes from the consumer's relevance criteria.
 *
 * Confirmed affiliations are relevance evidence (a concert by a confirmed
 * performer is relevant anywhere in the world). The engine also LEARNS:
 * performers of relevant events become candidates that a human confirms or
 * rejects once; a rejection is remembered and never proposed again.
 */

type Kind = EntityRecord['kind']

const GENERIC_NAME = /^(dj|mc|band|live|guests?|special guests?|surprise guests?|and more|more|tba|tbc|tbd|various( artists)?|artists?|friends|orchestra|ensemble|choir|resident djs?|line ?up|n\/a)$/i
const EVIDENCE_CAP = 5

/** A usable entity name, or null for junk the extractor sometimes lists as a performer. */
export function cleanEntityName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').replace(/^[\s,;:•\-–—]+|[\s,;:•\-–—]+$/g, '').trim()
  if (name.length < 2 || name.length > 60) return null
  if (name.split(' ').length > 6) return null
  if (GENERIC_NAME.test(name)) return null
  if (/https?:|www\.|@|#/.test(name)) return null
  if (!/\p{L}/u.test(name)) return null
  return name
}

export function createEntities(deps: EngineDeps) {
  const now = () => (deps.now?.() ?? new Date()).toISOString()
  const unique = (names: string[]) => {
    const seen = new Map<string, string>()
    for (const raw of names) {
      const name = cleanEntityName(raw)
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
    }
    return [...seen.values()]
  }

  return {
    /** Confirmed names of a kind for an affiliation (e.g. the artist watch list). */
    async affiliated(kind: Kind, affiliation: string): Promise<string[]> {
      const rows = await deps.store.entities.list(kind, affiliation)
      return rows.filter((e) => e.affiliations[affiliation]?.state === 'confirmed').map((e) => e.name)
    },

    /** Learned names waiting for a human decision, most-seen first. */
    async candidates(kind: Kind, affiliation: string): Promise<EntityRecord[]> {
      const rows = await deps.store.entities.list(kind, affiliation)
      return rows
        .filter((e) => e.affiliations[affiliation]?.state === 'candidate')
        .sort((a, b) => (b.affiliations[affiliation].evidence?.length ?? 0) - (a.affiliations[affiliation].evidence?.length ?? 0))
    },

    /**
     * Make sure these names are confirmed (operator configuration, e.g. a seed
     * list). Idempotent. A human rejection is never overridden by config.
     */
    async ensureAffiliated(kind: Kind, names: string[], affiliation: string, source = 'config', actor: string | null = null): Promise<number> {
      let added = 0
      // One list read covers the common case (already known) without a query per name.
      const known = new Map((await deps.store.entities.list(kind, affiliation)).map((e) => [e.name.toLowerCase(), e]))
      for (const name of unique(names)) {
        const claim: AffiliationClaim = { state: 'confirmed', source, since: now(), actor }
        const listed = known.get(name.toLowerCase())
        if (listed && listed.affiliations[affiliation]?.state !== 'candidate') continue
        const existing = listed ?? (await deps.store.entities.findByName(kind, name))
        if (!existing) {
          await deps.store.entities.insert({ kind, name, aliases: [], affiliations: { [affiliation]: claim } })
          added++
        } else {
          const current = existing.affiliations[affiliation]
          if (!current || current.state === 'candidate') {
            await deps.store.entities.setAffiliation(existing.id, affiliation, { ...claim, evidence: current?.evidence })
            added++
          }
        }
      }
      return added
    },

    /** Learning: names seen in a relevant event become candidates (unless already decided). */
    async propose(kind: Kind, names: string[], affiliation: string, evidence: { occurrence_id: string; title: string }): Promise<number> {
      let proposed = 0
      for (const name of unique(names)) {
        const existing = await deps.store.entities.findByName(kind, name)
        if (!existing) {
          await deps.store.entities.insert({ kind, name, aliases: [], affiliations: { [affiliation]: { state: 'candidate', source: 'learned', since: now(), evidence: [evidence] } } })
          proposed++
          continue
        }
        const current = existing.affiliations[affiliation]
        if (current && current.state !== 'candidate') continue // confirmed or rejected: already decided
        const seen = (current?.evidence ?? []).filter((e) => e.occurrence_id !== evidence.occurrence_id)
        await deps.store.entities.setAffiliation(existing.id, affiliation, {
          state: 'candidate',
          source: current?.source ?? 'learned',
          since: current?.since ?? now(),
          evidence: [evidence, ...seen].slice(0, EVIDENCE_CAP),
        })
        if (!current) proposed++
      }
      return proposed
    },

    /** A human decision on a candidate (or a correction of an earlier decision). */
    async decide(id: string, affiliation: string, state: 'confirmed' | 'rejected', actor: string | null, kind: Kind = 'performer'): Promise<void> {
      const rows = await deps.store.entities.list(kind, affiliation)
      const entity = rows.find((e) => e.id === id)
      if (!entity) throw new Error('entity_not_found')
      const current = entity.affiliations[affiliation]
      await deps.store.entities.setAffiliation(id, affiliation, { state, source: 'review', since: now(), actor, evidence: current?.evidence })
    },
  }
}

export type Entities = ReturnType<typeof createEntities>
