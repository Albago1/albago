/**
 * Event Intelligence Engine — server entry point (`@/engine/server`).
 *
 * Node-only parts of the engine (network I/O, DNS-checked fetching, and the
 * services that will run discovery). Kept out of `@/engine` so browser code
 * that uses the pure helpers never bundles Node modules.
 */

export * from './index'
export { isPublicHttpUrl, safeFetch, type SafeFetchOptions } from './acquire/ssrf'
export { normalizeImportUrl, sourceNameFromUrl } from './core/url'
export * from './extract/llm'
export { createEngine, type Engine } from './create'
export { observe, type ObserveContext, type ObserveOutcome } from './services/observe'
export { discover, describeGoal, type DiscoverOptions, type DiscoverReport } from './services/discover'
export { applyEdits, toContract, type ReviewEdits, type ReviewItem } from './services/review'
