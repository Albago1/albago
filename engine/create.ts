import type { DiscoveryGoalV1 } from './contract/goal'
import { DiscoveryGoalV1 as GoalSchema } from './contract/goal'
import type { ObservationInputV1 } from './contract/observation'
import type { EngineDeps } from './ports'
import { discover, type DiscoverOptions } from './services/discover'
import { observe, type ObserveContext } from './services/observe'
import { createEntities } from './services/entities'
import { createReview, toContract } from './services/review'

/**
 * Build an engine instance from a deployment's ports. This object is the
 * engine's in-process API; its methods map 1:1 to a future HTTP API.
 */
export function createEngine(deps: EngineDeps) {
  const review = createReview(deps)
  return {
    /** Feed one piece of fetched evidence through the full pipeline. */
    observe: (input: ObservationInputV1, ctx?: ObserveContext) => observe(deps, input, ctx),
    /** Run the AI research lane for a goal (validated against the contract first). */
    discover: (goal: DiscoveryGoalV1, opts: DiscoverOptions) => discover(deps, GoalSchema.parse(goal), opts),
    review,
    /** Performers/organizers and their confirmed or candidate affiliations. */
    entities: createEntities(deps),
    occurrences: {
      get: async (id: string) => {
        const o = await deps.store.occurrences.get(id)
        return o ? toContract(o) : null
      },
    },
    runs: {
      recent: (limit = 10) => deps.store.runs.recent(limit),
      get: (id: string) => deps.store.runs.get(id),
    },
  }
}

export type Engine = ReturnType<typeof createEngine>
